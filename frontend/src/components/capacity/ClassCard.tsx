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
  onMoveTool,
}: {
  cls: CapacityClass;
  machines: Machine[];
  tools: Tool[];
  year: number;
  onMoveTool: (toolId: number, targetMachineId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dragTargeted, setDragTargeted] = useState(false);

  const headlineCell = cls.years.find((y) => y.year === year) ?? cls.years[0];
  const worst = cls.years.reduce(
    (a, b) => (a.free < b.free ? a : b),
    cls.years[0],
  );

  // Sub-line items
  const subItems: string[] = [
    `${cls.machines} press${cls.machines !== 1 ? 'es' : ''}`,
    ...(cls.requires_2k ? ['2K'] : []),
    ...(cls.requires_mucell ? ['MuCell'] : []),
    ...(cls.requires_variotherm ? ['Variotherm'] : []),
    `${cls.shifts_per_week} sh / week`,
  ];

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragTargeted(true); }}
      onDragLeave={() => setDragTargeted(false)}
      onDrop={() => setDragTargeted(false)}
      style={{
        background: '#ffffff',
        border: dragTargeted ? '1px solid #2c5fa0' : '1px solid #ececea',
        borderRadius: 22,
        boxShadow: dragTargeted
          ? '0 0 0 4px #e6edf6, 0 14px 32px -22px rgba(20,20,30,0.08)'
          : '0 1px 0 rgba(20,20,30,0.02), 0 14px 32px -22px rgba(20,20,30,0.08)',
        overflow: 'hidden',
        marginBottom: 14,
        position: 'relative',
      }}
    >
      {/* Drop banner */}
      {dragTargeted && (
        <span style={{
          position: 'absolute', top: 16, right: 24,
          fontFamily: "'Geist Mono', monospace", fontSize: 11, color: '#2c5fa0',
          display: 'flex', alignItems: 'center', gap: 6,
          zIndex: 10,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: '#2c5fa0', display: 'inline-block',
          }} />
          drop tool here to simulate move
        </span>
      )}

      {/* Collapsed header */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 2fr) auto',
          alignItems: 'center',
          padding: '22px 24px',
          cursor: 'pointer',
          gap: 24,
        }}
      >
        {/* Left: name + sub */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-0.015em' }}>
            <span style={{
              display: 'inline-block', color: '#8a8a8e', marginRight: 6,
              fontFamily: "'Geist Mono', monospace", fontSize: 11,
              transition: 'transform 200ms',
              transform: open ? 'none' : 'none',
            }}>
              {open ? '▾' : '▸'}
            </span>
            {cls.label}
          </div>
          <div style={{
            fontSize: 12, color: '#8a8a8e', marginTop: 4,
            display: 'flex', gap: 10,
          }}>
            {subItems.map((item, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                {item}
                {i < subItems.length - 1 && (
                  <span style={{ color: '#e1e1de', marginLeft: 0 }}>·</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Middle: sparkline */}
        <div>
          <Sparkline cells={cls.years} />
        </div>

        {/* Right: headline */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
          gap: 4, fontSize: 12.5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5a5a5e' }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: DOT_COLOR[headlineCell.status],
            }} />
            <span>
              &apos;{String(headlineCell.year).slice(2)}{' '}
              <b style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 500, color: '#1a1a1a' }}>
                {headlineCell.free >= 0 ? '+' : ''}{headlineCell.free.toFixed(2)}
              </b>{' '}
              free
            </span>
            <span style={{ color: '#8a8a8e', marginLeft: 4 }}>
              / {headlineCell.utilization_pct.toFixed(0)}%
            </span>
          </div>
          {worst.year !== headlineCell.year && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5a5a5e' }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: DOT_COLOR[worst.status],
              }} />
              <span>
                &apos;{String(worst.year).slice(2)}{' '}
                <b style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 500, color: '#1a1a1a' }}>
                  {worst.free >= 0 ? '+' : ''}{worst.free.toFixed(2)}
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
          onMoveTool={onMoveTool}
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
  onMoveTool,
}: {
  cls: CapacityClass;
  machines: Machine[];
  tools: Tool[];
  year: number;
  onMoveTool: (toolId: number, targetMachineId: number) => void;
}) {
  // Filter machines belonging to this capacity class by tonnage bucket + capability flags.
  // NOTE: clamping_force_t stores tons (legacy mis-named column) — use directly, no conversion.
  const classMachines = machines.filter((m) => {
    const t = m.clamping_force_t;
    if (t == null) return false;
    return (
      Math.abs(t - cls.tonnage_t) / cls.tonnage_t < 0.3 &&
      (!cls.requires_2k || m.is_2k) &&
      (!cls.requires_mucell || m.has_mucell) &&
      (!cls.requires_variotherm || m.has_variotherm)
    );
  });

  const cell = cls.years.find((y) => y.year === year);
  const [barHeight, setBarHeight] = useState(152);

  // Drag-to-resize the bar chart vertically
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = barHeight;
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(800, Math.max(96, startH + (ev.clientY - startY)));
      setBarHeight(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div style={{
      borderTop: '1px solid #ececea',
      padding: '4px 24px 24px',
      background: 'linear-gradient(180deg, #fbfbfa, #ffffff)',
    }}>
      <StackedBarChart cells={cls.years} tools={tools} barHeight={barHeight} />

      {/* Drag handle to resize chart vertically */}
      <div
        onMouseDown={startResize}
        title="Drag to resize chart"
        style={{
          height: 8,
          margin: '6px -24px 0',
          cursor: 'ns-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.5,
          transition: 'opacity 200ms',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
      >
        <div style={{
          width: 36, height: 3, borderRadius: 999, background: '#c4c4c2',
        }} />
      </div>

      {/* Per-machine drilldown table */}
      <div style={{ borderTop: '1px solid #ececea' }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '220px 160px 1fr 180px',
          padding: '14px 4px',
          fontSize: 10.5, color: '#8a8a8e',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          borderBottom: '1px solid #ececea',
        }}>
          <div>Press</div>
          <div>Build</div>
          <div>Tools running &apos;{String(year).slice(2)}</div>
          <div style={{ textAlign: 'right' }}>Util &apos;{String(year).slice(2)}</div>
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
              onDropTool={onMoveTool}
            />
          );
        })}
      </div>
    </div>
  );
}
