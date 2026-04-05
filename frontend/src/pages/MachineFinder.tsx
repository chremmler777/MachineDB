import React, { useState } from 'react';
import { machineService } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

interface MachineFinderProps {
  onNavigate: (page: string, params?: any) => void;
  darkMode?: boolean;
}

export const MachineFinder: React.FC<MachineFinderProps> = ({ onNavigate, darkMode = true }) => {
  const { t } = useLanguage();
  const [fields, setFields] = useState({
    clamping_force_t: '',
    mold_width: '',
    mold_height: '',
    shot_weight_g: '',
    core_pulls_nozzle: '',
    centering_ring_nozzle_mm: '',
    two_shot: false,
    rotary_table: false,
  });
  const [plant, setPlant] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const payload = {
        clamping_force_t: parseFloat(fields.clamping_force_t) || 0,
        mold_width: parseFloat(fields.mold_width) || 0,
        mold_height: parseFloat(fields.mold_height) || 0,
        shot_weight_g: parseFloat(fields.shot_weight_g) || 0,
        core_pulls_nozzle: parseFloat(fields.core_pulls_nozzle) || 0,
        centering_ring_nozzle_mm: parseFloat(fields.centering_ring_nozzle_mm) || 0,
        two_shot: fields.two_shot,
        rotary_table: fields.rotary_table,
      };
      const res = await machineService.finder(payload);
      setResults(res.data);
      setSearched(true);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Translate a gap string like "gap.clampingForce:50" or "gap.twoShot"
  const translateGap = (gap: string): string => {
    const [key, value] = gap.split(':');
    const template = t(key);
    if (value) return template.replace('{v}', value);
    return template;
  };

  const getSuitabilityColor = (suitability: string) => {
    switch (suitability) {
      case 'full': return { bg: '#f0fdf4', border: '#22c55e', text: '#14532d' };
      case 'near': return { bg: '#fefce8', border: '#eab308', text: '#713f12' };
      default:     return { bg: '#fef2f2', border: '#ef4444', text: '#7f1d1d' };
    }
  };

  const getSuitabilityLabel = (suitability: string) => {
    switch (suitability) {
      case 'full': return t('finder.fullMatch');
      case 'near': return t('finder.nearMatch');
      default:     return t('finder.notSuitable');
    }
  };

  const bg = darkMode ? '#111827' : '#f3f4f6';
  const cardBg = darkMode ? '#1f2937' : '#ffffff';
  const borderColor = darkMode ? '#374151' : '#e5e7eb';
  const textPrimary = darkMode ? '#f9fafb' : '#111827';
  const textSecondary = darkMode ? '#9ca3af' : '#6b7280';
  const inputBg = darkMode ? '#111827' : '#ffffff';

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: `1px solid ${borderColor}`,
    borderRadius: '8px',
    backgroundColor: inputBg,
    color: textPrimary,
    fontSize: '13px',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: textSecondary,
    marginBottom: '5px',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  };

  const displayedResults = plant
    ? results.filter(r => r.plant_location === plant)
    : results;

  return (
    <div style={{ height: 'calc(100vh - 64px)', backgroundColor: bg, padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '16px', color: textPrimary, flexShrink: 0, letterSpacing: '-0.01em' }}>
        {t('finder.title')}
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', flex: 1, overflow: 'hidden' }}>

        {/* Left panel — requirements */}
        <div style={{
          backgroundColor: cardBg,
          border: `1px solid ${borderColor}`,
          borderRadius: '12px',
          padding: '20px',
          overflowY: 'auto',
          background: darkMode ? 'linear-gradient(180deg, rgba(30,41,59,0.6), rgba(17,24,39,0.8))' : '#ffffff',
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', color: textPrimary, letterSpacing: '0.01em' }}>
            {t('finder.toolRequirements')}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>{t('finder.plant')}</label>
              <select style={inputStyle} value={plant} onChange={e => setPlant(e.target.value)}>
                <option value="">{t('machines.allPlants')}</option>
                <option value="USA">USA</option>
                <option value="Mexico">Mexico</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>{t('finder.clampingForce')}</label>
              <input type="number" min="0" style={inputStyle}
                value={fields.clamping_force_t}
                onChange={(e) => setFields({ ...fields, clamping_force_t: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>{t('finder.moldWidth')}</label>
              <input type="number" min="0" style={inputStyle}
                value={fields.mold_width}
                onChange={(e) => setFields({ ...fields, mold_width: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>{t('finder.moldHeight')}</label>
              <input type="number" min="0" style={inputStyle}
                value={fields.mold_height}
                onChange={(e) => setFields({ ...fields, mold_height: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>{t('finder.shotWeight')}</label>
              <input type="number" min="0" style={inputStyle}
                value={fields.shot_weight_g}
                onChange={(e) => setFields({ ...fields, shot_weight_g: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>{t('finder.corePulls')}</label>
              <input type="number" min="0" style={inputStyle}
                value={fields.core_pulls_nozzle}
                onChange={(e) => setFields({ ...fields, core_pulls_nozzle: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>{t('finder.centeringRing')}</label>
              <input type="number" min="0" style={inputStyle}
                value={fields.centering_ring_nozzle_mm}
                onChange={(e) => setFields({ ...fields, centering_ring_nozzle_mm: e.target.value })}
              />
            </div>

            {/* Checkboxes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '6px', borderTop: `1px solid ${borderColor}` }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: textPrimary, fontSize: '14px', fontWeight: '500' }}>
                <input
                  type="checkbox"
                  checked={fields.two_shot}
                  onChange={(e) => setFields({ ...fields, two_shot: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                {t('finder.twoShot')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: textPrimary, fontSize: '14px', fontWeight: '500' }}>
                <input
                  type="checkbox"
                  checked={fields.rotary_table}
                  onChange={(e) => setFields({ ...fields, rotary_table: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                {t('finder.rotaryTable')}
              </label>
            </div>

            <button
              onClick={handleSearch}
              disabled={loading}
              style={{
                marginTop: '8px',
                padding: '11px 16px',
                background: loading ? '#6b7280' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                width: '100%',
                transition: 'all 0.2s',
                boxShadow: loading ? 'none' : '0 2px 8px rgba(59,130,246,0.3)',
              }}
            >
              {loading ? t('finder.searching') : t('finder.search')}
            </button>
          </div>
        </div>

        {/* Right panel — results (scrollable) */}
        <div style={{ overflowY: 'auto' }}>
          {!searched ? (
            <div style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '32px', textAlign: 'center' }}>
              <p style={{ color: textPrimary, marginBottom: '12px', fontSize: '15px' }}>{t('finder.enterRequirements')}</p>
              <p style={{ color: textSecondary, fontSize: '13px' }}>{t('finder.rankingInfo')}</p>
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: textSecondary }}>{t('finder.searchingMachines')}</div>
          ) : displayedResults.length === 0 ? (
            <div style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '32px', textAlign: 'center', color: textSecondary }}>
              {t('finder.noResults')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '8px' }}>
              {displayedResults.map((machine) => {
                const colors = getSuitabilityColor(machine.suitability);
                return (
                  <div
                    key={machine.id}
                    onClick={() => onNavigate('machine', machine.id)}
                    style={{
                      backgroundColor: colors.bg,
                      border: `1px solid ${colors.border}`,
                      borderLeft: `4px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '16px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '16px', color: colors.text }}>{machine.internal_name}</div>
                        <div style={{ fontSize: '13px', color: colors.text, opacity: 0.75 }}>{machine.manufacturer} {machine.model}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '700', fontSize: '15px', color: colors.text }}>{getSuitabilityLabel(machine.suitability)}</div>
                        <div style={{ fontSize: '12px', color: colors.text, opacity: 0.75 }}>{t('finder.score')}: {machine.matchScore.toFixed(0)}%</div>
                      </div>
                    </div>

                    {machine.gaps.length > 0 && (
                      <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '10px', marginTop: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: colors.text, opacity: 0.75, marginBottom: '6px' }}>
                          {t('finder.needsUpgrading')}
                        </div>
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {machine.gaps.slice(0, 3).map((gap: string, idx: number) => (
                            <li key={idx} style={{ fontSize: '13px', color: colors.text }}>• {translateGap(gap)}</li>
                          ))}
                          {machine.gaps.length > 3 && (
                            <li style={{ fontSize: '13px', color: colors.text }}>
                              • {t('finder.moreGaps').replace('{n}', String(machine.gaps.length - 3))}
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    <div style={{ fontSize: '11px', color: colors.text, opacity: 0.5, marginTop: '10px' }}>
                      {t('finder.plant')}: {machine.plant_location} | {t('finder.year')}: {machine.year_of_construction}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
