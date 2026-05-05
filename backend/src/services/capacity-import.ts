/**
 * capacity-import.ts
 * Parsers for the IM Capacity Excel workbook (both class-capacity and per-tool sheets).
 *
 * NOTE: The canonical source is a .xlsb file. SheetJS community edition crashes on
 * this particular workbook (Bad SerAr error in formula parsing). The file must be
 * converted to .xlsx (e.g. via LibreOffice --headless --convert-to xlsx) before use.
 * The CLI scripts handle this automatically when the file is already .xlsx; callers
 * are responsible for providing a readable path.
 */

import * as XLSX from 'xlsx';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ParsedClassRow = {
  label: string;           // e.g. "KM 80", "KM 350 2K"
  tonnage_t: number;       // parsed from label
  requires_2k: boolean;
  requires_mucell: boolean;
  requires_variotherm: boolean;
  year: number;
  oee_pct: number;
  shifts_per_week: number;
};

export type ParsedTool = {
  tool_number: string;
  description: string | null;
  cavities: number | null;
  rated_cycle_time_sec: number | null;
  source_sheet: string;
};

export type ParsedVolume = {
  tool_number: string;
  year: number;
  machine_equivalents: number;  // raw value from Excel; CLI converts to pieces_per_year
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseClassLabel(raw: string): {
  tonnage_t: number;
  requires_2k: boolean;
  requires_mucell: boolean;
  requires_variotherm: boolean;
} | null {
  const m = String(raw).match(/KM\s*(\d+)/i);
  if (!m) return null;
  const tonnage_t = Number(m[1]);
  const upper = raw.toUpperCase();
  return {
    tonnage_t,
    requires_2k: /\b2K\b/.test(upper),
    requires_mucell: /MUCELL/.test(upper),
    requires_variotherm: /VARIO/.test(upper),
  };
}

function cellNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.').trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function cellStr(v: unknown): string | null {
  if (v == null || v === '') return null;
  return String(v).trim() || null;
}

// ── Task 13: Class capacity sheet ─────────────────────────────────────────────

/**
 * Parse the "Total Overview Capacity" sheet.
 *
 * Sheet layout (repeating pattern of 5 rows per machine class):
 *   Row i+0: header: col[6]=2018, col[7]=2019, ... col[18]=2030
 *   Row i+1: blank
 *   Row i+2: class row: col[1]="KM 80", col[2]=85 (OEE%), col[4]=15 (shifts/wk)
 *   Row i+3: utilization row (skip)
 *   Row i+4: blank
 *
 * We detect header rows by checking col[6] is a year (2010-2050) and col[1]=="No Flex"
 * OR col[2]=="OEE %".
 */
export function parseClassCapacity(
  wb: XLSX.WorkBook,
  yearFrom: number,
  yearTo: number,
): ParsedClassRow[] {
  const sh = wb.Sheets['Total Overview Capacity'];
  if (!sh) throw new Error('Sheet "Total Overview Capacity" not found');
  const aoa: unknown[][] = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true, defval: null });
  const out: ParsedClassRow[] = [];

  for (let i = 0; i < aoa.length - 2; i++) {
    const headerRow = aoa[i] ?? [];

    // Detect a header row: col[6] is a year AND (col[1]=="No Flex" OR col[2]=="OEE %")
    const col6 = cellNum(headerRow[6]);
    if (!col6 || col6 < 2010 || col6 > 2050) continue;
    const isHeader =
      cellStr(headerRow[1]) === 'No Flex' ||
      cellStr(headerRow[2]) === 'OEE %';
    if (!isHeader) continue;

    // Collect year columns
    const yearCols: { col: number; year: number }[] = [];
    for (let c = 6; c < headerRow.length; c++) {
      const yr = cellNum(headerRow[c]);
      if (yr && yr >= 2010 && yr <= 2050) yearCols.push({ col: c, year: yr });
    }

    // Class data row is 2 rows after the header row (with a blank in between)
    const classRow = aoa[i + 2] ?? [];
    const label = cellStr(classRow[1]);
    if (!label) continue;
    const parsed = parseClassLabel(label);
    if (!parsed) continue;

    const oee = cellNum(classRow[2]);
    const shifts = cellNum(classRow[4]);
    if (oee == null || shifts == null) continue;

    for (const { col, year } of yearCols) {
      if (year < yearFrom || year > yearTo) continue;
      out.push({
        label,
        tonnage_t: parsed.tonnage_t,
        requires_2k: parsed.requires_2k,
        requires_mucell: parsed.requires_mucell,
        requires_variotherm: parsed.requires_variotherm,
        year,
        oee_pct: oee,
        shifts_per_week: shifts,
      });
    }
  }

  return out;
}

// ── Task 14: Per-tool sheet ───────────────────────────────────────────────────

/**
 * Parse a machine-class sheet (e.g. "KM 80", "KM 200 ").
 *
 * Left-side tool blocks (repeating every 9-10 rows):
 *   Row N: "Tool #"   <num>   [desc]   ...  "Tool #"   <num>   [desc]  ...
 *   Row N+1: "Pieces" ...
 *   Row N+2: "cavity"  <n>  ...
 *   Row N+3: "cycle time sec."  <s>  ...
 *
 * Tool blocks use 5 columns each: [label, value, ?, ?, ?].
 * Columns 0-4 = tool 1, 5-9 = tool 2, 10-14 = tool 3.
 * Some sheets have col[0]=null and the blocks start at col[1].
 *
 * Right-side forecast table:
 *   Some row R: col[C]="Tool #"  col[C+1]=2018  col[C+2]=2019 ...
 *   Then rows R+2+: col[C]=tool_number  col[C+1..]=machine_equiv values per year
 */
export function parseToolSheet(
  wb: XLSX.WorkBook,
  sheetName: string,
): { tools: ParsedTool[]; volumes: ParsedVolume[] } {
  const sh = wb.Sheets[sheetName];
  if (!sh) throw new Error(`Sheet "${sheetName}" not found`);
  const aoa: unknown[][] = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true, defval: null });

  const tools: ParsedTool[] = [];
  const toolsSeen = new Set<string>();
  const volumes: ParsedVolume[] = [];

  // ── Left-side: find all tool blocks ──────────────────────────────────────
  // A "Tool #" row has "Tool #" at position 0 or 1, followed by a value (tool number).
  // Each block is 5 columns wide. We scan every row for "Tool #" entries.

  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    // For each column in row, look for "Tool #"
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== 'Tool #') continue;
      const toolNumRaw = row[c + 1];
      if (toolNumRaw == null || toolNumRaw === '') continue;
      const toolNumber = String(toolNumRaw).trim();
      if (!toolNumber || toolNumber === 'Tool #') continue;

      // Skip if this is the forecast table header (a column where the next value is a year)
      const nextNum = cellNum(toolNumRaw);
      if (nextNum && nextNum >= 2010 && nextNum <= 2050) continue;

      // Look downward for cavity + cycle time within the same column block
      let cavities: number | null = null;
      let cycleTime: number | null = null;
      let description: string | null = null;

      // Description is typically col c+2 on the Tool # row
      description = cellStr(row[c + 2]);

      for (let dr = 1; dr <= 8; dr++) {
        const r2 = aoa[r + dr];
        if (!r2) continue;
        const label = cellStr(r2[c]);
        if (label === 'cavity' && cavities == null) {
          cavities = cellNum(r2[c + 1]);
        }
        if (label && /^cycle\s*time/i.test(label) && cycleTime == null) {
          cycleTime = cellNum(r2[c + 1]);
        }
      }

      if (!toolsSeen.has(toolNumber)) {
        toolsSeen.add(toolNumber);
        tools.push({
          tool_number: toolNumber,
          description,
          cavities,
          rated_cycle_time_sec: cycleTime,
          source_sheet: sheetName,
        });
      }
    }
  }

  // ── Right-side: forecast table ────────────────────────────────────────────
  // Find the row where col[C] = "Tool #" and col[C+1] is a year (2018-2050)
  let forecastHeaderRow = -1;
  let forecastToolCol = -1;
  let forecastYearCols: { col: number; year: number }[] = [];

  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== 'Tool #') continue;
      const maybeYear = cellNum(row[c + 1]);
      if (maybeYear && maybeYear >= 2010 && maybeYear <= 2050) {
        // Found the forecast header
        forecastHeaderRow = r;
        forecastToolCol = c;
        forecastYearCols = [];
        for (let cc = c + 1; cc < row.length; cc++) {
          const yr = cellNum(row[cc]);
          if (yr && yr >= 2010 && yr <= 2050) {
            forecastYearCols.push({ col: cc, year: yr });
          }
        }
        break;
      }
    }
    if (forecastHeaderRow >= 0) break;
  }

  if (forecastHeaderRow >= 0 && forecastYearCols.length > 0) {
    // Parse rows below the forecast header
    for (let r = forecastHeaderRow + 1; r < aoa.length; r++) {
      const row = aoa[r] ?? [];
      const toolNumRaw = row[forecastToolCol];
      if (toolNumRaw == null || toolNumRaw === '') continue;

      // Skip blank rows
      const toolNumber = String(toolNumRaw).trim();
      if (!toolNumber) continue;

      // Skip if it's a year or looks like a header
      const asNum = cellNum(toolNumRaw);
      if (asNum && asNum >= 2010 && asNum <= 2050) continue;

      for (const { col, year } of forecastYearCols) {
        const val = cellNum(row[col]);
        if (val != null && val > 0) {
          volumes.push({ tool_number: toolNumber, year, machine_equivalents: val });
        }
      }
    }
  }

  return { tools, volumes };
}
