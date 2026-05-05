import type { CapacityCell } from '../../types/capacity';

const SEG_FILLS = [
  '#d6e8de',
  '#c3ddcd',
  '#b0d2bc',
  '#9dc7ab',
  '#88baa0',
  '#74ae95',
  '#5fa189',
];

function statusTextClass(status: CapacityCell['status']): string {
  switch (status) {
    case 'red':
      return 'text-[#a84040]';
    case 'orange':
      return 'text-[#b06a3a]';
    case 'yellow':
      return 'text-[#b8862a]';
    default:
      return 'text-[#2f6f4f]';
  }
}

export function StackedBarChart({
  cells,
  onHoverTool,
}: {
  cells: CapacityCell[];
  onHoverTool?: (toolNumber: string | null) => void;
}) {
  const BAR_H = 152;

  return (
    <div className="grid gap-4 pt-5" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
      {cells.map((cell) => {
        const scale = cell.available > 0 ? BAR_H / cell.available : BAR_H;
        let cumulative = 0;

        return (
          <div key={cell.year} className="relative">
            {/* Year label + demand value */}
            <div className="flex justify-between items-baseline mb-2 text-[11px] text-[#8a8a8e] uppercase tracking-wider">
              <span className="font-mono text-xs text-[#1a1a1a] normal-case tracking-normal">
                {cell.year}
              </span>
              <span className="font-mono">{cell.demand.toFixed(2)}</span>
            </div>

            {/* Bar area */}
            <div
              className="relative rounded-md overflow-visible"
              style={{
                height: BAR_H,
                background:
                  'repeating-linear-gradient(to top, transparent 0, transparent 24px, #ececea 24px, #ececea 25px)',
              }}
            >
              {/* Available capacity dashed line */}
              <div
                className="absolute -left-1 -right-1 border-t-[1.5px] border-dashed border-[#1a1a1a] z-[5]"
                style={{ top: 0 }}
              />

              {/* Tool segments stacked bottom-up */}
              {cell.contributing_tools.map((t, i) => {
                const segHeight = Math.max(t.mach_equivalents * scale, 0);
                const segBottom = cumulative;
                cumulative += segHeight;
                return (
                  <div
                    key={t.tool_number}
                    className="absolute left-1 right-1 rounded-sm cursor-pointer transition-opacity hover:opacity-80"
                    style={{
                      bottom: segBottom,
                      height: segHeight,
                      background: SEG_FILLS[i % SEG_FILLS.length],
                    }}
                    title={`${t.tool_number} · ${t.mach_equivalents.toFixed(2)} mach`}
                    onMouseEnter={() => onHoverTool?.(t.tool_number)}
                    onMouseLeave={() => onHoverTool?.(null)}
                  >
                    {segHeight > 14 && (
                      <span className="absolute left-1.5 right-1.5 bottom-[3px] text-[10.5px] font-mono text-black/60 truncate block">
                        {t.tool_number}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Free + utilisation footer */}
            <div className="mt-2.5 flex justify-between items-baseline text-[11.5px]">
              <span className={`font-mono font-medium ${statusTextClass(cell.status)}`}>
                {cell.free >= 0 ? '+' : ''}
                {cell.free.toFixed(2)} free
              </span>
              <span className="font-mono text-[11px] text-[#8a8a8e]">
                {cell.utilization_pct.toFixed(0)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
