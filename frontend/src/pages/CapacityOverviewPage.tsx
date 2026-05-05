import { useEffect, useState, useMemo } from 'react';
import type { CapacityClass, Machine, Tool, Modification } from '../types/capacity';
import { fetchOverview, fetchTools, fetchMachines, simulateOverview, saveScenario } from '../services/capacityApi';
import { ClassCard } from '../components/capacity/ClassCard';
import { SimPanel } from '../components/capacity/SimPanel';

const THIS_YEAR = new Date().getFullYear();
const YEAR_FROM = 2024;
const YEAR_TO = 2030;

export function CapacityOverviewPage() {
  const [baseGrid, setBaseGrid] = useState<CapacityClass[]>([]);
  const [simGrid, setSimGrid] = useState<CapacityClass[] | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year] = useState(THIS_YEAR);
  const [granularity, setGranularity] = useState<'year' | 'month' | 'week' | 'day'>('year');
  const [modifications, setModifications] = useState<Modification[]>([]);
  const [simError, setSimError] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const [g, t, m] = await Promise.all([
          fetchOverview(YEAR_FROM, YEAR_TO, 'USA'),
          fetchTools(),
          fetchMachines(),
        ]);
        setBaseGrid(g);
        setTools(t);
        setMachines(m);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load capacity data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Re-simulate when modifications change
  useEffect(() => {
    if (modifications.length === 0) {
      setSimGrid(null);
      return;
    }
    (async () => {
      try {
        const { after } = await simulateOverview(modifications, YEAR_FROM, YEAR_TO, 'USA');
        setSimGrid(after);
        setSimError(null);
      } catch (e) {
        setSimError(e instanceof Error ? e.message : 'Simulation failed');
      }
    })();
  }, [modifications]);

  const grid = simGrid ?? baseGrid;

  const kpis = useMemo(() => {
    const yearCell = (cls: CapacityClass) => cls.years.find((y) => y.year === year);
    const totalFree = grid.reduce((s, c) => s + (yearCell(c)?.free ?? 0), 0);
    const tightCount = grid.filter((c) => {
      const yc = yearCell(c);
      return yc && (yc.status === 'orange' || yc.status === 'yellow');
    }).length;
    const overrunCount = grid.filter((c) => c.years.some((y) => y.status === 'red')).length;
    return { totalFree, tightCount, overrunCount };
  }, [grid, year]);

  const handleMoveTool = (toolId: number, targetMachineId: number) => {
    setModifications((prev) => [
      // Replace any existing move of the same tool
      ...prev.filter((m) => !(m.type === 'move_tool' && m.tool_id === toolId)),
      { type: 'move_tool', tool_id: toolId, target_machine_id: targetMachineId },
    ]);
  };

  const handleClearModifications = () => {
    setModifications([]);
    setSimGrid(null);
  };

  const handleSaveScenario = async (name: string) => {
    await saveScenario(name, modifications);
    setModifications([]);
    setSimGrid(null);
  };

  if (loading) return <SkeletonGrid />;
  if (error) return (
    <div className="max-w-[1400px] mx-auto px-8 pt-12 text-[#a84040]">
      <div className="font-medium mb-1">Failed to load capacity data</div>
      <div className="text-sm font-mono">{error}</div>
    </div>
  );

  return (
    <div
      className="max-w-[1400px] mx-auto px-8 pt-7 pb-16"
      style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
    >
      {/* Header */}
      <header className="flex items-center gap-4 pb-5 mb-6 border-b border-[#ececea]">
        <span className="font-semibold tracking-tight text-sm">MachineDB</span>
        <span className="text-[#ececea]">/</span>
        <span className="text-xs text-[#8a8a8e]">USA</span>
        <span className="text-[#ececea]">/</span>
        <span className="text-xs text-[#8a8a8e]">Injection Molding</span>
        <span className="text-[#ececea]">/</span>
        <span className="text-xs text-[#1a1a1a] font-medium">Capacity</span>

        {/* Scenario tabs placeholder */}
        <div className="ml-6 flex gap-1 p-0.5 bg-[#f7f7f5] border border-[#ececea] rounded-md">
          <button className="px-3 py-1 text-xs font-mono rounded-sm bg-white text-[#1a1a1a] shadow-sm">
            Current
          </button>
        </div>

        <div className="ml-auto text-xs text-[#8a8a8e] font-mono">
          Updated {new Date().toISOString().slice(0, 10)}
        </div>
      </header>

      {/* Hero */}
      <div className="grid grid-cols-[1fr_auto] items-end gap-6 mb-7">
        <div>
          <h1 className="text-3xl font-medium tracking-tight leading-tight">
            Capacity outlook{' '}
            <span className="text-[#2f6f4f]">
              {YEAR_FROM}–{YEAR_TO}
            </span>
          </h1>
          <p className="text-sm text-[#5a5a5e] max-w-[56ch] mt-2 leading-relaxed">
            {grid.length} machine classes · {machines.length} US presses · 85% OEE baseline.
            {kpis.overrunCount > 0 && (
              <>
                {' '}
                <b className="text-[#a84040]">{kpis.overrunCount}</b> class
                {kpis.overrunCount !== 1 ? 'es' : ''} overrun in the forecast horizon.
              </>
            )}
          </p>
        </div>

        {/* KPI strip */}
        <div className="flex gap-9 pb-1">
          <div className="text-right">
            <div
              className="font-mono text-[22px] font-medium"
              style={{ color: kpis.totalFree >= 0 ? '#2f6f4f' : '#a84040' }}
            >
              {kpis.totalFree >= 0 ? '+' : ''}
              {kpis.totalFree.toFixed(1)}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-[#8a8a8e] mt-0.5">
              free &apos;{String(year).slice(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[22px] font-medium text-[#b8862a]">
              {kpis.tightCount}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-[#8a8a8e] mt-0.5">
              tight classes
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[22px] font-medium text-[#a84040]">
              {kpis.overrunCount}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-[#8a8a8e] mt-0.5">
              overrun
            </div>
          </div>
        </div>
      </div>

      {simError && (
        <div className="mb-4 px-4 py-2.5 bg-[#fdf2f2] border border-[#f5c5c5] rounded-lg text-xs text-[#a84040]">
          Simulation error: {simError}
        </div>
      )}

      {modifications.length > 0 && (
        <div className="mb-4 px-4 py-2 bg-[#edf4ff] border border-[#c5d9f5] rounded-lg text-xs text-[#2c5fa0] font-mono">
          Showing simulated scenario · {modifications.length} modification
          {modifications.length !== 1 ? 's' : ''} applied
        </div>
      )}

      {/* Main layout: card grid + right rail */}
      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        <div>
          {grid.length === 0 ? (
            <div className="bg-white border border-[#ececea] rounded-[18px] p-10 text-center text-[#5a5a5e]">
              <div className="font-medium mb-1">No capacity data yet</div>
              <div className="text-sm">
                Run the bootstrap importer (
                <span className="font-mono text-xs">scripts/run-capacity-bootstrap.ts</span>
                ) to populate from the Excel source.
              </div>
            </div>
          ) : (
            grid.map((cls) => (
              <ClassCard
                key={cls.label}
                cls={cls}
                machines={machines}
                tools={tools}
                year={year}
                onMoveTool={handleMoveTool}
              />
            ))
          )}
        </div>

        <aside className="sticky top-6">
          <SimPanel
            granularity={granularity}
            onGranularityChange={setGranularity}
            modifications={modifications}
            onClearModifications={handleClearModifications}
            onSaveScenario={handleSaveScenario}
          />
        </aside>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="max-w-[1400px] mx-auto px-8 pt-7">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-white border border-[#ececea] rounded-[22px] h-[88px] mb-3.5 animate-pulse"
        />
      ))}
    </div>
  );
}
