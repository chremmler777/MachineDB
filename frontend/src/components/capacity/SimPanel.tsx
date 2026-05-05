import { useState } from 'react';
import type { Modification } from '../../types/capacity';

type Granularity = 'year' | 'month' | 'week' | 'day';
type GroupBy = 'tonnage+caps' | 'tonnage';

export function SimPanel({
  granularity,
  onGranularityChange,
  modifications,
  onClearModifications,
  onSaveScenario,
}: {
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  modifications: Modification[];
  onClearModifications: () => void;
  onSaveScenario: (name: string) => Promise<void>;
}) {
  const [scenarioName, setScenarioName] = useState('');
  const [saving, setSaving] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('tonnage+caps');
  const [applyTo, setApplyTo] = useState<'class' | 'all'>('class');
  const [oee, setOee] = useState(85);
  const [shifts, setShifts] = useState(15);
  const [workingDays, setWorkingDays] = useState(240);
  const [plannedDowntime, setPlannedDowntime] = useState(2);

  const handleSave = async () => {
    const name = scenarioName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await onSaveScenario(name);
      setScenarioName('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── VIEW panel ── */}
      <RailPanel title="View">
        <RailField label="Granularity">
          <SegCtrl<Granularity>
            options={['year', 'month', 'week', 'day']}
            labels={['Year', 'Month', 'Week', 'Day']}
            value={granularity}
            onChange={onGranularityChange}
          />
        </RailField>
        <RailField label="Range">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Geist Mono', monospace", fontSize: 13 }}>
            <StyledInput defaultValue="2025·01" style={{ width: 86 }} />
            <span style={{ color: '#8a8a8e', fontSize: 12 }}>→</span>
            <StyledInput defaultValue="2030·12" style={{ width: 86 }} />
          </div>
        </RailField>
        <RailField label="Group by">
          <SegCtrl<GroupBy>
            options={['tonnage+caps', 'tonnage']}
            labels={['Tonnage + caps', 'Tonnage']}
            value={groupBy}
            onChange={setGroupBy}
          />
        </RailField>
      </RailPanel>

      {/* ── PRODUCTION PARAMETERS panel ── */}
      <RailPanel
        title="Production parameters"
        right={<SimBadge />}
      >
        <RailField label="Apply to">
          <SegCtrl<'class' | 'all'>
            options={['class', 'all']}
            labels={['KM 350', 'All']}
            value={applyTo}
            onChange={setApplyTo}
          />
        </RailField>
        <RailField label="OEE">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Geist Mono', monospace", fontSize: 13 }}>
            <StyledInput
              type="number"
              value={oee}
              onChange={(e) => setOee(Number(e.target.value))}
              style={{ width: 86 }}
            />
            <span style={{ color: '#8a8a8e', fontSize: 12 }}>%</span>
          </div>
        </RailField>
        <RailField label="Shifts / week">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Geist Mono', monospace", fontSize: 13 }}>
            <StyledInput
              type="number"
              value={shifts}
              onChange={(e) => setShifts(Number(e.target.value))}
              style={{ width: 86 }}
            />
            <span style={{ color: '#8a8a8e', fontSize: 12 }}>shifts</span>
          </div>
        </RailField>
        <RailField label="Working days / year">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Geist Mono', monospace", fontSize: 13 }}>
            <StyledInput
              type="number"
              value={workingDays}
              onChange={(e) => setWorkingDays(Number(e.target.value))}
              style={{ width: 86 }}
            />
            <span style={{ color: '#8a8a8e', fontSize: 12 }}>days</span>
          </div>
        </RailField>
        <RailField label="Planned downtime">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Geist Mono', monospace", fontSize: 13 }}>
            <StyledInput
              type="number"
              value={plannedDowntime}
              onChange={(e) => setPlannedDowntime(Number(e.target.value))}
              style={{ width: 86 }}
            />
            <span style={{ color: '#8a8a8e', fontSize: 12 }}>weeks</span>
          </div>
        </RailField>
        <button
          style={{
            width: '100%', marginTop: 10,
            background: '#1a1a1a', color: 'white', border: 'none',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
            padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#2a2a2a'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#1a1a1a'; }}
          onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(1px)'; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = 'none'; }}
        >
          Save as scenario
        </button>
      </RailPanel>

      {/* ── ACTIVE SIMULATION panel ── */}
      <RailPanel
        title="Active simulation"
        right={
          <span style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11, color: '#8a8a8e',
          }}>
            {modifications.length} change{modifications.length !== 1 ? 's' : ''}
          </span>
        }
      >
        {modifications.length === 0 ? (
          <div style={{ fontSize: 12, color: '#8a8a8e', padding: '4px 0 8px', lineHeight: 1.6 }}>
            No modifications. Drag tools between machines to simulate moves.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {modifications.map((m, i) => (
              <SimItem key={i} mod={m} />
            ))}
            {/* Save / Discard */}
            <div style={{
              display: 'flex', gap: 8, paddingTop: 12,
              borderTop: '1px solid #ececea', marginTop: 8,
              flexWrap: 'wrap',
            }}>
              <input
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                placeholder="Scenario name…"
                style={{
                  flex: 1, minWidth: 0,
                  border: '1px solid #ececea', background: '#ffffff',
                  borderRadius: 8, padding: '7px 10px',
                  fontSize: 12, fontFamily: "'Geist Mono', monospace",
                  color: '#1a1a1a', outline: 'none',
                }}
                onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1a1a1a'; }}
                onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#ececea'; }}
              />
              <button
                onClick={handleSave}
                disabled={saving || !scenarioName.trim()}
                style={{
                  background: '#1a1a1a', color: 'white',
                  border: 'none', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: 500,
                  padding: '7px 12px', borderRadius: 8,
                  cursor: saving || !scenarioName.trim() ? 'not-allowed' : 'pointer',
                  opacity: saving || !scenarioName.trim() ? 0.4 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={onClearModifications}
                style={{
                  border: '1px solid #ececea',
                  background: 'transparent',
                  fontFamily: 'inherit',
                  fontSize: 12, padding: '7px 12px', borderRadius: 8,
                  color: '#5a5a5e', cursor: 'pointer', whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1a1a1a'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#ececea'; }}
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </RailPanel>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function RailPanel({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #ececea',
      borderRadius: 18,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 18px 12px',
        fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.12em',
        color: '#8a8a8e',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{title}</span>
        {right}
      </div>
      <div style={{ padding: '4px 18px 18px' }}>
        {children}
      </div>
    </div>
  );
}

function RailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '10px 0',
      borderTop: '1px solid #ececea',
    }}>
      <label style={{
        fontSize: 11, color: '#8a8a8e',
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { style, ...rest } = props;
  return (
    <input
      {...rest}
      style={{
        border: '1px solid #ececea',
        background: '#ffffff',
        borderRadius: 8,
        padding: '7px 10px',
        fontSize: 13,
        fontFamily: "'Geist Mono', monospace",
        color: '#1a1a1a',
        outline: 'none',
        transition: 'border-color 160ms',
        ...style,
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#1a1a1a';
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#ececea';
        props.onBlur?.(e);
      }}
    />
  );
}

function SegCtrl<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: readonly T[];
  labels: string[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{
      display: 'inline-flex',
      padding: 2,
      background: '#f7f7f5',
      border: '1px solid #ececea',
      borderRadius: 8,
    }}>
      {options.map((o, i) => {
        const isOn = value === o;
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            style={{
              border: 'none',
              background: isOn ? '#ffffff' : 'transparent',
              padding: '4px 9px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 11.5,
              fontFamily: "'Geist Mono', monospace",
              color: isOn ? '#1a1a1a' : '#5a5a5e',
              boxShadow: isOn ? '0 1px 2px rgba(20,20,30,0.06)' : undefined,
              transition: 'background 160ms, color 160ms',
            } as React.CSSProperties}
          >
            {labels[i]}
          </button>
        );
      })}
    </div>
  );
}

function SimBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '2px 8px',
      background: '#e6edf6', color: '#2c5fa0',
      borderRadius: 999,
      fontSize: 10.5, letterSpacing: '0.04em',
      fontFamily: "'Geist Mono', monospace",
    }}>
      <PulseDot color="#2c5fa0" />
      SIM
    </span>
  );
}

function PulseDot({ color }: { color: string }) {
  return (
    <span style={{
      width: 5, height: 5,
      background: color,
      borderRadius: '50%',
      display: 'inline-block',
      animation: 'capacity-pulse 2.4s ease-in-out infinite',
    }} />
  );
}

function modOpLabel(mod: Modification): string {
  switch (mod.type) {
    case 'move_tool': return 'MOVE';
    case 'add_tool': return 'ADD';
    case 'remove_tool': return 'REMOVE';
    case 'change_volume': return 'VOL';
    case 'change_class_param': return 'PARAM';
  }
}

function modBody(mod: Modification): string {
  switch (mod.type) {
    case 'move_tool':
      return `tool #${mod.tool_id} → machine #${mod.target_machine_id}`;
    case 'add_tool':
      return 'new tool';
    case 'remove_tool':
      return `tool #${mod.tool_id}`;
    case 'change_volume':
      return `tool #${mod.tool_id} ${mod.year}: ${mod.pieces_per_year.toLocaleString()} pcs`;
    case 'change_class_param':
      return `${mod.field}=${mod.value} on ${mod.class_key.tonnage_t}t (${mod.year_or_all})`;
  }
}

function SimItem({ mod }: { mod: Modification }) {
  const op = modOpLabel(mod);
  const body = modBody(mod);

  return (
    <div style={{
      padding: '12px 0',
      borderTop: '1px solid #ececea',
      fontSize: 12.5, lineHeight: 1.4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 10.5,
          padding: '2px 6px',
          borderRadius: 4,
          background: '#e6edf6', color: '#2c5fa0',
          letterSpacing: '0.04em',
          flexShrink: 0,
        }}>
          {op}
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {body}
        </span>
      </div>
    </div>
  );
}
