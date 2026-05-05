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
  const [hovered, setHovered] = useState(false);

  const buildYearShort =
    machine.year_of_construction != null
      ? `'${String(machine.year_of_construction).slice(2)}`
      : '—';

  const rowBg = dragOver
    ? '#e6edf6'
    : hovered
    ? '#fafaf8'
    : 'transparent';

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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 160px 1fr 180px',
        padding: '16px 4px',
        alignItems: 'center',
        borderBottom: '1px solid #ececea',
        transition: 'background 160ms',
        background: rowBg,
        boxShadow: dragOver ? 'inset 0 0 0 1px rgba(44,95,160,0.3)' : undefined,
      }}
    >
      {/* Press name */}
      <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em' }}>
        {machine.internal_name}
      </div>

      {/* Build: manufacturer + year */}
      <div style={{ fontSize: 12, color: '#5a5a5e' }}>
        {machine.manufacturer ?? '—'}
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          color: '#8a8a8e', marginLeft: 4,
        }}>
          {buildYearShort}
        </span>
      </div>

      {/* Tool chips */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        {tools.length === 0 ? (
          <span style={{
            padding: '3px 10px',
            borderStyle: 'dashed',
            border: dragOver ? '1px dashed #2c5fa0' : '1px dashed #ececea',
            borderRadius: 999,
            fontSize: 11,
            fontFamily: "'Geist Mono', monospace",
            color: dragOver ? '#2c5fa0' : '#8a8a8e',
            fontStyle: 'italic',
            background: 'transparent',
          }}>
            {dragOver ? 'drop tool here' : '— available —'}
          </span>
        ) : (
          <>
            {tools.map((t) => (
              <span
                key={t.id}
                draggable
                style={{
                  padding: '3px 10px',
                  background: '#f7f7f5',
                  border: '1px solid #ececea',
                  borderRadius: 999,
                  fontSize: 11,
                  fontFamily: "'Geist Mono', monospace",
                  color: '#5a5a5e',
                  cursor: 'grab',
                  transition: 'border-color 160ms, color 160ms',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#1a1a1a';
                  (e.currentTarget as HTMLElement).style.color = '#1a1a1a';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#ececea';
                  (e.currentTarget as HTMLElement).style.color = '#5a5a5e';
                }}
                onDragStart={(e) =>
                  e.dataTransfer.setData('application/x-tool-id', String(t.id))
                }
              >
                {t.tool_number}
              </span>
            ))}
            {dragOver && (
              <span style={{
                padding: '3px 8px',
                border: '1px dashed #2c5fa0',
                borderRadius: 999,
                fontSize: 10,
                color: '#2c5fa0',
                marginLeft: 4,
              }}>
                + drop here
              </span>
            )}
          </>
        )}
      </div>

      {/* Utilisation bar with target marker at 85% */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end',
      }}>
        <div style={{
          position: 'relative',
          width: 96, height: 5,
          background: '#ececea', borderRadius: 999, overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: '0 auto 0 0',
            borderRadius: 999,
            width: `${Math.min(utilPct, 100)}%`,
            background: utilFillColor(utilPct),
          }} />
          {/* Target marker at 85% */}
          <div style={{
            position: 'absolute',
            top: -2, bottom: -2, width: 1,
            background: '#8a8a8e',
            left: '85%',
          }} />
        </div>
        <div style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 12,
          minWidth: 38, textAlign: 'right',
          color: utilPct === 0 ? '#2f6f4f' : '#1a1a1a',
        }}>
          {utilPct.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}
