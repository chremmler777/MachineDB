import { useState } from 'react';
import type { CapacityCell, Tool } from '../../types/capacity';
import { ToolInfoCard } from './ToolInfoCard';

// seg-1 through seg-4 cycling greens from v4
const SEG_FILLS = [
  '#d6e8de', // seg-1
  '#c3ddcd', // seg-2
  '#b0d2bc', // seg-3
  '#9dc7ab', // seg-4
  '#88baa0',
  '#74ae95',
  '#5fa189',
];

function statusFreeColor(status: CapacityCell['status']): string {
  switch (status) {
    case 'red':    return '#a84040';
    case 'orange': return '#b06a3a';
    case 'yellow': return '#b8862a';
    default:       return '#2f6f4f';
  }
}

type HoverState = { year: number; toolNumber: string } | null;

export function StackedBarChart({
  cells,
  tools = [],
  onHoverTool,
}: {
  cells: CapacityCell[];
  tools?: Tool[];
  onHoverTool?: (toolNumber: string | null) => void;
}) {
  const [hover, setHover] = useState<HoverState>(null);
  const BAR_H = 152;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cells.length}, 1fr)`,
      gap: 18,
      padding: '22px 0 6px',
    }}>
      {cells.map((cell) => {
        // Scale: BAR_H pixels = available machines
        const scale = cell.available > 0 ? BAR_H / cell.available : BAR_H;

        let cumulative = 0;

        return (
          <div key={cell.year} style={{ position: 'relative' }}>
            {/* Year head: year label + available count */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'baseline', marginBottom: 8,
              fontSize: 11, color: '#8a8a8e',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              <span style={{
                color: '#1a1a1a', fontWeight: 500, letterSpacing: 0,
                textTransform: 'none',
                fontFamily: "'Geist Mono', monospace", fontSize: 12,
              }}>
                {cell.year}
              </span>
              <span style={{ fontFamily: "'Geist Mono', monospace" }}>
                {cell.available.toFixed(2)}
              </span>
            </div>

            {/* Bar stack */}
            <div style={{
              position: 'relative',
              height: BAR_H,
              borderRadius: 8,
              overflow: 'visible',
              background: 'repeating-linear-gradient(to top, transparent 0, transparent 24px, #ececea 24px, #ececea 25px)',
            }}>
              {/* Available capacity dashed line at the top of full bar */}
              <div style={{
                position: 'absolute', left: -4, right: -4,
                borderTop: '1.5px dashed #1a1a1a',
                zIndex: 5,
                bottom: BAR_H,
              }} />

              {/* Avail tag — only shown if line is visible within bar */}
              <div style={{
                position: 'absolute', right: 0, top: -16,
                fontSize: 10, color: '#5a5a5e',
                fontFamily: "'Geist Mono', monospace", letterSpacing: 0,
              }}>
                {cell.available.toFixed(2)}
              </div>

              {/* Tool segments stacked bottom-up */}
              {cell.contributing_tools.map((t, i) => {
                const segHeight = Math.max(t.mach_equivalents * scale, 0);
                const segBottom = cumulative;
                cumulative += segHeight;

                const isHovered = hover?.year === cell.year && hover.toolNumber === t.tool_number;
                const fullTool = tools.find((ft) => ft.tool_number === t.tool_number);

                return (
                  <div
                    key={t.tool_number}
                    style={{
                      position: 'absolute',
                      left: 4, right: 4,
                      borderRadius: 3,
                      cursor: 'pointer',
                      transition: 'filter 180ms cubic-bezier(0.16, 1, 0.3, 1)',
                      bottom: segBottom,
                      height: segHeight,
                      background: SEG_FILLS[i % SEG_FILLS.length],
                      filter: isHovered ? 'brightness(1.04)' : undefined,
                      outline: isHovered ? '1.5px solid #1a1a1a' : undefined,
                      outlineOffset: isHovered ? -1 : undefined,
                      zIndex: isHovered ? 4 : undefined,
                    }}
                    title={`${t.tool_number} · ${t.mach_equivalents.toFixed(2)} mach`}
                    onMouseEnter={() => {
                      setHover({ year: cell.year, toolNumber: t.tool_number });
                      onHoverTool?.(t.tool_number);
                    }}
                    onMouseLeave={() => {
                      setHover(null);
                      onHoverTool?.(null);
                    }}
                  >
                    {segHeight > 14 && (
                      <span style={{
                        position: 'absolute',
                        left: 7, right: 7, bottom: 3,
                        fontSize: 10.5,
                        color: 'rgba(0,0,0,0.62)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        fontFamily: "'Geist Mono', monospace",
                        display: 'block',
                      }}>
                        {t.tool_number}
                      </span>
                    )}

                    {/* Hover infocard */}
                    {isHovered && fullTool && (
                      <ToolInfoCard
                        tool={fullTool}
                        machEquiv={t.mach_equivalents}
                        year={cell.year}
                        piecesPerYear={undefined}
                      />
                    )}
                  </div>
                );
              })}

              {/* Demand overflow indicator if demand > available */}
              {cell.demand > cell.available && (
                <div style={{
                  position: 'absolute',
                  left: 4, right: 4,
                  bottom: BAR_H,
                  height: Math.min((cell.demand - cell.available) * scale, 20),
                  background: 'rgba(168,64,64,0.12)',
                  borderRadius: 3,
                  border: '1px dashed #a84040',
                }} />
              )}
            </div>

            {/* Year foot: free + util */}
            <div style={{
              marginTop: 10,
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              fontSize: 11.5,
            }}>
              <span style={{
                fontFamily: "'Geist Mono', monospace",
                fontWeight: 500,
                color: statusFreeColor(cell.status),
              }}>
                {cell.free >= 0 ? '+' : ''}{cell.free.toFixed(2)} free
              </span>
              <span style={{
                color: '#8a8a8e',
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
              }}>
                {cell.utilization_pct.toFixed(0)}%
              </span>
            </div>

          </div>
        );
      })}
    </div>
  );
}
