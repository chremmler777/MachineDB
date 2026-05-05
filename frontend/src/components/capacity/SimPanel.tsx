import { useState } from 'react';
import type { Modification } from '../../types/capacity';

type Granularity = 'year' | 'month' | 'week' | 'day';

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
    <div className="flex flex-col gap-3.5">
      {/* View panel */}
      <Panel title="View">
        <Field label="Granularity">
          <Seg<Granularity>
            options={['year', 'month', 'week', 'day']}
            value={granularity}
            onChange={onGranularityChange}
          />
        </Field>
      </Panel>

      {/* Active simulation panel */}
      <Panel
        title="Active simulation"
        right={
          <span className="font-mono text-[11px] text-[#8a8a8e]">
            {modifications.length} change{modifications.length === 1 ? '' : 's'}
          </span>
        }
      >
        {modifications.length === 0 ? (
          <div className="text-xs text-[#8a8a8e] py-2 leading-relaxed">
            No modifications. Drag tools between machines to simulate moves.
          </div>
        ) : (
          <div className="flex flex-col">
            {modifications.map((m, i) => (
              <ModItem key={i} mod={m} />
            ))}
            <div className="flex gap-2 pt-3 border-t border-[#ececea] mt-3 flex-wrap">
              <input
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                placeholder="Scenario name…"
                className="flex-1 min-w-0 border border-[#ececea] rounded-md px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-[#2c5fa0] bg-white"
              />
              <button
                onClick={handleSave}
                disabled={saving || !scenarioName.trim()}
                className="bg-[#1a1a1a] text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-[#2a2a2a] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={onClearModifications}
                className="border border-[#ececea] text-xs px-3 py-1.5 rounded-md text-[#5a5a5e] hover:border-[#1a1a1a] whitespace-nowrap"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Panel({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#ececea] rounded-[18px] overflow-hidden">
      <div className="px-4 pt-4 pb-2.5 text-[10.5px] uppercase tracking-widest text-[#8a8a8e] flex justify-between items-center border-b border-[#ececea]">
        <span>{title}</span>
        {right}
      </div>
      <div className="px-4 pb-4 pt-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-2">
      <label className="text-[11px] uppercase tracking-wider text-[#8a8a8e]">{label}</label>
      {children}
    </div>
  );
}

function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex p-0.5 bg-[#f7f7f5] border border-[#ececea] rounded-md">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-3 py-1 rounded-sm text-xs font-mono transition-colors ${
            value === o
              ? 'bg-white text-[#1a1a1a] shadow-sm'
              : 'text-[#5a5a5e] hover:text-[#1a1a1a]'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
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
      return `new tool`;
    case 'remove_tool':
      return `tool #${mod.tool_id}`;
    case 'change_volume':
      return `tool #${mod.tool_id} ${mod.year}: ${mod.pieces_per_year.toLocaleString()} pcs`;
    case 'change_class_param':
      return `${mod.field}=${mod.value} on ${mod.class_key.tonnage_t}t (${mod.year_or_all})`;
  }
}

function ModItem({ mod }: { mod: Modification }) {
  const op = modOpLabel(mod);
  const body = modBody(mod);
  return (
    <div className="py-2.5 border-t border-[#ececea] first:border-t-0 first:pt-0.5 text-[12px]">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#e6edf6] text-[#2c5fa0] flex-shrink-0">
          {op}
        </span>
        <span className="font-mono text-[#5a5a5e] truncate" title={body}>
          {body}
        </span>
      </div>
    </div>
  );
}
