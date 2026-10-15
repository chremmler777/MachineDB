// Supplier export: stored ZIP round-trips byte-for-byte, internal columns are
// hidden, and the workbook carries one compressed thumbnail per raster drawing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import {
  buildStoredZip, buildSupplierWorkbook, zipPaths, SUPPLIER_GROUPS, crc32, DrawingFile,
} from '../utils/supplier-export.js';

const bigPng = () =>
  sharp({ create: { width: 2000, height: 1500, channels: 3, background: '#ffffff' } }).png().toBuffer();

test('crc32 matches the reference value', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('stored zip extracts with unzip-compatible tooling, bytes unchanged', () => {
  const a = Buffer.from('hello');
  const b = Buffer.alloc(70000, 7);
  const zip = buildStoredZip([{ name: 'x.txt', data: a }, { name: 'drawings/M01/ä.bin', data: b }]);
  const dir = mkdtempSync(join(tmpdir(), 'zip-'));
  writeFileSync(join(dir, 't.zip'), zip);
  const out = execFileSync('python3', ['-I', '-c',
    'import zipfile,sys,hashlib;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;' +
    'print(";".join(f"{i.filename}:{i.compress_type}:{len(z.read(i))}" for i in z.infolist()))',
    join(dir, 't.zip')]).toString().trim();
  assert.equal(out, 'x.txt:0:5;drawings/M01/ä.bin:0:70000');
});

test('zipPaths sanitises and de-duplicates per machine', () => {
  const f = (machine: string, fileName: string): DrawingFile => ({ machine, fileName, description: null, data: Buffer.alloc(0) });
  assert.deepEqual(zipPaths([f('KM 80-1', 'a b.png'), f('KM 80-1', 'a b.png'), f('M01', 'x/y.tif')]), [
    'drawings/KM_80-1/a_b.png', 'drawings/KM_80-1/a_b_2.png', 'drawings/M01/x_y.tif',
  ]);
});

test('supplier workbook hides internal columns and embeds small thumbnails', async () => {
  const keys = SUPPLIER_GROUPS.flatMap((g) => g.columns.map((c) => c.key));
  for (const k of ['order_number', 'serial_number', 'year_of_construction', 'robot_serial', 'remarks']) {
    assert.ok(!keys.includes(k), `${k} must be hidden`);
  }
  assert.ok(keys.includes('clearance_horizontal_mm'));

  const rows = [
    { id: 1, internal_name: 'M01', manufacturer: 'ARBURG', model: 'ALLROUNDER', serial_number: 'SECRET-123', clamping_force_t: 220 },
    { id: 2, internal_name: 'M5', manufacturer: 'NISSEI', model: 'NEX80', clamping_force_t: 80 },
  ];
  const png = await bigPng();
  const files: DrawingFile[] = [
    { machine: 'M01', fileName: 'fixed.png', description: 'Fixed platen', data: png },
    { machine: 'M01', fileName: 'spec.pdf', description: 'Spec', data: Buffer.from('%PDF-1.4') },
  ];
  const paths = zipPaths(files);
  const buf = await buildSupplierWorkbook(rows, files, paths, 'Mexico', '2026-10-15');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ms = wb.getWorksheet('Machines')!;
  const all = JSON.stringify(ms.getSheetValues());
  assert.ok(!all.includes('SECRET-123'));
  assert.ok(all.includes('1 drawing(s)') === false && all.includes('2 drawing(s)'));

  const ds = wb.getWorksheet('Drawings')!;
  const imgs = ds.getImages();
  assert.equal(imgs.length, 1, 'thumbnail only for the raster image');
  const media = (wb as any).model.media as { buffer: Buffer }[];
  assert.equal(media.length, 1);
  assert.ok(media[0].buffer.length < png.length, 'thumbnail is smaller than the original');
  const meta = await sharp(media[0].buffer).metadata();
  assert.ok(meta.width! <= 320 && meta.height! <= 240);
  assert.equal(meta.format, 'jpeg');
  assert.equal((ds.getCell('E4').value as any).hyperlink, 'drawings/M01/fixed.png');
});
