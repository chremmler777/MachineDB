// Machine-list export: builds Excel (.xlsx) and a styled, printable HTML page
// for either the "overview" detail level (key specs) or the "full" level (the
// whole machine tab). Both share the colour-grouped look of the Machines tab,
// and headers are never truncated (Excel wraps + autosizes, HTML wraps).
import XLSX from 'xlsx-js-style';

export type Detail = 'overview' | 'full';

export interface ExportColumn {
  key: string;
  label: string;
  numeric?: boolean;
  bool?: boolean;
}

export interface ExportGroup {
  group: string;
  color: string; // RRGGBB
  columns: ExportColumn[];
}

const n = (key: string, label: string): ExportColumn => ({ key, label, numeric: true });
const b = (key: string, label: string): ExportColumn => ({ key, label, bool: true });
const t = (key: string, label: string): ExportColumn => ({ key, label });

// Group colours mirror MachineListPage.tsx (pastel column-group palette).
export const FULL_GROUPS: ExportGroup[] = [
  {
    group: 'Machine Info',
    color: 'ADD8E6',
    columns: [
      t('internal_name', 'Machine'),
      t('manufacturer', 'Manufacturer'),
      t('order_number', 'Order No.'),
      t('model', 'Model'),
      t('serial_number', 'Serial No.'),
      n('year_of_construction', 'Year'),
    ],
  },
  {
    group: 'Machine Dimensions',
    color: 'AFEEEE',
    columns: [
      n('length_mm', 'Length [mm]'),
      n('width_mm', 'Width [mm]'),
      n('height_mm', 'Height [mm]'),
      n('weight_kg', 'Weight [kg]'),
    ],
  },
  {
    group: 'Clamping Unit',
    color: 'FFFF99',
    columns: [
      n('clamping_force_t', 'Clamping Force [t]'),
      n('tool_center_distance_horizontal_mm', 'Tool-Center Dist. H [mm]'),
      n('centering_ring_nozzle_mm', 'Centering Ring Nozzle [mm]'),
      n('centering_ring_ejector_mm', 'Centering Ring Ejector [mm]'),
      b('fine_centering', 'Fine Centering'),
      n('mold_height_min_mm', 'Min Tool Height [mm]'),
      n('mold_height_max_mm', 'Max Tool Height [mm]'),
      n('opening_stroke_mm', 'Opening Stroke [mm]'),
      n('clearance_horizontal_mm', 'Clearance H [mm]'),
      n('clearance_vertical_mm', 'Clearance V [mm]'),
      b('rotary_table', 'Rotary Table'),
      n('max_weight_ejector_kg', 'Max Mould Weight [kg]'),
    ],
  },
  {
    group: 'Tool Connections',
    color: 'FFDAB9',
    columns: [
      n('temperature_control_circuits', 'Temp. Circuits'),
      n('cascade_count', 'Cascade Count'),
      b('hot_runner_integrated', 'Hot Runner Integrated'),
      b('hot_runner_external', 'Hot Runner External'),
      n('core_pulls_nozzle', 'Core Pulls Nozzle'),
      n('core_pulls_ejector', 'Core Pulls Ejector'),
      b('pneumatic_nozzle', 'Pneumatic Nozzle'),
      b('pneumatic_ejector', 'Pneumatic Ejector'),
      n('ejector_stroke_mm', 'Ejector Stroke [mm]'),
      t('ejector_thread', 'Ejector Thread'),
      n('ejector_max_travel_mm', 'Ejector Max Travel [mm]'),
    ],
  },
  {
    group: 'Interfaces',
    color: 'DDA0DD',
    columns: [
      t('mechanical_interface_tool', 'Mech. IF Tool'),
      t('mechanical_interface_robot', 'Mech. IF Robot'),
      t('electrical_interface_tool', 'Elec. IF Tool'),
      t('electrical_interface_hotrunner', 'Elec. IF Hot Runner'),
      t('electrical_interface_ejector', 'Elec. IF Ejector'),
      t('electrical_interface_corepull', 'Elec. IF Core Pull'),
      t('electrical_interface_robot', 'Elec. IF Robot'),
    ],
  },
  {
    group: 'Injection Unit 1',
    color: '90EE90',
    columns: [
      n('iu1_screw_diameter_mm', 'Screw Ø [mm]'),
      n('iu1_shot_volume_cm3', 'Barrel Volume [cm³]'),
      n('iu1_injection_flow_cm3s', 'Inj. Flow [cm³/s]'),
      n('iu1_plasticizing_rate_gs', 'Plast. Rate [g/s]'),
      n('iu1_ld_ratio', 'L/D Ratio'),
      n('iu1_injection_pressure_bar', 'Inj. Pressure [bar]'),
      n('iu1_shot_weight_g', 'Shot Weight [g]'),
      t('iu1_screw_type', 'Screw Type'),
      t('iu1_nozzle', 'Nozzle'),
    ],
  },
  {
    group: 'Injection Unit 2',
    color: 'FF8282',
    columns: [
      n('iu2_screw_diameter_mm', 'Screw Ø [mm]'),
      n('iu2_shot_volume_cm3', 'Barrel Volume [cm³]'),
      n('iu2_injection_flow_cm3s', 'Inj. Flow [cm³/s]'),
      n('iu2_plasticizing_rate_gs', 'Plast. Rate [g/s]'),
      n('iu2_ld_ratio', 'L/D Ratio'),
      n('iu2_injection_pressure_bar', 'Inj. Pressure [bar]'),
      n('iu2_shot_weight_g', 'Shot Weight [g]'),
      t('iu2_screw_type', 'Screw Type'),
      t('iu2_nozzle', 'Nozzle'),
    ],
  },
  {
    group: 'Robot',
    color: 'FFC0CB',
    columns: [
      t('robot_manufacturer', 'Robot Manufacturer'),
      t('robot_model', 'Robot Model'),
      t('robot_serial', 'Robot Serial'),
      n('robot_vacuum_circuits', 'Vacuum Circuits'),
      n('robot_air_circuits', 'Air Circuits'),
      n('robot_electrical_signals', 'Electrical Signals'),
    ],
  },
  {
    group: 'Additional Info',
    color: 'D3D3D3',
    columns: [
      t('special_controls', 'Special Controls'),
      t('remarks', 'Remarks'),
      t('plant_location', 'Facility'),
    ],
  },
];

// key -> group colour, so curated overview columns keep their category colour.
const KEY_COLOR = new Map<string, string>();
const KEY_GROUP = new Map<string, string>();
for (const g of FULL_GROUPS) {
  for (const c of g.columns) {
    KEY_COLOR.set(c.key, g.color);
    KEY_GROUP.set(c.key, g.group);
  }
}
const colorFor = (key: string): string => KEY_COLOR.get(key) || 'E5E7EB';

// Overview export — the key specs the user asked for.
const OVERVIEW_BASE: ExportColumn[] = [
  t('internal_name', 'Machine'),
  t('manufacturer', 'Manufacturer'),
  t('model', 'Model'),
  t('plant_location', 'Facility'),
  n('clamping_force_t', 'Clamping Force [t]'),
  n('clearance_horizontal_mm', 'Clearance H [mm]'),
  n('clearance_vertical_mm', 'Clearance V [mm]'),
  n('iu1_shot_volume_cm3', 'Barrel Volume [cm³]'),
  n('iu1_screw_diameter_mm', 'Cylinder Ø [mm]'),
  n('mold_height_max_mm', 'Max Tool Height [mm]'),
  n('opening_stroke_mm', 'Opening Stroke [mm]'),
];

// Second injection unit, appended only when any exported machine is 2K.
const OVERVIEW_2K: ExportColumn[] = [
  n('iu2_shot_volume_cm3', 'Barrel Volume 2 [cm³]'),
  n('iu2_screw_diameter_mm', 'Cylinder Ø 2 [mm]'),
];

function overviewColumns(rows: any[]): ExportColumn[] {
  const has2k = rows.some((r) => r.two_k_type || r.iu2_screw_diameter_mm != null);
  return has2k ? [...OVERVIEW_BASE, ...OVERVIEW_2K] : OVERVIEW_BASE;
}

// Overview is one logical group per category colour; for layout we just need the
// flat column list, but we still expose group bands for the HTML group header.
export function columnsFor(detail: Detail, rows: any[]): { groups: ExportGroup[]; flat: ExportColumn[] } {
  if (detail === 'full') {
    return { groups: FULL_GROUPS, flat: FULL_GROUPS.flatMap((g) => g.columns) };
  }
  const cols = overviewColumns(rows);
  return { groups: [{ group: 'Machine Overview', color: 'ADD8E6', columns: cols }], flat: cols };
}

export function facilityLabel(plant?: string): string {
  if (plant === 'USA') return 'USA';
  if (plant === 'Mexico') return 'Mexico';
  return 'All Facilities';
}

// --- value formatting -------------------------------------------------------

function numberValue(raw: any, key: string): number | null {
  const num = typeof raw === 'number' ? raw : parseFloat(raw);
  if (isNaN(num)) return null;
  if (key === 'clamping_force_t') return Math.round(num);
  return Math.round(num * 1000) / 1000;
}

function cellForExcel(raw: any, col: ExportColumn): string | number {
  if (raw === null || raw === undefined || raw === '') return '';
  if (col.bool || typeof raw === 'boolean') return raw ? 'Yes' : 'No';
  if (col.numeric) {
    const v = numberValue(raw, col.key);
    return v === null ? '' : v;
  }
  return String(raw);
}

function cellForText(raw: any, col: ExportColumn): string {
  if (raw === null || raw === undefined || raw === '') return '–';
  if (col.bool || typeof raw === 'boolean') return raw ? 'Yes' : 'No';
  if (col.numeric) {
    const v = numberValue(raw, col.key);
    return v === null ? '–' : String(v);
  }
  return String(raw);
}

// --- Excel ------------------------------------------------------------------

const THIN = { style: 'thin', color: { rgb: 'C0C7D0' } } as const;
const ALL_BORDERS = { top: THIN, bottom: THIN, left: THIN, right: THIN } as const;

export function buildWorkbook(rows: any[], detail: Detail, plant: string | undefined, dateStr: string): Buffer {
  const { groups, flat } = columnsFor(detail, rows);
  const facility = facilityLabel(plant);
  const isFull = detail === 'full';

  const aoa: (string | number)[][] = [];
  aoa.push([`KTX Machine List — ${facility} — ${isFull ? 'Full' : 'Overview'} — ${dateStr}`]);
  aoa.push([`${rows.length} machine(s)`]);
  aoa.push([]);

  const merges: any[] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(flat.length - 1, 0) } }];
  const groupRowIdx = aoa.length; // only used when full
  let labelRowIdx: number;

  if (isFull) {
    const groupRow: string[] = [];
    const labelRow: string[] = [];
    let col = 0;
    for (const g of groups) {
      for (let i = 0; i < g.columns.length; i++) {
        groupRow.push(i === 0 ? g.group : '');
        labelRow.push(g.columns[i].label);
      }
      if (g.columns.length > 1) {
        merges.push({ s: { r: groupRowIdx, c: col }, e: { r: groupRowIdx, c: col + g.columns.length - 1 } });
      }
      col += g.columns.length;
    }
    aoa.push(groupRow);
    aoa.push(labelRow);
    labelRowIdx = groupRowIdx + 1;
  } else {
    aoa.push(flat.map((c) => c.label));
    labelRowIdx = groupRowIdx;
  }

  const firstDataRow = labelRowIdx + 1;
  for (const row of rows) {
    aoa.push(flat.map((c) => cellForExcel(row[c.key], c)));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;

  const at = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

  // Title + count styling.
  const titleCell = ws[at(0, 0)];
  if (titleCell) titleCell.s = { font: { bold: true, sz: 14, color: { rgb: '111827' } }, alignment: { vertical: 'center' } };
  const countCell = ws[at(1, 0)];
  if (countCell) countCell.s = { font: { italic: true, sz: 10, color: { rgb: '6B7280' } } };

  // Group header row (full only): full-colour, bold, centred, wrapped.
  if (isFull) {
    let col = 0;
    for (const g of groups) {
      const cell = ws[at(groupRowIdx, col)];
      if (cell) {
        cell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: g.color } },
          font: { bold: true, sz: 11, color: { rgb: '1A1A1A' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: ALL_BORDERS,
        };
      }
      // border the rest of the merged span so the band reads as one block
      for (let i = 1; i < g.columns.length; i++) {
        const c2 = ws[at(groupRowIdx, col + i)];
        if (c2) c2.s = { fill: { patternType: 'solid', fgColor: { rgb: g.color } }, border: ALL_BORDERS };
      }
      col += g.columns.length;
    }
  }

  // Column label row: each cell tinted with its category colour, wrapped (no cut-off).
  flat.forEach((c, i) => {
    const cell = ws[at(labelRowIdx, i)];
    if (cell) {
      cell.s = {
        fill: { patternType: 'solid', fgColor: { rgb: colorFor(c.key) } },
        font: { bold: true, sz: 10, color: { rgb: '1A1A1A' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: ALL_BORDERS,
      };
    }
  });

  // Data cells: alignment, zebra striping, light borders.
  rows.forEach((_, ri) => {
    const r = firstDataRow + ri;
    const zebra = ri % 2 === 1;
    flat.forEach((c, i) => {
      const cell = ws[at(r, i)];
      if (!cell) return;
      cell.s = {
        alignment: { horizontal: c.numeric || c.bool ? 'right' : 'left', vertical: 'center' },
        border: ALL_BORDERS,
        font: { sz: 10, color: { rgb: '111827' } },
        ...(zebra ? { fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } } } : {}),
      };
    });
  });

  // Column widths: wide enough for the longest word (no mid-word break) but
  // narrow enough that multi-word labels wrap onto a few lines instead of going
  // vertical. wrapText (set above) then breaks them at spaces.
  const longestWord = (s: string) => s.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 0);
  ws['!cols'] = flat.map((c) => {
    if (c.key === 'internal_name') return { wch: Math.max(c.label.length, 20) };
    const lw = longestWord(c.label);
    const min = c.numeric || c.bool ? 9 : 11;
    return { wch: Math.min(Math.max(lw + 2, min), 18) };
  });

  // Row heights: header label row tall enough for ~3-4 wrapped lines.
  const rowsMeta: any[] = [];
  rowsMeta[0] = { hpt: 22 };
  if (isFull) rowsMeta[groupRowIdx] = { hpt: 20 };
  rowsMeta[labelRowIdx] = { hpt: 54 };
  ws['!rows'] = rowsMeta;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isFull ? 'Machines (Full)' : 'Machines');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// --- HTML -------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
}

export function buildHtml(rows: any[], detail: Detail, plant: string | undefined, dateStr: string): string {
  const { groups, flat } = columnsFor(detail, rows);
  const facility = facilityLabel(plant);
  const isFull = detail === 'full';
  const title = `KTX Machine List — ${facility} — ${isFull ? 'Full' : 'Overview'} — ${dateStr}`;

  // Group header row (always shown — for overview it is a single band).
  const groupCells = groups
    .map(
      (g) =>
        `<th colspan="${g.columns.length}" style="background:#${g.color}" class="grp">${esc(g.group)}</th>`,
    )
    .join('');

  const labelCells = flat
    .map((c) => `<th style="background:#${colorFor(c.key)}" class="${c.numeric || c.bool ? 'num' : ''}">${esc(c.label)}</th>`)
    .join('');

  const body = rows
    .map((row, ri) => {
      const tds = flat
        .map((c) => {
          const align = c.numeric || c.bool ? ' class="num"' : '';
          return `<td${align}>${esc(cellForText(row[c.key], c))}</td>`;
        })
        .join('');
      return `<tr class="${ri % 2 ? 'odd' : ''}">${tds}</tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, "Segoe UI", system-ui, Arial, sans-serif; color: #111827; background: #f8fafc; }
  .bar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between;
         gap: 16px; padding: 14px 22px; background: #0f172a; color: #fff; }
  .bar h1 { font-size: 16px; margin: 0; font-weight: 700; }
  .bar .meta { font-size: 12px; color: #cbd5e1; margin-top: 2px; }
  .bar button { background: #3b82f6; color: #fff; border: none; border-radius: 6px; padding: 8px 16px;
                font-size: 13px; font-weight: 600; cursor: pointer; }
  .wrap { padding: 18px 22px 40px; overflow-x: auto; }
  table { border-collapse: collapse; font-size: 12px; background: #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
  /* Labels wrap onto a few lines at word boundaries (never one char per line). */
  thead th { border: 1px solid #94a3b8; color: #111; font-weight: 700; padding: 7px 9px;
             text-align: center; vertical-align: bottom; line-height: 1.25;
             white-space: normal; word-break: normal; overflow-wrap: break-word; hyphens: auto;
             min-width: 74px; max-width: 132px; }
  thead th.num { min-width: 60px; }
  thead th:first-child { min-width: 150px; max-width: 320px; }
  thead tr.groups th.grp { font-size: 12px; letter-spacing: .3px; }
  thead tr.labels { position: sticky; top: 0; }
  tbody td { border: 1px solid #cbd5e1; padding: 5px 9px; white-space: nowrap; }
  tbody td.num, thead th.num { text-align: right; }
  tbody td:first-child { font-weight: 600; white-space: nowrap; position: sticky; left: 0; background: inherit; }
  tbody tr { background: #fff; }
  tbody tr.odd { background: #f3f4f6; }
  tbody tr:hover { background: #eff6ff; }
  @media print {
    .bar button { display: none; }
    .bar { position: static; background: #fff; color: #111; border-bottom: 2px solid #0f172a; }
    .bar .meta { color: #475569; }
    .wrap { padding: 0; overflow: visible; }
    thead { display: table-header-group; }
    thead tr.labels, tbody td:first-child { position: static; }
    table { box-shadow: none; font-size: 9px; }
    @page { size: A4 landscape; margin: 10mm; }
  }
</style>
</head>
<body>
  <div class="bar">
    <div>
      <h1>KTX Machine List — ${esc(facility)}</h1>
      <div class="meta">${isFull ? 'Full machine list' : 'Machine overview'} &nbsp;•&nbsp; ${rows.length} machine(s) &nbsp;•&nbsp; ${esc(dateStr)}</div>
    </div>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="wrap">
    <table>
      <thead>
        <tr class="groups">${groupCells}</tr>
        <tr class="labels">${labelCells}</tr>
      </thead>
      <tbody>
        ${body}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}
