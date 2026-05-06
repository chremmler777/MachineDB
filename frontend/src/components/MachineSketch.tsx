import React, { useState } from 'react';

type BoltHole = { x_mm: number; y_mm: number; thread?: string };
type SideHoles = BoltHole[];
type BoltPattern = { fixed?: SideHoles; moving?: SideHoles } | SideHoles | null | undefined;

interface Props {
  machine: any;
  initialToolH?: number;
  initialToolV?: number;
  darkMode?: boolean;
}

const num = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
};

const holesFor = (bp: BoltPattern, side: 'fixed' | 'moving'): BoltHole[] => {
  if (!bp) return [];
  if (Array.isArray(bp)) return bp; // legacy: same pattern both sides
  return bp[side] || [];
};

interface PlatenViewProps {
  side: 'fixed' | 'moving';
  clearH: number;
  clearV: number;
  platenH: number | null;
  platenV: number | null;
  minMoldH: number | null;
  minMoldV: number | null;
  ringDia: number | null;
  ejectorHoleDia: number | null;
  tiebarDia: number;
  holes: BoltHole[];
  knockouts: BoltHole[];
  toolH: number | null;
  toolV: number | null;
  darkMode: boolean;
}

const PlatenView: React.FC<PlatenViewProps> = ({ side, clearH, clearV, platenH, platenV, minMoldH, minMoldV, ringDia, ejectorHoleDia, tiebarDia, holes, knockouts, toolH, toolV, darkMode }) => {
  const extentH = platenH ?? (clearH + tiebarDia * 2 + 80);
  const extentV = platenV ?? (clearV + tiebarDia * 2 + 80);
  const canvas = 700;
  const scale = canvas / Math.max(extentH, extentV);
  const cx = 400;
  const cy = 400;
  const mm = (v: number) => v * scale;

  const tiebarOffsetX = clearH / 2 + tiebarDia / 2;
  const tiebarOffsetY = clearV / 2 + tiebarDia / 2;
  const tiebarR = mm(tiebarDia / 2);

  const stroke = darkMode ? '#e5e7eb' : '#111827';
  const subtle = darkMode ? '#9ca3af' : '#6b7280';
  const accent = '#3b82f6';
  const tool = '#ef4444';

  const title = side === 'fixed' ? 'Fixed side (nozzle)' : 'Moving side (ejector)';

  return (
    <div style={{ flex: '1 1 320px', minWidth: '320px' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: stroke, marginBottom: '6px', textAlign: 'center' }}>{title}</div>
      <svg viewBox="0 0 800 800" style={{ width: '100%', background: darkMode ? '#0f172a' : '#fafafa', border: `1px solid ${subtle}`, borderRadius: '6px' }}>
        {platenH && platenV && (
          <rect x={cx - mm(platenH)/2} y={cy - mm(platenV)/2} width={mm(platenH)} height={mm(platenV)} fill="none" stroke={stroke} strokeWidth={1.5} />
        )}
        <rect x={cx - mm(clearH)/2} y={cy - mm(clearV)/2} width={mm(clearH)} height={mm(clearV)} fill="none" stroke={subtle} strokeWidth={1} strokeDasharray="4 3" />
        <text x={cx} y={cy - mm(clearV)/2 - 6} fontSize="10" fill={subtle} textAnchor="middle">clear {clearH} × {clearV}</text>

        {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx, sy], i) => (
          <circle key={i} cx={cx + sx * mm(tiebarOffsetX)} cy={cy + sy * mm(tiebarOffsetY)} r={tiebarR} fill={subtle} fillOpacity={0.3} stroke={stroke} strokeWidth={1} />
        ))}

        {minMoldH && minMoldV && (
          <rect x={cx - mm(minMoldH)/2} y={cy - mm(minMoldV)/2} width={mm(minMoldH)} height={mm(minMoldV)} fill="none" stroke="#f59e0b" strokeWidth={1} strokeDasharray="6 3" />
        )}

        {ringDia && (
          <circle cx={cx} cy={cy} r={mm(ringDia/2)} fill="none" stroke={accent} strokeWidth={1.2} />
        )}
        {side === 'moving' && ejectorHoleDia && (
          <circle cx={cx} cy={cy} r={mm(ejectorHoleDia/2)} fill="none" stroke={accent} strokeWidth={1} strokeDasharray="3 2" />
        )}

        {holes.map((h, i) => (
          <circle key={i} cx={cx + mm(h.x_mm)} cy={cy + mm(h.y_mm)} r={3} fill={accent} fillOpacity={0.7}>
            {h.thread && <title>{h.thread}</title>}
          </circle>
        ))}
        {side === 'moving' && knockouts.map((h, i) => (
          <g key={`ko-${i}`}>
            <circle cx={cx + mm(h.x_mm)} cy={cy + mm(h.y_mm)} r={4} fill="none" stroke="#10b981" strokeWidth={1.2} />
            <line x1={cx + mm(h.x_mm) - 5} y1={cy + mm(h.y_mm)} x2={cx + mm(h.x_mm) + 5} y2={cy + mm(h.y_mm)} stroke="#10b981" strokeWidth={1} />
            <line x1={cx + mm(h.x_mm)} y1={cy + mm(h.y_mm) - 5} x2={cx + mm(h.x_mm)} y2={cy + mm(h.y_mm) + 5} stroke="#10b981" strokeWidth={1} />
            {h.thread && <title>{h.thread}</title>}
          </g>
        ))}

        {toolH && toolV && (
          <rect x={cx - mm(toolH)/2} y={cy - mm(toolV)/2} width={mm(toolH)} height={mm(toolV)} fill={tool} fillOpacity={0.18} stroke={tool} strokeWidth={1.5} />
        )}

        <line x1={cx-8} y1={cy} x2={cx+8} y2={cy} stroke={subtle} strokeWidth={0.5} />
        <line x1={cx} y1={cy-8} x2={cx} y2={cy+8} stroke={subtle} strokeWidth={0.5} />
      </svg>
    </div>
  );
};

export const MachineSketch: React.FC<Props> = ({ machine, initialToolH, initialToolV, darkMode = true }) => {
  const clearH = num(machine.clearance_horizontal_mm);
  const clearV = num(machine.clearance_vertical_mm);
  const platenH = num(machine.platen_horizontal_mm);
  const platenV = num(machine.platen_vertical_mm);
  const minMoldH = num(machine.min_mold_horizontal_mm);
  const minMoldV = num(machine.min_mold_vertical_mm);
  const ringNozzle = num(machine.centering_ring_nozzle_mm);
  const ringEjector = num(machine.centering_ring_ejector_mm);
  const ejectorHole = num(machine.ejector_hole_diameter_mm);
  const tiebarDiaRaw = num(machine.tiebar_diameter_mm);
  // fallback estimate from clamping force (rough rule of thumb)
  const cf = num(machine.clamping_force_t);
  const tiebarDia = tiebarDiaRaw ?? (cf ? Math.round(Math.max(40, Math.sqrt(cf) * 6)) : 60);

  const [toolH, setToolH] = useState<string>(initialToolH ? String(initialToolH) : '');
  const [toolV, setToolV] = useState<string>(initialToolV ? String(initialToolV) : '');
  const tH = num(toolH);
  const tV = num(toolV);

  if (!clearH || !clearV) {
    return (
      <div style={{ padding: '16px', color: '#fbbf24', background: 'rgba(251,191,36,0.1)', borderRadius: '6px', fontSize: '13px' }}>
        No tiebar clearance data — can't render sketch. Need <code>clearance_horizontal_mm</code> and <code>clearance_vertical_mm</code>.
      </div>
    );
  }

  const stroke = darkMode ? '#e5e7eb' : '#111827';
  const subtle = darkMode ? '#9ca3af' : '#6b7280';
  const accent = '#3b82f6';
  const tool = '#ef4444';

  const fitsBetweenTiebars = tH !== null && tV !== null && tH <= clearH && tV <= clearV;
  const fitsMinMold = (minMoldH === null || tH === null || tH >= minMoldH) && (minMoldV === null || tV === null || tV >= minMoldV);

  const holesFixed = holesFor(machine.bolt_pattern_json, 'fixed');
  const holesMoving = holesFor(machine.bolt_pattern_json, 'moving');
  const knockouts: BoltHole[] = Array.isArray(machine.knockout_pattern_json) ? machine.knockout_pattern_json : [];

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '12px', color: subtle }}>Tool H (mm)
          <input type="number" value={toolH} onChange={e => setToolH(e.target.value)} style={{ marginLeft: '6px', width: '80px', padding: '3px 6px', border: `1px solid ${subtle}`, borderRadius: '3px', background: 'transparent', color: stroke }} />
        </label>
        <label style={{ fontSize: '12px', color: subtle }}>Tool V (mm)
          <input type="number" value={toolV} onChange={e => setToolV(e.target.value)} style={{ marginLeft: '6px', width: '80px', padding: '3px 6px', border: `1px solid ${subtle}`, borderRadius: '3px', background: 'transparent', color: stroke }} />
        </label>
        {tH !== null && tV !== null && (
          <span style={{ fontSize: '12px', fontWeight: 600, color: fitsBetweenTiebars && fitsMinMold ? '#10b981' : '#ef4444' }}>
            {fitsBetweenTiebars ? '✓ fits tiebars' : '✗ exceeds tiebar clear'}
            {' · '}
            {fitsMinMold ? '✓ ≥ min mold' : '✗ below min mold'}
          </span>
        )}
        <span style={{ fontSize: '11px', color: subtle, marginLeft: 'auto' }}>
          tiebar ⌀ {tiebarDia} mm{tiebarDiaRaw ? '' : ' (estimated)'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <PlatenView side="fixed" clearH={clearH} clearV={clearV} platenH={platenH} platenV={platenV} minMoldH={minMoldH} minMoldV={minMoldV} ringDia={ringNozzle} ejectorHoleDia={null} tiebarDia={tiebarDia} holes={holesFixed} knockouts={[]} toolH={tH} toolV={tV} darkMode={darkMode} />
        <PlatenView side="moving" clearH={clearH} clearV={clearV} platenH={platenH} platenV={platenV} minMoldH={minMoldH} minMoldV={minMoldV} ringDia={ringEjector} ejectorHoleDia={ejectorHole} tiebarDia={tiebarDia} holes={holesMoving} knockouts={knockouts} toolH={tH} toolV={tV} darkMode={darkMode} />
      </div>

      <div style={{ marginTop: '8px', fontSize: '11px', color: subtle, display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: stroke, marginRight: '4px' }} /> platen</span>
        <span><span style={{ display: 'inline-block', width: '10px', height: '2px', background: subtle, marginRight: '4px', verticalAlign: 'middle' }} /> tiebar clear</span>
        <span><span style={{ display: 'inline-block', width: '10px', height: '2px', background: '#f59e0b', marginRight: '4px', verticalAlign: 'middle' }} /> min mold</span>
        <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', border: `1px solid ${accent}`, marginRight: '4px', verticalAlign: 'middle' }} /> centering ring</span>
        <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: tool, opacity: 0.4, marginRight: '4px' }} /> tool</span>
        <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', border: '1px solid #10b981', marginRight: '4px', verticalAlign: 'middle' }} /> knockouts (moving)</span>
      </div>
    </div>
  );
};

export default MachineSketch;
