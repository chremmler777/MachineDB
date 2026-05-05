#!/usr/bin/env tsx
/**
 * import-capacity.ts
 * CLI script to import IM Capacity workbook data into the database.
 *
 * Usage:
 *   npx tsx scripts/import-capacity.ts <path-to-xlsx> [--dry-run]
 *
 * The source file should be .xlsx. If you have the original .xlsb, convert first:
 *   libreoffice --headless --convert-to xlsx <file.xlsb>
 *
 * The script:
 *   1. Parses the "Total Overview Capacity" sheet → upserts im_class_capacity rows
 *   2. Parses each KM-class tool sheet → inserts/updates im_tools
 *   3. Upserts im_tool_volumes (machine_equivalents converted to pieces_per_year)
 *   4. Prints a reconciliation report
 *
 * --dry-run: parses and reports without writing to DB.
 */

import path from 'path';
import fs from 'fs';
import XLSX from 'xlsx';
import pg from 'pg';
import dotenv from 'dotenv';
import { parseClassCapacity, parseToolSheet } from '../src/services/capacity-import.js';
import type { ParsedClassRow, ParsedTool, ParsedVolume } from '../src/services/capacity-import.js';

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') });

// ── Config ────────────────────────────────────────────────────────────────────

const XLSX_PATH_DEFAULT =
  path.resolve(
    import.meta.dirname,
    '../../data/files/Capacity/IM_Capacity_85%OEE_No Flex_Current +G6X_G45 UBV_G45WAL2300+VW426Grill1600_WB_2-12-26_3200.xlsx',
  );

const TOOL_SHEETS = [
  'KM 80',
  'KM 200 ',
  'KM 350',
  'KM 350 2K',
  'KM 550 2k',
  'KM 650',
  'KM 900-5',
  'KM 900 1-3',
  'KM 1000 2k',
  'KM 1300 2k',
  'KM 1600 2k',
  'KM 1600-3 (New)',
  'KM 2300',
  'KM 3200',
];

const YEAR_FROM = 2024;
const YEAR_TO = 2030;

// Hours per machine per year used to convert machine_equivalents → pieces/year
// machine_equiv = hours_demanded / hours_per_machine
// So pieces_per_year = machine_equiv × hours_per_machine × pieces_per_hour
// But we don't store pieces_per_year from the forecast table directly;
// the forecast table already has machine_equiv values.
// For im_tool_volumes, we store the machine_equiv as-is scaled to an integer piece count
// using the tool's own cycle time.
// The capacity engine (capacity-engine.ts) does the inverse: pieces→machine_equiv.
// So we store actual pieces_per_year from the "piece/year" row in the left-side blocks.
//
// However, the left-side piece/year is the MAX at full utilization (not actual demand).
// The right-side machine_equiv IS actual demand per year.
// To store in im_tool_volumes (pieces_per_year), we need:
//   pieces_per_year = machine_equiv × (oee_hours_per_machine) × pieces_per_hour_of_tool
//   = machine_equiv × (shifts_per_week × 8 × (52 - 2) × oee) × (cavities × 3600 / cycle_sec)
//
// For Phase 1 we use a standard assumption:
//   hours_per_machine = 15 shifts/wk × 8 hr/shift × 50 wk × 0.85 OEE = 5100 hr/yr
//   pieces_per_year = machine_equiv × 5100 × (cavities × 3600 / cycle_sec)
// This is the same formula the capacity engine uses.
const HOURS_PER_MACHINE_PER_YEAR = 15 * 8 * 50 * 0.85; // 5100

// ── Parse args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const xlsxPath = args.find(a => !a.startsWith('--')) ?? XLSX_PATH_DEFAULT;

if (!fs.existsSync(xlsxPath)) {
  console.error(`ERROR: File not found: ${xlsxPath}`);
  console.error('If you have a .xlsb file, convert it first:');
  console.error('  libreoffice --headless --convert-to xlsx <file.xlsb>');
  process.exit(1);
}

// ── DB ────────────────────────────────────────────────────────────────────────

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/machinedb',
});

// ── Report types ──────────────────────────────────────────────────────────────

interface ReconciliationReport {
  classCapacity: {
    upserted: number;
    skipped: number;
  };
  tools: {
    created: number;
    updated: number;
    skipped: number;
    unmatched_machines: string[];
    conflicts: { tool_number: string; field: string; existing: unknown; incoming: unknown }[];
  };
  volumes: {
    upserted: number;
    skipped: number;
  };
  dedup: {
    duplicate_tool_numbers_across_sheets: { tool_number: string; sheets: string[] }[];
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== IM Capacity Import ${dryRun ? '[DRY RUN]' : '[LIVE]'} ===`);
  console.log(`File: ${xlsxPath}`);
  console.log(`Years: ${YEAR_FROM}-${YEAR_TO}`);
  console.log('');

  // ── Parse ─────────────────────────────────────────────────────────────────

  console.log('Parsing workbook...');
  const wb = XLSX.readFile(xlsxPath);

  const classRows = parseClassCapacity(wb, YEAR_FROM, YEAR_TO);
  console.log(`  Class capacity rows: ${classRows.length}`);

  const allTools: ParsedTool[] = [];
  const allVolumes: ParsedVolume[] = [];
  const toolSheetMap = new Map<string, string[]>(); // tool_number → sheets

  for (const sheetName of TOOL_SHEETS) {
    if (!wb.SheetNames.includes(sheetName)) {
      console.log(`  WARNING: Sheet "${sheetName}" not found — skipping`);
      continue;
    }
    const { tools, volumes } = parseToolSheet(wb, sheetName);
    for (const t of tools) {
      const existing = toolSheetMap.get(t.tool_number);
      if (existing) {
        existing.push(sheetName);
      } else {
        toolSheetMap.set(t.tool_number, [sheetName]);
        allTools.push(t);
      }
    }
    allVolumes.push(...volumes);
    console.log(`  ${sheetName}: ${tools.length} tools, ${volumes.length} volume rows`);
  }

  const duplicates = [...toolSheetMap.entries()]
    .filter(([, sheets]) => sheets.length > 1)
    .map(([tool_number, sheets]) => ({ tool_number, sheets }));

  console.log(`\n  Total unique tools: ${allTools.length}`);
  console.log(`  Total volume rows: ${allVolumes.length}`);
  if (duplicates.length > 0) {
    console.log(`  Duplicate tool numbers across sheets: ${duplicates.length}`);
    for (const d of duplicates.slice(0, 5)) {
      console.log(`    ${d.tool_number}: ${d.sheets.join(', ')}`);
    }
  }

  const report: ReconciliationReport = {
    classCapacity: { upserted: 0, skipped: 0 },
    tools: { created: 0, updated: 0, skipped: 0, unmatched_machines: [], conflicts: [] },
    volumes: { upserted: 0, skipped: 0 },
    dedup: { duplicate_tool_numbers_across_sheets: duplicates },
  };

  if (dryRun) {
    console.log('\n[DRY RUN] Skipping DB writes.');
    report.classCapacity.upserted = classRows.length;
    report.tools.created = allTools.length;
    report.volumes.upserted = allVolumes.filter(v => v.machine_equivalents > 0).length;
    printReport(report);
    return;
  }

  const client = await pool.connect();
  try {
    // ── Upsert class capacity ────────────────────────────────────────────────
    console.log('\nUpserting class capacity rows...');
    for (const row of classRows) {
      try {
        await client.query(
          `INSERT INTO im_class_capacity
             (tonnage_t, requires_2k, requires_mucell, requires_variotherm,
              year, oee_pct, shifts_per_week, working_days_year, planned_downtime_wk)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (tonnage_t, requires_2k, requires_mucell, requires_variotherm, year)
           DO UPDATE SET
             oee_pct = EXCLUDED.oee_pct,
             shifts_per_week = EXCLUDED.shifts_per_week,
             updated_at = NOW()`,
          [
            row.tonnage_t,
            row.requires_2k,
            row.requires_mucell,
            row.requires_variotherm,
            row.year,
            row.oee_pct,
            row.shifts_per_week,
            240,  // working_days_year default
            2,    // planned_downtime_wk default
          ],
        );
        report.classCapacity.upserted++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ERROR upserting class row ${row.label}/${row.year}: ${msg}`);
        report.classCapacity.skipped++;
      }
    }

    // ── Load existing machines for label matching ────────────────────────────
    console.log('Loading machines for label matching...');
    const machinesResult = await client.query<{ id: number; internal_name: string }>(
      `SELECT id, LOWER(internal_name) AS internal_name FROM machines WHERE internal_name IS NOT NULL`,
    );
    const machineByName = new Map<string, number>();
    for (const row of machinesResult.rows) {
      machineByName.set(row.internal_name, row.id);
    }

    // ── Upsert tools ─────────────────────────────────────────────────────────
    console.log(`Upserting ${allTools.length} tools...`);
    const toolIdMap = new Map<string, number>(); // tool_number → DB id

    for (const t of allTools) {
      // Derive qualification tonnage from source sheet
      const sheetMatch = t.source_sheet.match(/KM\s*(\d+)/i);
      const tonnage = sheetMatch ? Number(sheetMatch[1]) : null;
      const requires2k = /\b2K\b/i.test(t.source_sheet);
      const requiresMucell = /MUCELL/i.test(t.source_sheet);
      const requiresVario = /VARIO/i.test(t.source_sheet);

      // Try to match machine label (e.g. "KM 200 " → "km 200")
      const normalizedSheet = t.source_sheet.trim().toLowerCase();
      const machineId = machineByName.get(normalizedSheet) ?? null;
      if (!machineId && normalizedSheet) {
        report.tools.unmatched_machines.push(t.source_sheet.trim());
      }

      // Check if tool already exists
      const existing = await client.query<{
        id: number;
        cavities: number | null;
        rated_cycle_time_sec: number | null;
      }>(
        `SELECT id, cavities, rated_cycle_time_sec FROM im_tools WHERE LOWER(tool_number) = LOWER($1)`,
        [t.tool_number],
      );

      if (existing.rowCount && existing.rowCount > 0) {
        const row = existing.rows[0];
        toolIdMap.set(t.tool_number, row.id);

        // Check for conflicts
        if (t.cavities != null && row.cavities != null && t.cavities !== row.cavities) {
          report.tools.conflicts.push({
            tool_number: t.tool_number,
            field: 'cavities',
            existing: row.cavities,
            incoming: t.cavities,
          });
        }
        if (
          t.rated_cycle_time_sec != null &&
          row.rated_cycle_time_sec != null &&
          Math.abs(Number(t.rated_cycle_time_sec) - Number(row.rated_cycle_time_sec)) > 0.5
        ) {
          report.tools.conflicts.push({
            tool_number: t.tool_number,
            field: 'rated_cycle_time_sec',
            existing: row.rated_cycle_time_sec,
            incoming: t.rated_cycle_time_sec,
          });
        }

        // Update key fields from Excel (non-destructively)
        await client.query(
          `UPDATE im_tools SET
             cavities = COALESCE($2, cavities),
             rated_cycle_time_sec = COALESCE($3, rated_cycle_time_sec),
             qualified_min_tonnage_t = COALESCE(qualified_min_tonnage_t, $4),
             qualified_max_tonnage_t = COALESCE(qualified_max_tonnage_t, $4),
             requires_2k = $5,
             requires_mucell = $6,
             requires_variotherm = $7,
             updated_at = NOW()
           WHERE id = $1`,
          [row.id, t.cavities, t.rated_cycle_time_sec, tonnage, requires2k, requiresMucell, requiresVario],
        );
        report.tools.updated++;
      } else {
        // Insert new tool
        const result = await client.query<{ id: number }>(
          `INSERT INTO im_tools
             (tool_number, description,
              cavities, rated_cycle_time_sec,
              qualified_min_tonnage_t, qualified_max_tonnage_t,
              requires_2k, requires_mucell, requires_variotherm,
              assigned_machine_id, status)
           VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, 'inactive')
           RETURNING id`,
          [
            t.tool_number,
            t.description,
            t.cavities,
            t.rated_cycle_time_sec,
            tonnage,
            requires2k,
            requiresMucell,
            requiresVario,
            machineId,
          ],
        );
        const newId = result.rows[0].id;
        toolIdMap.set(t.tool_number, newId);
        report.tools.created++;
      }
    }

    // ── Upsert tool volumes ───────────────────────────────────────────────────
    console.log(`Upserting tool volumes...`);

    // Build lookup: tool_number → (cavities, cycle_time) for pieces_per_year calc
    const toolSpecMap = new Map<string, { cavities: number | null; cycle: number | null }>();
    for (const t of allTools) {
      toolSpecMap.set(t.tool_number, { cavities: t.cavities, cycle: t.rated_cycle_time_sec });
    }

    for (const v of allVolumes) {
      if (v.machine_equivalents <= 0) {
        report.volumes.skipped++;
        continue;
      }

      const toolId = toolIdMap.get(v.tool_number);
      if (!toolId) {
        // Tool wasn't inserted (possibly skipped due to null number)
        report.volumes.skipped++;
        continue;
      }

      // Convert machine_equivalents → pieces_per_year
      const spec = toolSpecMap.get(v.tool_number);
      let piecesPerYear: number;
      if (spec?.cavities && spec?.cycle) {
        const piecesPerHour = (spec.cavities * 3600) / spec.cycle;
        piecesPerYear = Math.round(v.machine_equivalents * HOURS_PER_MACHINE_PER_YEAR * piecesPerHour);
      } else {
        // Fallback: store machine_equiv × 1000 as a proxy (will need manual review)
        piecesPerYear = Math.round(v.machine_equivalents * 1000);
      }

      try {
        await client.query(
          `INSERT INTO im_tool_volumes (tool_id, year, pieces_per_year)
           VALUES ($1, $2, $3)
           ON CONFLICT (tool_id, year)
           DO UPDATE SET pieces_per_year = EXCLUDED.pieces_per_year, updated_at = NOW()`,
          [toolId, v.year, piecesPerYear],
        );
        report.volumes.upserted++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ERROR upserting volume tool=${v.tool_number} year=${v.year}: ${msg}`);
        report.volumes.skipped++;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  printReport(report);
}

function printReport(report: ReconciliationReport) {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║           RECONCILIATION REPORT                  ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║ Class capacity rows upserted : ${String(report.classCapacity.upserted).padEnd(16)}║`);
  console.log(`║ Class capacity rows skipped  : ${String(report.classCapacity.skipped).padEnd(16)}║`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║ Tools created                : ${String(report.tools.created).padEnd(16)}║`);
  console.log(`║ Tools updated                : ${String(report.tools.updated).padEnd(16)}║`);
  console.log(`║ Tools skipped                : ${String(report.tools.skipped).padEnd(16)}║`);
  console.log(`║ Field conflicts detected     : ${String(report.tools.conflicts.length).padEnd(16)}║`);
  console.log(`║ Unmatched machine labels     : ${String(new Set(report.tools.unmatched_machines).size).padEnd(16)}║`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║ Tool volumes upserted        : ${String(report.volumes.upserted).padEnd(16)}║`);
  console.log(`║ Tool volumes skipped         : ${String(report.volumes.skipped).padEnd(16)}║`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║ Duplicate tool numbers       : ${String(report.dedup.duplicate_tool_numbers_across_sheets.length).padEnd(16)}║`);
  console.log('╚══════════════════════════════════════════════════╝');

  if (report.tools.conflicts.length > 0) {
    console.log('\nField conflicts (Excel vs DB):');
    for (const c of report.tools.conflicts.slice(0, 10)) {
      console.log(`  Tool ${c.tool_number}: ${c.field} existing=${c.existing} incoming=${c.incoming}`);
    }
    if (report.tools.conflicts.length > 10) {
      console.log(`  ... and ${report.tools.conflicts.length - 10} more`);
    }
  }

  if (report.tools.unmatched_machines.length > 0) {
    const unique = [...new Set(report.tools.unmatched_machines)];
    console.log(`\nUnmatched machine labels (assigned_machine_id set to NULL):`);
    for (const label of unique) {
      console.log(`  "${label}"`);
    }
  }

  if (report.dedup.duplicate_tool_numbers_across_sheets.length > 0) {
    console.log('\nDuplicate tool numbers (first occurrence used):');
    for (const d of report.dedup.duplicate_tool_numbers_across_sheets) {
      console.log(`  ${d.tool_number}: ${d.sheets.join(', ')}`);
    }
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
