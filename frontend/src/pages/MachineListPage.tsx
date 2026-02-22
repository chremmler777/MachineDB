import React, { useEffect, useState } from 'react';
import { machineService } from '../services/api';

interface MachineListPageProps {
  onNavigate: (page: string, params?: any) => void;
  darkMode?: boolean;
}

const toNum = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  return 0;
};

// Column groups matching MachineDataBase.xlsx structure with soft pastel colors (fully opaque)
const COLUMN_GROUPS = [
  {
    group: 'Machine Info',
    color: 'rgba(173, 216, 230, 1)', // Soft Blue
    columns: [
      { key: 'internal_name', label: 'Machine' },
      { key: 'manufacturer', label: 'Manufacturer' },
      { key: 'order_number', label: 'Order #' },
      { key: 'model', label: 'Model' },
      { key: 'serial_number', label: 'Serial #' },
      { key: 'year_of_construction', label: 'Year' },
    ]
  },
  {
    group: 'Machine Dimensions',
    color: 'rgba(175, 238, 238, 1)', // Soft Cyan
    columns: [
      { key: 'length_mm', label: 'Length (mm)' },
      { key: 'width_mm', label: 'Width (mm)' },
      { key: 'height_mm', label: 'Height (mm)' },
      { key: 'weight_kg', label: 'Weight (kg)' },
    ]
  },
  {
    group: 'Clamping Unit',
    color: 'rgba(255, 255, 153, 1)', // Soft Yellow
    columns: [
      { key: 'clamping_force_kn', label: 'Clamping (t)' },
      { key: 'centering_ring_nozzle_mm', label: 'Center Nozzle (mm)' },
      { key: 'centering_ring_ejector_mm', label: 'Center Ejector (mm)' },
      { key: 'fine_centering', label: 'Fine Center' },
      { key: 'mold_height_min_mm', label: 'Mold H Min (mm)' },
      { key: 'mold_height_max_mm', label: 'Mold H Max (mm)' },
      { key: 'opening_stroke_mm', label: 'Opening (mm)' },
      { key: 'clearance_horizontal_mm', label: 'Clear H (mm)' },
      { key: 'clearance_vertical_mm', label: 'Clear V (mm)' },
      { key: 'rotary_table', label: 'Rotary Table' },
      { key: 'max_weight_ejector_kg', label: 'Max Wt (kg)' },
    ]
  },
  {
    group: 'Tool Connections',
    color: 'rgba(255, 218, 185, 1)', // Soft Orange
    columns: [
      { key: 'temperature_control_circuits', label: 'Temp Circuits' },
      { key: 'cascade_count', label: 'Cascade' },
      { key: 'hot_runner_integrated', label: 'Hot Runner Int' },
      { key: 'hot_runner_external', label: 'Hot Runner Ext' },
      { key: 'core_pulls_nozzle', label: 'Core Pulls N' },
      { key: 'core_pulls_ejector', label: 'Core Pulls E' },
      { key: 'pneumatic_nozzle', label: 'Pneum Nozzle' },
      { key: 'pneumatic_ejector', label: 'Pneum Ejector' },
      { key: 'ejector_stroke_mm', label: 'Ejector Stroke (mm)' },
      { key: 'ejector_thread', label: 'Ejector Thread' },
      { key: 'ejector_max_travel_mm', label: 'Ejector Max (mm)' },
    ]
  },
  {
    group: 'Interfaces',
    color: 'rgba(221, 160, 221, 1)', // Soft Purple
    columns: [
      { key: 'mechanical_interface_tool', label: 'Mech Tool' },
      { key: 'mechanical_interface_robot', label: 'Mech Robot' },
      { key: 'electrical_interface_tool', label: 'Elec Tool' },
      { key: 'electrical_interface_hotrunner', label: 'Elec HotRun' },
      { key: 'electrical_interface_ejector', label: 'Elec Ejector' },
      { key: 'electrical_interface_corepull', label: 'Elec CorePull' },
      { key: 'electrical_interface_robot', label: 'Elec Robot' },
    ]
  },
  {
    group: 'Injection Unit 1',
    color: 'rgba(144, 238, 144, 1)', // Soft Green
    columns: [
      { key: 'iu1_screw_diameter_mm', label: 'Screw (mm)' },
      { key: 'iu1_shot_volume_cm3', label: 'Shot (cm³)' },
      { key: 'iu1_injection_flow_cm3s', label: 'Flow (cm³/s)' },
      { key: 'iu1_plasticizing_rate_gs', label: 'Plast (g/s)' },
      { key: 'iu1_ld_ratio', label: 'L/D' },
      { key: 'iu1_injection_pressure_bar', label: 'Press (bar)' },
      { key: 'iu1_shot_weight_g', label: 'Wt (g)' },
      { key: 'iu1_screw_type', label: 'Screw Type' },
      { key: 'iu1_nozzle', label: 'Nozzle' },
    ]
  },
  {
    group: 'Injection Unit 2',
    color: 'rgba(255, 130, 130, 1)', // Soft Red
    columns: [
      { key: 'iu2_screw_diameter_mm', label: 'Screw (mm)' },
      { key: 'iu2_shot_volume_cm3', label: 'Shot (cm³)' },
      { key: 'iu2_injection_flow_cm3s', label: 'Flow (cm³/s)' },
      { key: 'iu2_plasticizing_rate_gs', label: 'Plast (g/s)' },
      { key: 'iu2_ld_ratio', label: 'L/D' },
      { key: 'iu2_injection_pressure_bar', label: 'Press (bar)' },
      { key: 'iu2_shot_weight_g', label: 'Wt (g)' },
      { key: 'iu2_screw_type', label: 'Screw Type' },
      { key: 'iu2_nozzle', label: 'Nozzle' },
    ]
  },
  {
    group: 'Robot',
    color: 'rgba(255, 192, 203, 1)', // Soft Pink
    columns: [
      { key: 'robot_manufacturer', label: 'Mfg' },
      { key: 'robot_model', label: 'Model' },
      { key: 'robot_serial', label: 'Serial' },
      { key: 'robot_vacuum_circuits', label: 'Vacuum' },
      { key: 'robot_air_circuits', label: 'Air' },
      { key: 'robot_electrical_signals', label: 'Signals' },
    ]
  },
  {
    group: 'Additional Info',
    color: 'rgba(211, 211, 211, 1)', // Soft Gray
    columns: [
      { key: 'special_controls', label: 'Special Controls' },
      { key: 'remarks', label: 'Remarks' },
      { key: 'plant_location', label: 'Plant' },
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
  const [twoShot, setTwoShot] = useState('');
  const [hasRobot, setHasRobot] = useState('');
  const [rotaryTable, setRotaryTable] = useState('');
  const [sortKey, setSortKey] = useState<string>('internal_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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
  }, [search, plant, manufacturer, clampingMin, clampingMax, screwMin, screwMax, twoShot, hasRobot, rotaryTable, allMachines, sortKey, sortDir]);

  const bg = darkMode ? '#111827' : '#ffffff';
  const headerBg = darkMode ? '#1f2937' : '#f3f4f6';
  const groupBg = darkMode ? '#2d3748' : '#e5e7eb';
  const borderColor = darkMode ? '#4b5563' : '#9ca3af'; // Darker borders for visibility
  const textColor = darkMode ? '#1f2937' : '#111827'; // Dark text for header readability
  const rowEven = darkMode ? '#111827' : '#ffffff';
  const rowOdd = darkMode ? '#1a2535' : '#f9fafb';
  const rowHover = darkMode ? '#2d3748' : '#eff6ff';

  return (
    <div style={{ padding: '24px 24px 0 24px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>

      {/* Header + filters */}
      <div style={{ marginBottom: '16px', flexShrink: 0 }}>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '12px', color: textColor }}>
          Machines ({machines.length})
        </h2>
        {/* Row 1: Search + Plant + Manufacturer */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search machine, manufacturer, model..."
            style={{ flex: 1, padding: '7px 12px', border: `1px solid ${borderColor}`, borderRadius: '6px', backgroundColor: headerBg, color: textColor, fontSize: '13px' }}
          />
          <select value={plant} onChange={(e) => setPlant(e.target.value)}
            style={{ padding: '7px 10px', border: `1px solid ${borderColor}`, borderRadius: '6px', backgroundColor: headerBg, color: textColor, fontSize: '13px' }}>
            <option value="">All Plants</option>
            <option value="USA">USA</option>
            <option value="Mexico">Mexico</option>
          </select>
          <select value={manufacturer} onChange={(e) => setManufacturer(e.target.value)}
            style={{ padding: '7px 10px', border: `1px solid ${borderColor}`, borderRadius: '6px', backgroundColor: headerBg, color: textColor, fontSize: '13px' }}>
            <option value="">All Manufacturers</option>
            {manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {/* Row 2: Clamping, Screw, 2-Shot, Robot, Rotary */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: textColor, opacity: 0.7 }}>Clamping (t):</span>
          <input type="number" value={clampingMin} onChange={(e) => setClampingMin(e.target.value)} placeholder="Min"
            style={{ width: '70px', padding: '5px 8px', border: `1px solid ${borderColor}`, borderRadius: '6px', backgroundColor: headerBg, color: textColor, fontSize: '13px' }} />
          <span style={{ color: textColor, opacity: 0.5 }}>–</span>
          <input type="number" value={clampingMax} onChange={(e) => setClampingMax(e.target.value)} placeholder="Max"
            style={{ width: '70px', padding: '5px 8px', border: `1px solid ${borderColor}`, borderRadius: '6px', backgroundColor: headerBg, color: textColor, fontSize: '13px' }} />

          <span style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginLeft: '8px' }}>Screw ø (mm):</span>
          <input type="number" value={screwMin} onChange={(e) => setScrewMin(e.target.value)} placeholder="Min"
            style={{ width: '70px', padding: '5px 8px', border: `1px solid ${borderColor}`, borderRadius: '6px', backgroundColor: headerBg, color: textColor, fontSize: '13px' }} />
          <span style={{ color: textColor, opacity: 0.5 }}>–</span>
          <input type="number" value={screwMax} onChange={(e) => setScrewMax(e.target.value)} placeholder="Max"
            style={{ width: '70px', padding: '5px 8px', border: `1px solid ${borderColor}`, borderRadius: '6px', backgroundColor: headerBg, color: textColor, fontSize: '13px' }} />

          <select value={twoShot} onChange={(e) => setTwoShot(e.target.value)}
            style={{ padding: '5px 10px', border: `1px solid ${borderColor}`, borderRadius: '6px', backgroundColor: headerBg, color: textColor, fontSize: '13px', marginLeft: '8px' }}>
            <option value="">2-Shot: All</option>
            <option value="yes">2-Shot: Yes</option>
            <option value="no">2-Shot: No</option>
          </select>

          <select value={hasRobot} onChange={(e) => setHasRobot(e.target.value)}
            style={{ padding: '5px 10px', border: `1px solid ${borderColor}`, borderRadius: '6px', backgroundColor: headerBg, color: textColor, fontSize: '13px' }}>
            <option value="">Robot: All</option>
            <option value="yes">Robot: Yes</option>
            <option value="no">Robot: No</option>
          </select>

          <select value={rotaryTable} onChange={(e) => setRotaryTable(e.target.value)}
            style={{ padding: '5px 10px', border: `1px solid ${borderColor}`, borderRadius: '6px', backgroundColor: headerBg, color: textColor, fontSize: '13px' }}>
            <option value="">Rotary: All</option>
            <option value="yes">Rotary: Yes</option>
            <option value="no">Rotary: No</option>
          </select>
        </div>
      </div>

      {error && <div style={{ color: 'red', marginBottom: '12px' }}>Error: {error}</div>}

      {loading ? (
        <div style={{ color: textColor, padding: '16px' }}>Loading...</div>
      ) : machines.length === 0 ? (
        <div style={{ color: textColor, padding: '16px' }}>No machines found</div>
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
                    {group.group}
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
                      {col.label}
                      <span style={{ marginLeft: '4px', opacity: isActive ? 1 : 0.3, fontSize: '9px' }}>
                        {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {machines.map((m, idx) => (
                <tr
                  key={m.id}
                  style={{ backgroundColor: idx % 2 === 0 ? rowEven : rowOdd, cursor: 'pointer' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = rowHover; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = idx % 2 === 0 ? rowEven : rowOdd; }}
                  onClick={() => onNavigate('machine', m.id)}
                >
                  {COLUMNS.map((col, colIdx) => (
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
                        backgroundColor: colIdx === 0 ? getFirstRowColumnColor(col.key) : getColumnColor(col.key),
                        color: colIdx === 0 ? '#000000' : '#ffffff',
                        ...(colIdx === 0 ? { position: 'sticky', left: 0, zIndex: 1 } : {})
                      }}
                    >
                      {formatValue(m[col.key], col.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
