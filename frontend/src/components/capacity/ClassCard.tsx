import { useState } from 'react';
import type { CapacityClass, Machine, Tool } from '../../types/capacity';
import { Sparkline } from './Sparkline';
import { StackedBarChart } from './StackedBarChart';
import { MachineRow } from './MachineRow';

const DOT_COLOR: Record<string, string> = {
  green: '#2f6f4f',
  yellow: '#b8862a',
  orange: '#b06a3a',
  red: '#a84040',
};

export function ClassCard({
  cls,
  machines,
  tools,
  year,
}: {
  cls: CapacityClass;
  machines: Machine[];
  tools: Tool[];
  year: number;
}) {
  const [open, setOpen] = useState(false);

  const headlineCell = cls.years.find((y) => y.year === year) ?? cls.years[0];
  const worst = cls.years.reduce(
    (a, b) => (a.free < b.free ? a : b),
    cls.years[0],
  );

  return (
    <div
      className="bg-white border border-[#ececea] rounded-[22px] mb-3.5 overflow-hidden"
      style={{
        boxShadow:
          '0 1px 0 rgba(20,20,30,0.02), 0 14px 32px -22px rgba(20,20,30,0.08)',
      }}
    >
      {/* Collapsed header row */}
      <div
        className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_auto] items-center gap-6 p-6 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        {/* Left: label + meta */}
        <div>
          <div className="text-base font-medium tracking-tight">
            <span className="text-[#8a8a8e] mr-2 font-mono text-xs">
              {open ? '▾' : '▸'}
            </span>
            {cls.label}
          </div>
          <div className="text-xs text-[#8a8a8e] mt-1 flex gap-2.5 flex-wrap">
            <span>{cls.machines} presses</span>
            {cls.requires_2k && <span>2K</span>}
            {cls.requires_mucell && <span>MuCell</span>}
            {cls.requires_variotherm && <span>Variotherm</span>}
            <span>{cls.shifts_per_week} sh/week</span>
          </div>
        </div>

        {/* Middle: sparkline */}
        <div>
          <Sparkline cells={cls.years} />
        </div>

        {/* Right: headline status */}
        <div className="flex flex-col items-end gap-1 text-[12.5px]">
          <div className="flex items-center gap-2 text-[#5a5a5e]">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: DOT_COLOR[headlineCell.status] }}
            />
            <span>
              &apos;{String(headlineCell.year).slice(2)}{' '}
              <b className="font-mono font-medium text-[#1a1a1a]">
                {headlineCell.free >= 0 ? '+' : ''}
                {headlineCell.free.toFixed(2)}
              </b>{' '}
              free
            </span>
            <span className="text-[#8a8a8e]">
              / {headlineCell.utilization_pct.toFixed(0)}%
            </span>
          </div>
          {worst.year !== headlineCell.year && (
            <div className="flex items-center gap-2 text-[#5a5a5e]">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: DOT_COLOR[worst.status] }}
              />
              <span>
                &apos;{String(worst.year).slice(2)}{' '}
                <b className="font-mono font-medium text-[#1a1a1a]">
                  {worst.free >= 0 ? '+' : ''}
                  {worst.free.toFixed(2)}
                </b>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <ClassCardExpanded
          cls={cls}
          machines={machines}
          tools={tools}
          year={year}
        />
      )}
    </div>
  );
}

function ClassCardExpanded({
  cls,
  machines,
  tools,
  year,
}: {
  cls: CapacityClass;
  machines: Machine[];
  tools: Tool[];
  year: number;
}) {
  // Filter machines belonging to this capacity class by tonnage bucket + capability flags.
  // NOTE: clamping_force_kn stores tons (legacy mis-named column) — use directly, no conversion.
  const classMachines = machines.filter((m) => {
    const t = m.clamping_force_kn;
    if (t == null) return false;
    return (
      Math.abs(t - cls.tonnage_t) / cls.tonnage_t < 0.3 &&
      (!cls.requires_2k || m.is_2k) &&
      (!cls.requires_mucell || m.has_mucell) &&
      (!cls.requires_variotherm || m.has_variotherm)
    );
  });

  const cell = cls.years.find((y) => y.year === year);

  return (
    <div
      className="border-t border-[#ececea] px-6 pb-6"
      style={{ background: 'linear-gradient(180deg, #fbfbfa, #ffffff)' }}
    >
      <StackedBarChart cells={cls.years} />

      {/* Per-machine drilldown table */}
      <div className="border-t border-[#ececea] mt-6">
        <div className="grid grid-cols-[220px_160px_1fr_180px] py-3.5 px-1 text-[10.5px] text-[#8a8a8e] uppercase tracking-wider border-b border-[#ececea]">
          <div>Press</div>
          <div>Build</div>
          <div>Tools running &apos;{String(year).slice(2)}</div>
          <div className="text-right">Util &apos;{String(year).slice(2)}</div>
        </div>
        {classMachines.map((m) => {
          const machineTools = tools.filter(
            (t) => t.assigned_machine_id === m.id,
          );
          // Sum mach-equivalents for tools on this machine in the selected year
          const me = cell
            ? cell.contributing_tools
                .filter((ct) =>
                  machineTools.some((mt) => mt.tool_number === ct.tool_number),
                )
                .reduce((s, ct) => s + ct.mach_equivalents, 0)
            : 0;
          return (
            <MachineRow
              key={m.id}
              machine={m}
              tools={machineTools}
              utilPct={me * 100}
            />
          );
        })}
      </div>
    </div>
  );
}
