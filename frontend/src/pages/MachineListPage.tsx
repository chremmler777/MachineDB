import React, { useEffect, useState } from 'react';
import { machineService, fileService } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

interface MachineListPageProps {
  onNavigate: (page: string, params?: any) => void;
  darkMode?: boolean;
}

const toNum = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  return 0;
};

// Column groups — labels are translation keys, resolved at render time via t()
const COLUMN_GROUPS = [
  {
    group: 'col.group.machineInfo',
    color: 'rgba(173, 216, 230, 1)', // Soft Blue
    columns: [
      { key: 'internal_name', label: 'col.machine' },
      { key: 'manufacturer', label: 'col.manufacturer' },
      { key: 'order_number', label: 'col.orderNum' },
      { key: 'model', label: 'col.model' },
      { key: 'serial_number', label: 'col.serialNum' },
      { key: 'year_of_construction', label: 'col.year' },
    ]
  },
  {
    group: 'col.group.machineDimensions',
    color: 'rgba(175, 238, 238, 1)', // Soft Cyan
    columns: [
      { key: 'length_mm', label: 'col.length' },
      { key: 'width_mm', label: 'col.width' },
      { key: 'height_mm', label: 'col.height' },
      { key: 'weight_kg', label: 'col.weight' },
    ]
  },
  {
    group: 'col.group.clampingUnit',
    color: 'rgba(255, 255, 153, 1)', // Soft Yellow
    columns: [
      { key: 'clamping_force_kn', label: 'col.clampingForce' },
      { key: 'centering_ring_nozzle_mm', label: 'col.centerNozzle' },
      { key: 'centering_ring_ejector_mm', label: 'col.centerEjector' },
      { key: 'fine_centering', label: 'col.fineCentering' },
      { key: 'mold_height_min_mm', label: 'col.moldHMin' },
      { key: 'mold_height_max_mm', label: 'col.moldHMax' },
      { key: 'opening_stroke_mm', label: 'col.opening' },
      { key: 'clearance_horizontal_mm', label: 'col.clearH' },
      { key: 'clearance_vertical_mm', label: 'col.clearV' },
      { key: 'rotary_table', label: 'col.rotaryTable' },
      { key: 'max_weight_ejector_kg', label: 'col.maxWeight' },
    ]
  },
  {
    group: 'col.group.toolConnections',
    color: 'rgba(255, 218, 185, 1)', // Soft Orange
    columns: [
      { key: 'temperature_control_circuits', label: 'col.tempCircuits' },
      { key: 'cascade_count', label: 'col.cascade' },
      { key: 'hot_runner_integrated', label: 'col.hotRunnerInt' },
      { key: 'hot_runner_external', label: 'col.hotRunnerExt' },
      { key: 'core_pulls_nozzle', label: 'col.corePullsN' },
      { key: 'core_pulls_ejector', label: 'col.corePullsE' },
      { key: 'pneumatic_nozzle', label: 'col.pneumNozzle' },
      { key: 'pneumatic_ejector', label: 'col.pneumEjector' },
      { key: 'ejector_stroke_mm', label: 'col.ejectorStroke' },
      { key: 'ejector_thread', label: 'col.ejectorThread' },
      { key: 'ejector_max_travel_mm', label: 'col.ejectorMax' },
    ]
  },
  {
    group: 'col.group.interfaces',
    color: 'rgba(221, 160, 221, 1)', // Soft Purple
    columns: [
      { key: 'mechanical_interface_tool', label: 'col.mechTool' },
      { key: 'mechanical_interface_robot', label: 'col.mechRobot' },
      { key: 'electrical_interface_tool', label: 'col.elecTool' },
      { key: 'electrical_interface_hotrunner', label: 'col.elecHotRun' },
      { key: 'electrical_interface_ejector', label: 'col.elecEjector' },
      { key: 'electrical_interface_corepull', label: 'col.elecCorePull' },
      { key: 'electrical_interface_robot', label: 'col.elecRobot' },
    ]
  },
  {
    group: 'col.group.injUnit1',
    color: 'rgba(144, 238, 144, 1)', // Soft Green
    columns: [
      { key: 'iu1_screw_diameter_mm', label: 'col.screw' },
      { key: 'iu1_shot_volume_cm3', label: 'col.shot' },
      { key: 'iu1_injection_flow_cm3s', label: 'col.flow' },
      { key: 'iu1_plasticizing_rate_gs', label: 'col.plast' },
      { key: 'iu1_ld_ratio', label: 'col.ld' },
      { key: 'iu1_injection_pressure_bar', label: 'col.press' },
      { key: 'iu1_shot_weight_g', label: 'col.wt' },
      { key: 'iu1_screw_type', label: 'col.screwType' },
      { key: 'iu1_nozzle', label: 'col.nozzle' },
    ]
  },
  {
    group: 'col.group.injUnit2',
    color: 'rgba(255, 130, 130, 1)', // Soft Red
    columns: [
      { key: 'iu2_screw_diameter_mm', label: 'col.screw' },
      { key: 'iu2_shot_volume_cm3', label: 'col.shot' },
      { key: 'iu2_injection_flow_cm3s', label: 'col.flow' },
      { key: 'iu2_plasticizing_rate_gs', label: 'col.plast' },
      { key: 'iu2_ld_ratio', label: 'col.ld' },
      { key: 'iu2_injection_pressure_bar', label: 'col.press' },
      { key: 'iu2_shot_weight_g', label: 'col.wt' },
      { key: 'iu2_screw_type', label: 'col.screwType' },
      { key: 'iu2_nozzle', label: 'col.nozzle' },
    ]
  },
  {
    group: 'col.group.robot',
    color: 'rgba(255, 192, 203, 1)', // Soft Pink
    columns: [
      { key: 'robot_manufacturer', label: 'col.robotMfg' },
      { key: 'robot_model', label: 'col.robotModel' },
      { key: 'robot_serial', label: 'col.robotSerial' },
      { key: 'robot_vacuum_circuits', label: 'col.vacuum' },
      { key: 'robot_air_circuits', label: 'col.air' },
      { key: 'robot_electrical_signals', label: 'col.signals' },
    ]
  },
  {
    group: 'col.group.additionalInfo',
    color: 'rgba(211, 211, 211, 1)', // Soft Gray
    columns: [
      { key: 'special_controls', label: 'col.specialControls' },
      { key: 'remarks', label: 'col.remarks' },
      { key: 'plant_location', label: 'col.plant' },
    ]
  }
];

// Flatten for easier access
const COLUMNS = COLUMN_GROUPS.flatMap(g => g.columns);

// Create a map of column key -> color for quick lookup
const columnColorMap = new Map<string, string>();
COLUMN_GROUPS.forEach(group => {
  group.columns.forEach(col => {
    columnColorMap.set(col.key, group.color);
  });
});

const getColumnColor = (key: string): string => {
  const color = columnColorMap.get(key) || 'transparent';
  // Make data row colors more transparent (12% opacity instead of 100%)
  return color.replace(', 1)', ', 0.12)');
};

const getFirstRowColumnColor = (key: string): string => {
  const color = columnColorMap.get(key) || 'transparent';
  // First row uses full opacity
  return color.replace(', 0.12)', ', 1)').replace(', 1)', ', 1)');
};

// Get solid header color (fully opaque) for sticky headers
const getHeaderColor = (color: string): string => {
  // Ensure headers use full opacity (already at 1 in the color definition)
  // This prevents any transparency issues with sticky positioning
  return color.replace(', 0.12)', ', 1)').replace(', 0.5)', ', 1)');
};

const formatValue = (value: any, key: string): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key === 'clamping_force_kn' && value) return `${Math.round(toNum(value))}`;
  if (typeof value === 'number') return value.toString();
  return String(value);
};

export const MachineListPage: React.FC<MachineListPageProps> = ({ onNavigate, darkMode = true }) => {
  const { t } = useLanguage();
  const [machines, setMachines] = useState<any[]>([]);
  const [allMachines, setAllMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [plant, setPlant] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [clampingMin, setClampingMin] = useState('');
  const [clampingMax, setClampingMax] = useState('');
  const [screwMin, setScrewMin] = useState('');
  const [screwMax, setScrewMax] = useState('');
  const [screw2Min, setScrew2Min] = useState('');
  const [screw2Max, setScrew2Max] = useState('');
  const [vol1Min, setVol1Min] = useState('');
  const [vol1Max, setVol1Max] = useState('');
  const [vol2Min, setVol2Min] = useState('');
  const [vol2Max, setVol2Max] = useState('');
  const [muCell, setMuCell] = useState('');
  const [twoShot, setTwoShot] = useState('');
  const [hasRobot, setHasRobot] = useState('');
  const [rotaryTable, setRotaryTable] = useState('');
  const [sortKey, setSortKey] = useState<string>('internal_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleWamDownload = async (fileId: number, fileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fileService.download(fileId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error('WAM download failed', err);
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      try {
        const res = await machineService.list({ limit: 1000 });
        setAllMachines(res.data.machines || []);
        setMachines(res.data.machines || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load machines');
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const manufacturers = [...new Set(allMachines.map((m: any) => m.manufacturer).filter(Boolean))].sort();
  const screwDiameters = [...new Set(allMachines.map((m: any) => m.iu1_screw_diameter_mm).filter(Boolean))]
    .map(Number).sort((a, b) => a - b);
  const screw2Diameters = [...new Set(allMachines.map((m: any) => m.iu2_screw_diameter_mm).filter(Boolean))]
    .map(Number).sort((a, b) => a - b);
  const clampingValues = [...new Set(allMachines.map((m: any) => m.clamping_force_kn).filter(Boolean))]
    .map(Number).sort((a, b) => a - b);
  const vol1Values = [...new Set(allMachines.map((m: any) => m.iu1_shot_volume_cm3).filter(Boolean))].map(Number).sort((a, b) => a - b);
  const vol2Values = [...new Set(allMachines.map((m: any) => m.iu2_shot_volume_cm3).filter(Boolean))].map(Number).sort((a, b) => a - b);

  useEffect(() => {
    let filtered = allMachines;
    if (search) {
      filtered = filtered.filter((m: any) =>
        m.internal_name?.toLowerCase().includes(search.toLowerCase()) ||
        m.manufacturer?.toLowerCase().includes(search.toLowerCase()) ||
        m.model?.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (plant) filtered = filtered.filter((m: any) => m.plant_location === plant);
    if (manufacturer) filtered = filtered.filter((m: any) => m.manufacturer === manufacturer);
    if (clampingMin) filtered = filtered.filter((m: any) => toNum(m.clamping_force_kn) >= toNum(clampingMin));
    if (clampingMax) filtered = filtered.filter((m: any) => toNum(m.clamping_force_kn) <= toNum(clampingMax));
    if (screwMin) filtered = filtered.filter((m: any) => toNum(m.iu1_screw_diameter_mm) >= toNum(screwMin));
    if (screwMax) filtered = filtered.filter((m: any) => toNum(m.iu1_screw_diameter_mm) <= toNum(screwMax));
    if (screw2Min) filtered = filtered.filter((m: any) => toNum(m.iu2_screw_diameter_mm) >= toNum(screw2Min));
    if (screw2Max) filtered = filtered.filter((m: any) => toNum(m.iu2_screw_diameter_mm) <= toNum(screw2Max));
    if (vol1Min) filtered = filtered.filter((m: any) => toNum(m.iu1_shot_volume_cm3) >= toNum(vol1Min));
    if (vol1Max) filtered = filtered.filter((m: any) => toNum(m.iu1_shot_volume_cm3) <= toNum(vol1Max));
    if (vol2Min) filtered = filtered.filter((m: any) => toNum(m.iu2_shot_volume_cm3) >= toNum(vol2Min));
    if (vol2Max) filtered = filtered.filter((m: any) => toNum(m.iu2_shot_volume_cm3) <= toNum(vol2Max));
    if (muCell === 'yes') filtered = filtered.filter((m: any) => m.mucell === true);
    if (muCell === 'no') filtered = filtered.filter((m: any) => !m.mucell);
    if (twoShot === 'yes') filtered = filtered.filter((m: any) => m.iu2_screw_diameter_mm);
    if (twoShot === 'no') filtered = filtered.filter((m: any) => !m.iu2_screw_diameter_mm);
    if (hasRobot === 'yes') filtered = filtered.filter((m: any) => m.robot_manufacturer);
    if (hasRobot === 'no') filtered = filtered.filter((m: any) => !m.robot_manufacturer);
    if (rotaryTable === 'yes') filtered = filtered.filter((m: any) => m.rotary_table === true || m.rotary_table === 'Yes');
    if (rotaryTable === 'no') filtered = filtered.filter((m: any) => !m.rotary_table || m.rotary_table === 'No');
    filtered = [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    setMachines(filtered);
  }, [search, plant, manufacturer, clampingMin, clampingMax, screwMin, screwMax, screw2Min, screw2Max, vol1Min, vol1Max, vol2Min, vol2Max, muCell, twoShot, hasRobot, rotaryTable, allMachines, sortKey, sortDir]);

  const bg = darkMode ? '#111827' : '#ffffff';
  const headerBg = darkMode ? '#1f2937' : '#f3f4f6';
  const borderColor = darkMode ? '#4b5563' : '#9ca3af';
  const textColor = darkMode ? '#1f2937' : '#111827'; // Dark text for table headers (on light pastel)
  const uiTextColor = darkMode ? '#e5e7eb' : '#111827'; // Light text for UI controls in dark mode
  const rowEven = darkMode ? '#111827' : '#ffffff';
  const rowOdd = darkMode ? '#1a2535' : '#f9fafb';
  const rowHover = darkMode ? '#2d3748' : '#eff6ff';

  return (
    <div style={{ padding: '24px 24px 0 24px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>

      {/* Header + filters */}
      <div style={{ marginBottom: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: uiTextColor }}>
            {t('machines.machinesCount')} ({machines.length})
          </h2>
          <button
            onClick={() => {
              setSearch(''); setPlant(''); setManufacturer('');
              setClampingMin(''); setClampingMax('');
              setScrewMin(''); setScrewMax('');
              setScrew2Min(''); setScrew2Max('');
              setVol1Min(''); setVol1Max('');
              setVol2Min(''); setVol2Max('');
              setTwoShot(''); setHasRobot(''); setRotaryTable(''); setMuCell('');
            }}
            style={{ padding: '6px 14px', border: `1px solid ${borderColor}`, borderRadius: '6px', backgroundColor: '#ef4444', color: '#fff', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {t('machines.clearFilters')}
          </button>
        </div>

        {/* Grouped filter boxes */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>

          {/* Machine Info — blue */}
          <div style={{ flex: 3, backgroundColor: 'rgba(173, 216, 230, 0.15)', border: '1px solid rgba(173, 216, 230, 0.5)', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#1a6080', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('filter.machineInfo')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('machines.searchPlaceholder')}
                style={{ padding: '5px 8px', border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: headerBg, color: uiTextColor, fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: '4px' }}>
                <select value={plant} onChange={(e) => setPlant(e.target.value)}
                  style={{ flex: 1, padding: '5px 4px', border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: headerBg, color: uiTextColor, fontSize: '12px' }}>
                  <option value="">{t('machines.allPlants')}</option>
                  <option value="USA">USA</option>
                  <option value="Mexico">Mexico</option>
                </select>
                <select value={manufacturer} onChange={(e) => setManufacturer(e.target.value)}
                  style={{ flex: 2, padding: '5px 4px', border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: headerBg, color: uiTextColor, fontSize: '12px' }}>
                  <option value="">{t('machines.allManufacturers')}</option>
                  {manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={twoShot} onChange={(e) => setTwoShot(e.target.value)}
                  style={{ flex: 1, padding: '5px 4px', border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: headerBg, color: uiTextColor, fontSize: '12px' }}>
                  <option value="">{t('filter.twoShotAll')}</option>
                  <option value="yes">{t('filter.twoShotYes')}</option>
                  <option value="no">{t('filter.twoShotNo')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Clamping Unit — yellow */}
          <div style={{ flex: 1.5, backgroundColor: 'rgba(255, 255, 153, 0.15)', border: '1px solid rgba(255, 220, 50, 0.5)', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#7a6a00', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('filter.clampingUnit')}</div>
            <div style={{ fontSize: '11px', color: uiTextColor, opacity: 0.8, marginBottom: '3px' }}>{t('filter.force')}</div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <select value={clampingMin} onChange={(e) => setClampingMin(e.target.value)}
                style={{ flex: 1, padding: '5px 4px', border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: headerBg, color: uiTextColor, fontSize: '12px' }}>
                <option value="">{t('machines.min')}</option>
                {clampingValues.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <span style={{ color: uiTextColor, opacity: 0.5, fontSize: '12px' }}>–</span>
              <select value={clampingMax} onChange={(e) => setClampingMax(e.target.value)}
                style={{ flex: 1, padding: '5px 4px', border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: headerBg, color: uiTextColor, fontSize: '12px' }}>
                <option value="">{t('machines.max')}</option>
                {clampingValues.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Injection Unit 1 — green */}
          <div style={{ flex: 2, backgroundColor: 'rgba(144, 238, 144, 0.15)', border: '1px solid rgba(100, 200, 100, 0.5)', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#1a6b1a', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('filter.injectionUnit1')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>
                <div style={{ fontSize: '11px', color: uiTextColor, opacity: 0.8, marginBottom: '2px' }}>{t('filter.screwDiam')}</div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <select value={screwMin} onChange={(e) => setScrewMin(e.target.value)}
                    style={{ flex: 1, padding: '5px 4px', border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: headerBg, color: uiTextColor, fontSize: '12px' }}>
                    <option value="">{t('machines.min')}</option>
                    {screwDiameters.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <span style={{ color: uiTextColor, opacity: 0.5, fontSize: '12px' }}>–</span>
                  <select value={screwMax} onChange={(e) => setScrewMax(e.target.value)}
                    style={{ flex: 1, padding: '5px 4px', border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: headerBg, color: uiTextColor, fontSize: '12px' }}>
                    <option value="">{t('machines.max')}</option>
                    {screwDiameters.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: uiTextColor, opacity: 0.8, marginBottom: '2px' }}>{t('filter.volume')}</div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <select value={vol1Min} onChange={(e) => setVol1Min(e.target.value)}
                    style={{ flex: 1, padding: '5px 4px', border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: headerBg, color: uiTextColor, fontSize: '12px' }}>
                    <option value="">{t('machines.min')}</option>
                    {vol1Values.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <span style={{ color: uiTextColor, opacity: 0.5, fontSize: '12px' }}>–</span>
                  <select value={vol1Max} onChange={(e) => setVol1Max(e.target.value)}
                    style={{ flex: 1, padding: '5px 4px', border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: headerBg, color: uiTextColor, fontSize: '12px' }}>
                    <option value="">{t('machines.max')}</option>
                    {vol1Values.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Injection Unit 2 — red */}
          <div style={{ flex: 2, backgroundColor: 'rgba(255, 130, 130, 0.15)', border: '1px solid rgba(220, 80, 80, 0.5)', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#7a1a1a', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('filter.injectionUnit2')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>
                <div style={{ fontSize: '11px', color: uiTextColor, opacity: 0.8, marginBottom: '2px' }}>{t('filter.screwDiam')}</div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <select value={screw2Min} onChange={(e) => setScrew2Min(e.target.value)}
                    style={{ flex: 1, padding: '5px 4px', border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: headerBg, color: uiTextColor, fontSize: '12px' }}>
                    <option value="">{t('machines.min')}</option>
                    {screw2Diameters.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <span style={{ color: uiTextColor, opacity: 0.5, fontSize: '12px' }}>–</span>
                  <select value={screw2Max} onChange={(e) => setScrew2Max(e.target.value)}
                    style={{ flex: 1, padding: '5px 4px', border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: headerBg, color: uiTextColor, fontSize: '12px' }}>
                    <option value="">{t('machines.max')}</option>
                    {screw2Diameters.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: uiTextColor, opacity: 0.8, marginBottom: '2px' }}>{t('filter.volume')}</div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <select value={vol2Min} onChange={(e) => setVol2Min(e.target.value)}
                    style={{ flex: 1, padding: '5px 4px', border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: headerBg, color: uiTextColor, fontSize: '12px' }}>
                    <option value="">{t('machines.min')}</option>
                    {vol2Values.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <span style={{ color: uiTextColor, opacity: 0.5, fontSize: '12px' }}>–</span>
                  <select value={vol2Max} onChange={(e) => setVol2Max(e.target.value)}
                    style={{ flex: 1, padding: '5px 4px', border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: headerBg, color: uiTextColor, fontSize: '12px' }}>
                    <option value="">{t('machines.max')}</option>
                    {vol2Values.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Robot — pink */}
          <div style={{ flex: 1, backgroundColor: 'rgba(255, 192, 203, 0.15)', border: '1px solid rgba(220, 130, 150, 0.5)', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#6b1a3d', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('filter.robot')}</div>
            <div style={{ fontSize: '11px', color: uiTextColor, opacity: 0.8, marginBottom: '2px' }}>{t('filter.hasRobot')}</div>
            <select value={hasRobot} onChange={(e) => setHasRobot(e.target.value)}
              style={{ width: '100%', padding: '5px 4px', border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: headerBg, color: uiTextColor, fontSize: '12px' }}>
              <option value="">{t('machines.all')}</option>
              <option value="yes">{t('machines.yes')}</option>
              <option value="no">{t('machines.no')}</option>
            </select>
          </div>

          {/* Additional — gray */}
          <div style={{ flex: 1.5, backgroundColor: 'rgba(211, 211, 211, 0.12)', border: '1px solid rgba(150, 150, 150, 0.4)', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: darkMode ? '#9ca3af' : '#4b5563', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('filter.additional')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: uiTextColor, opacity: 0.8, whiteSpace: 'nowrap' }}>{t('filter.rotary')}</span>
                <select value={rotaryTable} onChange={(e) => setRotaryTable(e.target.value)}
                  style={{ flex: 1, padding: '5px 4px', border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: headerBg, color: uiTextColor, fontSize: '12px' }}>
                  <option value="">{t('machines.all')}</option>
                  <option value="yes">{t('machines.yes')}</option>
                  <option value="no">{t('machines.no')}</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: uiTextColor, opacity: 0.8, whiteSpace: 'nowrap' }}>{t('filter.mucell')}</span>
                <select value={muCell} onChange={(e) => setMuCell(e.target.value)}
                  style={{ flex: 1, padding: '5px 4px', border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: headerBg, color: uiTextColor, fontSize: '12px' }}>
                  <option value="">{t('machines.all')}</option>
                  <option value="yes">{t('machines.yes')}</option>
                  <option value="no">{t('machines.no')}</option>
                </select>
              </div>
            </div>
          </div>

        </div>
      </div>

      {error && <div style={{ color: 'red', marginBottom: '12px' }}>Error: {error}</div>}

      {loading ? (
        <div style={{ color: uiTextColor, padding: '16px' }}>{t('machines.loading')}</div>
      ) : machines.length === 0 ? (
        <div style={{ color: uiTextColor, padding: '16px' }}>{t('machines.noFound')}</div>
      ) : (
        /* Scrollable table container */
        <div style={{
          flex: 1,
          overflow: 'auto',
          border: `1px solid ${borderColor}`,
          borderRadius: '8px',
          backgroundColor: bg,
          marginBottom: '8px',
        }}>
          <table style={{
            borderCollapse: 'collapse',
            whiteSpace: 'nowrap',
            fontSize: '11px',
            color: textColor,
          }}>
            <thead>
              {/* Group header row - scrollable, not sticky on first column */}
              <tr style={{ position: 'sticky', top: 0, zIndex: 3 }}>
                {COLUMN_GROUPS.map((group) => (
                  <th
                    key={group.group}
                    colSpan={group.columns.length}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'center',
                      fontWeight: '700',
                      fontSize: '11px',
                      borderBottom: `2px solid ${borderColor}`,
                      borderRight: `2px solid ${borderColor}`,
                      backgroundColor: getHeaderColor(group.color),
                      color: '#1a1a1a',
                    }}
                  >
                    {t(group.group)}
                  </th>
                ))}
              </tr>
              {/* Column header row */}
              <tr style={{ position: 'sticky', top: '32px', zIndex: 2 }}>
                {COLUMNS.map((col, colIdx) => {
                  const colGroup = COLUMN_GROUPS.find(g => g.columns.some(c => c.key === col.key));
                  const colColor = colGroup ? colGroup.color : 'rgba(200, 200, 200, 1)';
                  const isActive = sortKey === col.key;
                  return (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{
                        padding: '8px 6px',
                        textAlign: 'center',
                        fontWeight: '600',
                        fontSize: '10px',
                        borderBottom: `1px solid #555555`,
                        borderRight: `1px solid #555555`,
                        backgroundColor: getHeaderColor(colColor),
                        color: '#000000',
                        cursor: 'pointer',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                        ...(colIdx === 0 ? { position: 'sticky', left: 0, zIndex: 4 } : {})
                      }}
                    >
                      {t(col.label)}
                      <span style={{ marginLeft: '4px', opacity: isActive ? 1 : 0.3, fontSize: '9px' }}>
                        {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {machines.map((m, idx) => {
                const suspFields: string[] = Array.isArray(m.suspicious_fields) ? m.suspicious_fields : [];
                return (
                <tr
                  key={m.id}
                  style={{ backgroundColor: idx % 2 === 0 ? rowEven : rowOdd, cursor: 'pointer' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = rowHover; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = idx % 2 === 0 ? rowEven : rowOdd; }}
                  onClick={() => onNavigate('machine', m.id)}
                >
                  {COLUMNS.map((col, colIdx) => {
                    const isSusp = suspFields.includes(col.key);
                    return (
                      <td
                        key={col.key}
                        style={{
                          padding: '6px 4px',
                          borderBottom: `1px solid ${borderColor}`,
                          borderRight: `1px solid ${borderColor}`,
                          textAlign: col.key.includes('_mm') || col.key.includes('_kg') || col.key.includes('_cm') || col.key.includes('_bar') || col.key.includes('_kn') || col.key.includes('_gs') ? 'right' : 'left',
                          maxWidth: '150px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontSize: '11px',
                          backgroundColor: isSusp ? 'rgba(251, 146, 60, 0.55)' : colIdx === 0 ? getFirstRowColumnColor(col.key) : getColumnColor(col.key),
                          color: isSusp ? '#431407' : colIdx === 0 ? '#000000' : darkMode ? '#ffffff' : '#111827',
                          ...(colIdx === 0 ? { position: 'sticky', left: 0, zIndex: 1 } : {})
                        }}
                        title={isSusp ? '⚑ Suspicious / needs validation' : undefined}
                      >
                        {isSusp ? '⚑ ' : ''}{formatValue(m[col.key], col.key)}
                        {col.key === 'internal_name' && m.wam_file_id && (
                          <button
                            onClick={e => handleWamDownload(m.wam_file_id, m.wam_file_name, e)}
                            title={`Download WAM: ${m.wam_file_name}`}
                            style={{ marginLeft: '6px', padding: '1px 5px', fontSize: '9px', color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: '3px', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: '700', verticalAlign: 'middle' }}
                          >
                            {t('machines.downloadWam')}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
