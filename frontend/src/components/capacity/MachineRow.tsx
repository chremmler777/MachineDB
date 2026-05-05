import { useState } from 'react';
import type { Machine, Tool } from '../../types/capacity';

function utilFillColor(pct: number): string {
  if (pct > 95) return '#a84040';
  if (pct > 85) return '#b8862a';
  return '#2f6f4f';
}

export function MachineRow({
  machine,
  tools,
  utilPct,
  onDropTool,
}: {
  machine: Machine;
  tools: Tool[];
  utilPct: number;
  onDropTool: (toolId: number, targetMachineId: number) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const buildYearShort =
    machine.year_of_construction != null
      ? `'${String(machine.year_of_construction).slice(2)}`
      : '—';

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const rawId = e.dataTransfer.getData('application/x-tool-id');
        if (rawId) onDropTool(Number(rawId), machine.id);
      }}
      className={`grid grid-cols-[220px_160px_1fr_180px] py-4 px-1 items-center border-b border-[#ececea] transition-colors ${
        dragOver
          ? 'bg-[#e6edf6] ring-1 ring-inset ring-[#2c5fa0]/30'
          : 'hover:bg-[#fafaf8]'
      }`}
    >
      {/* Press name */}
      <div className="text-[13px] font-medium tracking-tight">
        {machine.internal_name}
      </div>

      {/* Build year (manufacturer + year) — no shot volume, no clamping force per §7.1 */}
      <div className="text-xs text-[#5a5a5e]">
        {machine.manufacturer ?? '—'}{' '}
        <span className="font-mono text-[#8a8a8e] ml-1">{buildYearShort}</span>
      </div>

      {/* Running tool chips */}
      <div className="flex gap-1 flex-wrap items-center">
        {tools.length === 0 ? (
          <span
            className={`px-2.5 py-0.5 border border-dashed rounded-full text-[11px] transition-colors ${
              dragOver
                ? 'border-[#2c5fa0] text-[#2c5fa0]'
                : 'border-[#ececea] text-[#8a8a8e]'
            }`}
          >
            {dragOver ? 'drop tool here' : '— available —'}
          </span>
        ) : (
          tools.map((t) => (
            <span
              key={t.id}
              draggable
              className="px-2.5 py-0.5 bg-[#f7f7f5] border border-[#ececea] rounded-full text-[11px] font-mono text-[#5a5a5e] cursor-grab hover:border-[#1a1a1a] hover:text-[#1a1a1a] transition-colors active:cursor-grabbing"
              onDragStart={(e) =>
                e.dataTransfer.setData('application/x-tool-id', String(t.id))
              }
            >
              {t.tool_number}
            </span>
          ))
        )}
        {tools.length > 0 && dragOver && (
          <span className="px-2 py-0.5 border border-dashed border-[#2c5fa0] rounded-full text-[10px] text-[#2c5fa0] ml-1">
            + drop here
          </span>
        )}
      </div>

      {/* Utilisation bar with target marker at 85% */}
      <div className="flex items-center gap-2.5 justify-end">
        <div className="relative w-24 h-[5px] bg-[#ececea] rounded-full overflow-hidden">
          <div
            className="absolute inset-0 right-auto rounded-full"
            style={{
              width: `${Math.min(utilPct, 100)}%`,
              background: utilFillColor(utilPct),
            }}
          />
          {/* Target marker at 85% */}
          <div
            className="absolute -top-0.5 -bottom-0.5 w-px bg-[#8a8a8e]"
            style={{ left: '85%' }}
          />
        </div>
        <div className="font-mono text-xs min-w-[38px] text-right">
          {utilPct.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}
