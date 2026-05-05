import { useState } from 'react';
import type { CapacityCell, Tool } from '../../types/capacity';
import { ToolInfoCard } from './ToolInfoCard';

// Muted editorial palette — soft pastels in the v4 aesthetic, varied hues so tools are distinguishable.
const SEG_FILLS = [
  '#c3ddcd', // sage green
  '#cfe0d6', // pale moss
  '#d8d6cb', // warm stone
  '#e5d4c3', // sand
  '#e7cdc7', // dusty blush
  '#dcc9d6', // muted mauve
  '#cdc7d9', // soft lavender
  '#c5cee0', // pale slate
  '#bdd6e0', // dusty sky
  '#bcd9d3', // sea foam
  '#cad9b9', // pistachio
  '#dbd2a8', // muted ochre
];

// Stable color per tool_number — the same tool keeps the same swatch across years.
function colorForTool(toolNumber: string): string {
  let h = 0;
  for (let i = 0; i < toolNumber.length; i++) h = (h * 31 + toolNumber.charCodeAt(i)) >>> 0;
  return SEG_FILLS[h % SEG_FILLS.length];
}

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
  barHeight = 152,
}: {
  cells: CapacityCell[];
  tools?: Tool[];
  onHoverTool?: (toolNumber: string | null) => void;
  barHeight?: number;
}) {
  const [hover, setHover] = useState<HoverState>(null);
  const BAR_H = barHeight;

  // Compute shared scale once so the available line and bars are uniform across all year columns.
  const maxDemand = Math.max(...cells.map((c) => c.demand), 0);
  const available = cells[0]?.available ?? 1;
  const top = Math.max(available * 1.25, maxDemand, available);
  const scale = top > 0 ? BAR_H / top : BAR_H;
  const availLineFromBottom = available * scale;
  const anyOverrun = cells.some((c) => c.demand > c.available);

  return (
    <div style={{ position: 'relative', padding: '22px 0 6px' }}>
      {/* Single solid available-line spanning all year columns at a consistent Y. */}
      <div style={{
        position: 'absolute',
        left: 0, right: 0,
        bottom: 6 + availLineFromBottom,
        borderTop: `1.5px solid ${anyOverrun ? '#a84040' : '#1a1a1a'}`,
        zIndex: 5,
        pointerEvents: 'none',
      }} />
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cells.length}, 1fr)`,
        gap: 18,
      }}>
      {cells.map((cell, colIdx) => {

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
                {cell.available} mach
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
                      background: colorForTool(t.tool_number),
                      border: '1px solid rgba(20,20,30,0.10)',
                      boxSizing: 'border-box',
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

                    {/* Hover infocard — anchor away from container edges */}
                    {isHovered && fullTool && (
                      <ToolInfoCard
                        tool={fullTool}
                        machEquiv={t.mach_equivalents}
                        year={cell.year}
                        piecesPerYear={undefined}
                        align={colIdx <= 1 ? 'left' : colIdx >= cells.length - 2 ? 'right' : 'center'}
                      />
                    )}
                  </div>
                );
              })}

              {/* Overrun band: subtle red wash above the available line when demand > available */}
              {cell.demand > cell.available && (
                <div style={{
                  position: 'absolute',
                  left: 0, right: 0,
                  bottom: availLineFromBottom,
                  height: BAR_H - availLineFromBottom,
                  background: 'rgba(168,64,64,0.06)',
                  pointerEvents: 'none',
                  zIndex: 1,
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
    </div>
  );
}
