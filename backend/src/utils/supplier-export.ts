// Supplier (toolmaker) machine package: a ZIP holding an Excel workbook plus the
// machine drawings at original resolution. The workbook hides internal columns
// (order/serial numbers, year, robot serial, remarks), shows small compressed
// reference thumbnails on a "Drawings" sheet, and links every thumbnail to the
// full-size original inside the ZIP.
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import { FULL_GROUPS, ExportGroup, ExportColumn, facilityLabel } from './machine-export.js';

// Columns never shown to an external supplier.
export const SUPPLIER_HIDDEN = new Set([
  'order_number',
  'serial_number',
  'year_of_construction',
  'robot_serial',
  'remarks',
]);

export const SUPPLIER_GROUPS: ExportGroup[] = FULL_GROUPS.map((g) => ({
  ...g,
  columns: g.columns.filter((c) => !SUPPLIER_HIDDEN.has(c.key)),
})).filter((g) => g.columns.length > 0);

// File types bundled as drawings (WAM = mould clamping dimension drawings).
export const DRAWING_FILE_TYPES = ['drawing', 'wam'];

export interface DrawingFile {
  machine: string; // internal_name
  fileName: string; // original file name
  description: string | null;
  data: Buffer;
}

const THUMB_W = 320;
const THUMB_H = 240;
const THUMB_ROW_PT = 186; // ~THUMB_H px + padding

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').trim() || 'file';

/** Assign each drawing a unique path inside the ZIP: drawings/<machine>/<file>. */
export function zipPaths(files: DrawingFile[]): string[] {
  const used = new Set<string>();
  return files.map((f) => {
    const dir = `drawings/${safe(f.machine)}`;
    const base = safe(f.fileName);
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : '';
    let p = `${dir}/${base}`;
    for (let i = 2; used.has(p.toLowerCase()); i++) p = `${dir}/${stem}_${i}${ext}`;
    used.add(p.toLowerCase());
    return p;
  });
}

/** Small JPEG reference picture, or null when the file is not a raster image. */
export async function thumbnail(data: Buffer): Promise<{ buf: Buffer; w: number; h: number } | null> {
  try {
    // WAM scans can exceed sharp's default pixel limit; files are our own uploads.
    const { data: buf, info } = await sharp(data, { pages: 1, limitInputPixels: false })
      .flatten({ background: '#ffffff' })
      .resize({ width: THUMB_W, height: THUMB_H, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer({ resolveWithObject: true });
    return { buf, w: info.width, h: info.height };
  } catch {
    return null;
  }
}

function numberValue(raw: any, key: string): number | null {
  const num = typeof raw === 'number' ? raw : parseFloat(raw);
  if (isNaN(num)) return null;
  if (key === 'clamping_force_t') return Math.round(num);
  return Math.round(num * 1000) / 1000;
}

function cellValue(raw: any, col: ExportColumn): string | number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (col.bool || typeof raw === 'boolean') return raw ? 'Yes' : 'No';
  if (col.numeric) return numberValue(raw, col.key);
  return String(raw);
}

const solid = (rgb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + rgb } });
const THIN: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFC0C7D0' } };
const BORDERS: Partial<ExcelJS.Borders> = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const LINK_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FF1D4ED8' }, underline: true, size: 10 };

export async function buildSupplierWorkbook(
  rows: any[],
  files: DrawingFile[],
  paths: string[],
  plant: string | undefined,
  dateStr: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KTX MachineDB';
  const facility = facilityLabel(plant);

  // --- Machines sheet ---------------------------------------------------------
  const ws = wb.addWorksheet('Machines', { views: [{ state: 'frozen', xSplit: 1, ySplit: 5 }] });
  const flat = SUPPLIER_GROUPS.flatMap((g) => g.columns);
  const nCols = flat.length + 1; // + Drawings column
  const colorOf = new Map<string, string>();
  SUPPLIER_GROUPS.forEach((g) => g.columns.forEach((c) => colorOf.set(c.key, g.color)));

  ws.addRow([`KTX Machine Data for Mould Design — ${facility} — ${dateStr}`]).font = { bold: true, size: 14 };
  ws.addRow([`${rows.length} machine(s). Drawings: see sheet "Drawings" (thumbnails) and folder "drawings" in this package (full resolution).`])
    .font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
  ws.addRow([]);
  ws.mergeCells(1, 1, 1, nCols);

  const groupRow = ws.addRow([]);
  const labelRow = ws.addRow([...flat.map((c) => c.label), 'Drawings']);
  let col = 1;
  for (const g of SUPPLIER_GROUPS) {
    const cell = groupRow.getCell(col);
    cell.value = g.group;
    if (g.columns.length > 1) ws.mergeCells(groupRow.number, col, groupRow.number, col + g.columns.length - 1);
    for (let i = 0; i < g.columns.length; i++) {
      const c = groupRow.getCell(col + i);
      c.fill = solid(g.color);
      c.border = BORDERS;
    }
    cell.font = { bold: true, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    col += g.columns.length;
  }
  const drawGroup = groupRow.getCell(nCols);
  drawGroup.value = 'Drawings';
  drawGroup.fill = solid('E5E7EB');
  drawGroup.border = BORDERS;
  drawGroup.font = { bold: true, size: 11 };
  drawGroup.alignment = { horizontal: 'center', vertical: 'middle' };
  groupRow.height = 20;

  labelRow.eachCell((cell, i) => {
    const key = flat[i - 1]?.key;
    cell.fill = solid((key && colorOf.get(key)) || 'E5E7EB');
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDERS;
  });
  labelRow.height = 54;

  // First drawing row per machine on the Drawings sheet (filled below).
  const firstDrawingRow = new Map<string, number>();
  const countByMachine = new Map<string, number>();
  files.forEach((f, i) => {
    countByMachine.set(f.machine, (countByMachine.get(f.machine) || 0) + 1);
    if (!firstDrawingRow.has(f.machine)) firstDrawingRow.set(f.machine, i + 4);
  });

  rows.forEach((row, ri) => {
    const r = ws.addRow([...flat.map((c) => cellValue(row[c.key], c)), null]);
    r.eachCell({ includeEmpty: true }, (cell, i) => {
      const c = flat[i - 1];
      cell.border = BORDERS;
      cell.font = { size: 10 };
      cell.alignment = { horizontal: c && (c.numeric || c.bool) ? 'right' : 'left', vertical: 'middle' };
      if (ri % 2 === 1) cell.fill = solid('F3F4F6');
    });
    const n = countByMachine.get(row.internal_name) || 0;
    const dc = r.getCell(nCols);
    if (n > 0) {
      dc.value = { text: `${n} drawing(s)`, hyperlink: `#'Drawings'!A${firstDrawingRow.get(row.internal_name)}` };
      dc.font = LINK_FONT;
    } else {
      dc.value = '–';
    }
  });

  const longestWord = (s: string) => s.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 0);
  flat.forEach((c, i) => {
    const min = c.numeric || c.bool ? 9 : 11;
    ws.getColumn(i + 1).width = c.key === 'internal_name' ? 14 : Math.min(Math.max(longestWord(c.label) + 2, min), 18);
  });
  ws.getColumn(nCols).width = 14;

  // --- Drawings sheet ---------------------------------------------------------
  const ds = wb.addWorksheet('Drawings', { views: [{ state: 'frozen', ySplit: 3 }] });
  ds.columns = [
    { width: 12 }, // Machine
    { width: 22 }, // Model
    { width: 46 }, // Description
    { width: 48 }, // Reference picture
    { width: 44 }, // Full-resolution file
  ];
  ds.addRow([`Machine drawings — reference thumbnails. Click the file link for the full-resolution original (folder "drawings" in this package).`])
    .font = { bold: true, size: 12 };
  ds.addRow([]);
  const dh = ds.addRow(['Machine', 'Model', 'Description', 'Reference picture', 'Full-resolution file']);
  dh.eachCell((c) => {
    c.fill = solid('E5E7EB');
    c.font = { bold: true, size: 10 };
    c.border = BORDERS;
    c.alignment = { vertical: 'middle' };
  });

  const modelOf = new Map<string, string>();
  rows.forEach((r) => modelOf.set(r.internal_name, [r.manufacturer, r.model].filter(Boolean).join(' ')));

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const r = ds.addRow([f.machine, modelOf.get(f.machine) || '', f.description || '', null, null]);
    const link = r.getCell(5);
    link.value = { text: paths[i], hyperlink: paths[i] };
    link.font = LINK_FONT;
    r.eachCell({ includeEmpty: true }, (c) => {
      c.border = BORDERS;
      c.alignment = { vertical: 'top', wrapText: true };
    });
    const thumb = await thumbnail(f.data);
    if (thumb) {
      r.height = THUMB_ROW_PT;
      const id = wb.addImage({ buffer: thumb.buf as any, extension: 'jpeg' });
      ds.addImage(id, {
        tl: { col: 3.05, row: r.number - 1 + 0.03 },
        ext: { width: thumb.w, height: thumb.h },
        hyperlinks: { hyperlink: paths[i], tooltip: 'Open full-resolution drawing' },
      } as any);
    } else {
      r.getCell(4).value = '(no preview — open the file)';
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// --- ZIP (stored, no compression: drawings keep their original bytes) -------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function buildStoredZip(entries: { name: string; data: Buffer }[], when = new Date()): Buffer {
  const dosTime = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
  const dosDate = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const crc = crc32(e.data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4); // version needed
    lh.writeUInt16LE(0x0800, 6); // UTF-8 names
    lh.writeUInt16LE(0, 8); // method: stored
    lh.writeUInt16LE(dosTime, 10);
    lh.writeUInt16LE(dosDate, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(e.data.length, 18);
    lh.writeUInt32LE(e.data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, name, e.data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4); // version made by
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(dosTime, 12);
    ch.writeUInt16LE(dosDate, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(e.data.length, 20);
    ch.writeUInt32LE(e.data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += 30 + name.length + e.data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}
