import type { CapacityCell } from '../../types/capacity';

const COLOR_FILL: Record<string, string> = {
  green: '#e9f2ec',
  yellow: '#f5edda',
  orange: '#f4e4d6',
  red: '#f3dada',
};

const COLOR_STROKE: Record<string, string> = {
  green: '#2f6f4f',
  yellow: '#b8862a',
  orange: '#b06a3a',
  red: '#a84040',
};

export function Sparkline({ cells }: { cells: CapacityCell[] }) {
  const maxAvail = Math.max(...cells.map((c) => c.available), 1);
  const barW = 38;
  const gap = 8;
  const h = 38;
  const totalW = cells.length * (barW + gap);

  return (
    <svg
      style={{ width: '100%', height: h, display: 'block' }}
      viewBox={`0 0 ${totalW} ${h}`}
      preserveAspectRatio="none"
    >
      {/* Baseline dashed line at available capacity (top) */}
      <line
        x1={0}
        y1={5}
        x2={totalW}
        y2={5}
        stroke="#1a1a1a"
        strokeDasharray="2 3"
        strokeWidth={1}
      />
      {cells.map((c, i) => {
        const value = Math.max(c.demand, 0);
        const barHeight = Math.min(value / maxAvail, 1) * (h - 6);
        return (
          <rect
            key={c.year}
            x={i * (barW + gap) + 6}
            y={h - barHeight}
            width={barW}
            height={barHeight}
            fill={COLOR_FILL[c.status]}
            stroke={COLOR_STROKE[c.status]}
            rx={2}
          />
        );
      })}
    </svg>
  );
}
