import { useEffect, useState, useMemo } from 'react';
import type { CapacityClass, Machine, Tool, Modification } from '../types/capacity';
import { fetchOverview, fetchTools, fetchMachines, simulateOverview, saveScenario } from '../services/capacityApi';
import { ClassCard } from '../components/capacity/ClassCard';
import { SimPanel } from '../components/capacity/SimPanel';

const THIS_YEAR = new Date().getFullYear();
const YEAR_FROM = 2024;
const YEAR_TO = 2030;

// CSS custom properties for the v4 light palette
const PALETTE_VARS: React.CSSProperties = {
  '--bg': '#f7f7f5',
  '--panel': '#ffffff',
  '--ink': '#1a1a1a',
  '--ink-2': '#5a5a5e',
  '--ink-3': '#8a8a8e',
  '--line': '#ececea',
  '--line-2': '#e1e1de',
  '--accent': '#2f6f4f',
  '--accent-soft': '#e9f2ec',
  '--warn': '#b8862a',
  '--warn-soft': '#f5edda',
  '--hot': '#b06a3a',
  '--hot-soft': '#f4e4d6',
  '--crit': '#a84040',
  '--crit-soft': '#f3dada',
  '--cand': '#2c5fa0',
  '--cand-soft': '#e6edf6',
} as React.CSSProperties;

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

  // Enable body scrolling for this page (body has overflow:hidden by default in app)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const [g, t, m] = await Promise.all([
          fetchOverview(YEAR_FROM, YEAR_TO, 'USA'),
          fetchTools(),
          fetchMachines(),
        ]);
        setBaseGrid(Array.isArray(g) ? g : []);
        setTools(Array.isArray(t) ? t : []);
        setMachines(Array.isArray(m) ? m : []);
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
    const tightCount = grid.filter((c) =>
      c.years.some((y) => y.status === 'orange' || y.status === 'yellow'),
    ).length;
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
    <div
      style={{ ...PALETTE_VARS, background: '#f7f7f5', color: '#1a1a1a', minHeight: '100vh', fontFamily: "'Geist', system-ui, sans-serif" }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '48px 32px' }}>
        <div style={{ color: '#a84040', fontWeight: 500, marginBottom: 4 }}>Failed to load capacity data</div>
        <div style={{ fontSize: 13, fontFamily: "'Geist Mono', monospace", color: '#5a5a5e' }}>{error}</div>
      </div>
    </div>
  );

  const dateStamp = `${new Date().getFullYear()}·${String(new Date().getMonth() + 1).padStart(2, '0')}·${String(new Date().getDate()).padStart(2, '0')}`;

  return (
    <div
      style={{
        ...PALETTE_VARS,
        background: '#f7f7f5',
        color: '#1a1a1a',
        minHeight: '100vh',
        overflowY: 'auto',
        fontFamily: "'Geist', system-ui, sans-serif",
        fontFeatureSettings: "'cv11', 'ss01'",
        fontSize: 14,
        letterSpacing: '-0.005em',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Shell */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 32px 64px' }}>

        {/* Header bar */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 16,
          paddingBottom: 24, marginBottom: 24,
          borderBottom: '1px solid #ececea',
        }}>
          {/* Mark */}
          <span style={{
            fontWeight: 600, letterSpacing: '-0.02em', fontSize: 15,
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8,
              background: '#1a1a1a', borderRadius: 2, transform: 'rotate(45deg)',
              flexShrink: 0,
            }} />
            MachineDB
          </span>

          {/* Breadcrumb */}
          <span style={{ fontSize: 12, color: '#8a8a8e', letterSpacing: '0.01em' }}>
            USA / Injection Molding / <span style={{ color: '#5a5a5e' }}>Capacity</span>
          </span>

          {/* Scenario tabs */}
          <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
            <span style={{
              fontSize: 12.5, padding: '7px 14px', borderRadius: 999,
              background: '#1a1a1a', color: 'white', cursor: 'pointer',
            }}>
              Current
            </span>
            {modifications.length > 0 && (
              <span style={{
                fontSize: 12.5, padding: '7px 14px', borderRadius: 999,
                background: '#e6edf6', color: '#2c5fa0', cursor: 'pointer',
                fontFamily: "'Geist Mono', monospace", letterSpacing: 0,
                display: 'inline-flex', alignItems: 'center',
              }}>
                <SimPulseDot />
                Scenario · {modifications.length} change{modifications.length !== 1 ? 's' : ''}
              </span>
            )}
            <span style={{
              fontSize: 12.5, padding: '7px 14px', borderRadius: 999,
              color: '#5a5a5e', cursor: 'pointer',
            }}>
              All scenarios →
            </span>
          </div>

          {/* Date + user stamp */}
          <span style={{
            fontSize: 12, color: '#8a8a8e',
            fontFamily: "'Geist Mono', monospace",
          }}>
            {dateStamp} — C. Demmler
          </span>
        </header>

        {/* Intro / hero */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto',
          alignItems: 'end', gap: 24, marginBottom: 28,
        }}>
          <div>
            <h1 style={{
              fontSize: 32, fontWeight: 500, letterSpacing: '-0.025em',
              lineHeight: 1.05, margin: 0,
            }}>
              Capacity outlook<br />
              <span style={{ color: '#2f6f4f' }}>2025 — 2030</span>
            </h1>
            <p style={{
              margin: '8px 0 0', color: '#5a5a5e', fontSize: 14,
              maxWidth: '56ch', lineHeight: 1.55,
            }}>
              {grid.length} machine class{grid.length !== 1 ? 'es' : ''},{' '}
              {machines.length} US press{machines.length !== 1 ? 'es' : ''},{' '}
              eighty-five percent OEE baseline.
              {kpis.overrunCount > 0 && (
                <> {kpis.overrunCount} class{kpis.overrunCount !== 1 ? 'es' : ''} overrun in the forecast horizon if forecast holds.</>
              )}
              {kpis.overrunCount === 0 && (
                <> KM 350 has the most absorbable headroom for incoming RFQ tools.</>
              )}
            </p>
          </div>

          {/* KPI strip */}
          <div style={{ display: 'flex', gap: 36, paddingBottom: 4 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em',
                color: '#2f6f4f',
              }}>
                {kpis.totalFree >= 0 ? '+' : ''}{kpis.totalFree.toFixed(1)}
              </div>
              <div style={{
                fontSize: 11, color: '#8a8a8e', textTransform: 'uppercase',
                letterSpacing: '0.08em', marginTop: 2,
              }}>
                free &apos;{String(year).slice(2)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em',
                color: '#b8862a',
              }}>
                {kpis.tightCount}
              </div>
              <div style={{
                fontSize: 11, color: '#8a8a8e', textTransform: 'uppercase',
                letterSpacing: '0.08em', marginTop: 2,
              }}>
                tight classes
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em',
                color: '#b06a3a',
              }}>
                {kpis.overrunCount}
              </div>
              <div style={{
                fontSize: 11, color: '#8a8a8e', textTransform: 'uppercase',
                letterSpacing: '0.08em', marginTop: 2,
              }}>
                overrun &apos;{String(YEAR_TO).slice(2)}
              </div>
            </div>
          </div>
        </div>

        {simError && (
          <div style={{
            marginBottom: 16, padding: '10px 16px',
            background: '#fdf2f2', border: '1px solid #f5c5c5',
            borderRadius: 10, fontSize: 12, color: '#a84040',
          }}>
            Simulation error: {simError}
          </div>
        )}

        {/* Main layout: cards + right rail */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 20, alignItems: 'start',
        }}>
          {/* Card column */}
          <div>
            {grid.length === 0 ? (
              <div style={{
                background: '#ffffff', border: '1px solid #ececea',
                borderRadius: 22, padding: '40px', textAlign: 'center',
                color: '#5a5a5e',
              }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>No capacity data yet</div>
                <div style={{ fontSize: 13 }}>
                  Run the bootstrap importer (
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12 }}>scripts/run-capacity-bootstrap.ts</span>
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

          {/* Right rail */}
          <aside style={{ position: 'sticky', top: 24 }}>
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
    </div>
  );
}

/** Animated pulse dot for sim scenario tab */
function SimPulseDot() {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6,
      background: '#2c5fa0', borderRadius: '50%', marginRight: 7,
      verticalAlign: '2px',
      animation: 'capacity-pulse 2.4s ease-in-out infinite',
    }} />
  );
}

function SkeletonGrid() {
  return (
    <div style={{
      background: '#f7f7f5', minHeight: '100vh',
      fontFamily: "'Geist', system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 32px' }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              background: '#ffffff', border: '1px solid #ececea',
              borderRadius: 22, height: 88, marginBottom: 14,
              animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
            }}
          />
        ))}
      </div>
    </div>
  );
}
