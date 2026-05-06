import React, { useEffect, useState } from 'react';
import { machineService, fileService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import MachineSketch from '../components/MachineSketch';

interface MachineDetailPageProps {
  machineId: number;
  onNavigate: (page: string, params?: any) => void;
  darkMode?: boolean;
}

const field = (label: string, dbKey: string, value: any, unit?: string) => {
  if (value === null || value === undefined || value === '') return null;
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : `${value}${unit ? ' ' + unit : ''}`;
  return { label, key: dbKey, display };
};

export const MachineDetailPage: React.FC<MachineDetailPageProps> = ({ machineId, onNavigate, darkMode = true }) => {
  const [machine, setMachine] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [tab, setTab] = useState<'specs' | 'sketch' | 'files' | 'revisions'>('specs');
  const [loading, setLoading] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const { user } = useAuth();

  const bg = darkMode ? '#111827' : '#ffffff';
  const cardBg = darkMode ? '#1f2937' : '#f9fafb';
  const borderColor = darkMode ? '#374151' : '#e5e7eb';
  const textPrimary = darkMode ? '#f9fafb' : '#111827';
  const textSecondary = darkMode ? '#9ca3af' : '#6b7280';

  useEffect(() => { loadData(); }, [machineId]);

  const loadData = async () => {
    try {
      const [machineRes, filesRes, revisionsRes] = await Promise.all([
        machineService.get(machineId),
        fileService.list(machineId),
        machineService.getRevisions(machineId),
      ]);
      setMachine(machineRes.data);
      setFiles(filesRes.data);
      setRevisions(revisionsRes.data);
    } catch (error) {
      console.error('Failed to load machine:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    try {
      await fileService.upload(machineId, uploadFile, 'document', 'Uploaded document');
      setUploadFile(null);
      await loadData();
    } catch (error) {
      console.error('Failed to upload file:', error);
    }
  };

  const handleFileDownload = async (fileId: number, fileName: string) => {
    try {
      const res = await fileService.download(fileId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };

  if (loading) return <div style={{ padding: '24px', color: textPrimary }}>Loading...</div>;
  if (!machine) return <div style={{ padding: '24px', color: textPrimary }}>Machine not found</div>;

  const scrollContainer: React.CSSProperties = {
    height: 'calc(100vh - 64px)',
    overflowY: 'auto',
    backgroundColor: bg,
  };

  const suspFields: string[] = Array.isArray(machine.suspicious_fields) ? machine.suspicious_fields : [];

  const sectionColors: Record<string, string> = {
    'Dimensions': '#93c5fd',
    'Clamping Unit': '#fde68a',
    'Tool Connections': '#fdba74',
    'Interfaces': '#d8b4fe',
    'Injection Unit 1': '#86efac',
    'Injection Unit 2': '#fca5a5',
    'Robot': '#fbcfe8',
    'Additional Info': '#d1d5db',
  };

  const sections = [
    {
      title: 'Dimensions',
      rows: [
        field('Length', 'length_mm', machine.length_mm, 'mm'),
        field('Width', 'width_mm', machine.width_mm, 'mm'),
        field('Height', 'height_mm', machine.height_mm, 'mm'),
        field('Weight', 'weight_kg', machine.weight_kg, 'kg'),
      ]
    },
    {
      title: 'Clamping Unit',
      rows: [
        field('Clamping Force', 'clamping_force_t', machine.clamping_force_t, 't'),
        field('2K Type', 'two_k_type',
          machine.two_k_type === '2k_turntable' ? '2K — Turntable' :
          machine.two_k_type === '2k_no_turntable' ? '2K — No turntable' :
          machine.two_k_type === 'parallel_injection' ? 'Parallel injection' :
          '1K (single component)'),
        field('Centering Ring Nozzle', 'centering_ring_nozzle_mm', machine.centering_ring_nozzle_mm, 'mm'),
        field('Centering Ring Ejector', 'centering_ring_ejector_mm', machine.centering_ring_ejector_mm, 'mm'),
        field('Fine Centering', 'fine_centering', machine.fine_centering),
        field('Mold Height Min', 'mold_height_min_mm', machine.mold_height_min_mm, 'mm'),
        field('Mold Height Max', 'mold_height_max_mm', machine.mold_height_max_mm, 'mm'),
        field('Opening Stroke', 'opening_stroke_mm', machine.opening_stroke_mm, 'mm'),
        field('Clearance H', 'clearance_horizontal_mm', machine.clearance_horizontal_mm, 'mm'),
        field('Clearance V', 'clearance_vertical_mm', machine.clearance_vertical_mm, 'mm'),
        field('Rotary Table', 'rotary_table', machine.rotary_table),
        field('Max Weight Ejector', 'max_weight_ejector_kg', machine.max_weight_ejector_kg, 'kg'),
      ]
    },
    {
      title: 'Tool Connections',
      rows: [
        field('Temp Control Circuits', 'temperature_control_circuits', machine.temperature_control_circuits),
        field('Cascade', 'cascade_count', machine.cascade_count),
        field('Hot Runner Integrated', 'hot_runner_integrated', machine.hot_runner_integrated),
        field('Hot Runner External', 'hot_runner_external', machine.hot_runner_external),
        field('Core Pulls Nozzle', 'core_pulls_nozzle', machine.core_pulls_nozzle),
        field('Core Pulls Ejector', 'core_pulls_ejector', machine.core_pulls_ejector),
        field('Pneumatic Nozzle', 'pneumatic_nozzle', machine.pneumatic_nozzle),
        field('Pneumatic Ejector', 'pneumatic_ejector', machine.pneumatic_ejector),
        field('Ejector Stroke', 'ejector_stroke_mm', machine.ejector_stroke_mm, 'mm'),
        field('Ejector Thread', 'ejector_thread', machine.ejector_thread),
        field('Ejector Max Travel', 'ejector_max_travel_mm', machine.ejector_max_travel_mm, 'mm'),
      ]
    },
    {
      title: 'Interfaces',
      rows: [
        field('Mech Interface Tool', 'mechanical_interface_tool', machine.mechanical_interface_tool),
        field('Mech Interface Robot', 'mechanical_interface_robot', machine.mechanical_interface_robot),
        field('Elec Interface Tool', 'electrical_interface_tool', machine.electrical_interface_tool),
        field('Elec Interface Hot Runner', 'electrical_interface_hotrunner', machine.electrical_interface_hotrunner),
        field('Elec Interface Ejector', 'electrical_interface_ejector', machine.electrical_interface_ejector),
        field('Elec Interface Core Pull', 'electrical_interface_corepull', machine.electrical_interface_corepull),
        field('Elec Interface Robot', 'electrical_interface_robot', machine.electrical_interface_robot),
      ]
    },
    {
      title: 'Injection Unit 1',
      rows: [
        field('Screw Diameter', 'iu1_screw_diameter_mm', machine.iu1_screw_diameter_mm, 'mm'),
        field('Shot Volume', 'iu1_shot_volume_cm3', machine.iu1_shot_volume_cm3, 'cm³'),
        field('Injection Flow', 'iu1_injection_flow_cm3s', machine.iu1_injection_flow_cm3s, 'cm³/s'),
        field('Plasticizing Rate', 'iu1_plasticizing_rate_gs', machine.iu1_plasticizing_rate_gs, 'g/s'),
        field('L/D Ratio', 'iu1_ld_ratio', machine.iu1_ld_ratio),
        field('Injection Pressure', 'iu1_injection_pressure_bar', machine.iu1_injection_pressure_bar, 'bar'),
        field('Shot Weight', 'iu1_shot_weight_g', machine.iu1_shot_weight_g, 'g'),
        field('Screw Type', 'iu1_screw_type', machine.iu1_screw_type),
        field('Nozzle', 'iu1_nozzle', machine.iu1_nozzle),
      ]
    },
    ...(machine.iu2_screw_diameter_mm ? [{
      title: 'Injection Unit 2',
      rows: [
        field('Screw Diameter', 'iu2_screw_diameter_mm', machine.iu2_screw_diameter_mm, 'mm'),
        field('Shot Volume', 'iu2_shot_volume_cm3', machine.iu2_shot_volume_cm3, 'cm³'),
        field('Injection Flow', 'iu2_injection_flow_cm3s', machine.iu2_injection_flow_cm3s, 'cm³/s'),
        field('Plasticizing Rate', 'iu2_plasticizing_rate_gs', machine.iu2_plasticizing_rate_gs, 'g/s'),
        field('L/D Ratio', 'iu2_ld_ratio', machine.iu2_ld_ratio),
        field('Injection Pressure', 'iu2_injection_pressure_bar', machine.iu2_injection_pressure_bar, 'bar'),
        field('Shot Weight', 'iu2_shot_weight_g', machine.iu2_shot_weight_g, 'g'),
        field('Screw Type', 'iu2_screw_type', machine.iu2_screw_type),
        field('Nozzle', 'iu2_nozzle', machine.iu2_nozzle),
      ]
    }] : []),
    ...(machine.robot_manufacturer ? [{
      title: 'Robot',
      rows: [
        field('Manufacturer', 'robot_manufacturer', machine.robot_manufacturer),
        field('Model', 'robot_model', machine.robot_model),
        field('Serial', 'robot_serial', machine.robot_serial),
        field('Vacuum Circuits', 'robot_vacuum_circuits', machine.robot_vacuum_circuits),
        field('Air Circuits', 'robot_air_circuits', machine.robot_air_circuits),
        field('Electrical Signals', 'robot_electrical_signals', machine.robot_electrical_signals),
      ]
    }] : []),
    {
      title: 'Additional Info',
      rows: [
        field('Special Controls', 'special_controls', machine.special_controls),
        field('MuCell', 'mucell', machine.mucell),
        field('Remarks', 'remarks', machine.remarks),
      ]
    },
  ];

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 24px',
    cursor: 'pointer',
    background: active ? (darkMode ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)') : 'none',
    border: 'none',
    borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
    borderRadius: '6px 6px 0 0',
    color: active ? '#3b82f6' : textSecondary,
    fontWeight: active ? '600' : '400',
    fontSize: '13px',
    transition: 'all 0.15s',
    letterSpacing: '0.01em',
  });

  return (
    <div style={scrollContainer}>
    <div style={{ padding: '24px', color: textPrimary }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '26px', fontWeight: '700', color: textPrimary, letterSpacing: '-0.01em' }}>{machine.internal_name}</h2>
        <button
          onClick={() => onNavigate('machines')}
          style={{ padding: '8px 18px', backgroundColor: darkMode ? 'rgba(55,65,81,0.5)' : cardBg, border: `1px solid ${borderColor}`, borderRadius: '8px', color: textPrimary, cursor: 'pointer', fontSize: '13px', fontWeight: '500', transition: 'all 0.15s' }}
        >
          Back
        </button>
      </div>

      {/* Suspicious warning banner */}
      {suspFields.length > 0 && (
        <div style={{ backgroundColor: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.5)', borderRadius: '8px', padding: '10px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#f97316', fontSize: '16px' }}>⚑</span>
          <span style={{ color: '#c2410c', fontSize: '13px', fontWeight: '600' }}>
            {suspFields.length} field{suspFields.length !== 1 ? 's' : ''} flagged as suspicious / needs validation: {suspFields.join(', ')}
          </span>
        </div>
      )}

      {/* Summary card */}
      <div style={{
        backgroundColor: cardBg,
        border: `1px solid ${borderColor}`,
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        background: darkMode ? 'linear-gradient(135deg, rgba(30,41,59,0.8), rgba(30,41,59,0.4))' : '#ffffff',
      }}>
        {[
          { label: 'Manufacturer', value: machine.manufacturer },
          { label: 'Model', value: machine.model },
          { label: 'Serial #', value: machine.serial_number },
          { label: 'Year', value: machine.year_of_construction },
          { label: 'Plant', value: machine.plant_location },
          { label: 'Order #', value: machine.order_number },
          { label: 'MuCell', value: machine.mucell ? 'Yes' : 'No' },
          { label: 'Clamping Force', value: machine.clamping_force_t ? `${machine.clamping_force_t} t` : '-' },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: '10px', color: textSecondary, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '500' }}>{label}</div>
            <div style={{ fontWeight: '600', color: textPrimary, fontSize: '14px' }}>{value || '-'}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${borderColor}`, marginBottom: '24px' }}>
        <button style={tabStyle(tab === 'specs')} onClick={() => setTab('specs')}>Specifications</button>
        <button style={tabStyle(tab === 'sketch')} onClick={() => setTab('sketch')}>Sketch</button>
        <button style={tabStyle(tab === 'files')} onClick={() => setTab('files')}>Files ({files.length})</button>
        <button style={tabStyle(tab === 'revisions')} onClick={() => setTab('revisions')}>History ({revisions.length})</button>
      </div>

      {/* Specs tab */}
      {tab === 'specs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {sections.map(({ title, rows }) => {
            const filled = rows.filter(Boolean) as { label: string; key: string; display: string }[];
            if (filled.length === 0) return null;
            const accentColor = sectionColors[title] || '#9ca3af';
            return (
              <div key={title} style={{
                backgroundColor: cardBg,
                border: `1px solid ${borderColor}`,
                borderRadius: '10px',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '10px 16px',
                  background: darkMode
                    ? `linear-gradient(135deg, ${accentColor}22, ${accentColor}08)`
                    : `linear-gradient(135deg, ${accentColor}40, ${accentColor}15)`,
                  borderBottom: `2px solid ${accentColor}${darkMode ? '30' : '50'}`,
                }}>
                  <h3 style={{ fontWeight: '700', fontSize: '13px', color: darkMode ? accentColor : '#1a1a1a', letterSpacing: '0.01em' }}>{title}</h3>
                </div>
                <div style={{ padding: '8px 16px 12px' }}>
                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <tbody>
                      {filled.map(({ label, key, display }) => {
                        const isSusp = suspFields.includes(key);
                        return (
                        <tr key={label} style={{ borderBottom: `1px solid ${darkMode ? 'rgba(55,65,81,0.5)' : borderColor}`, backgroundColor: isSusp ? 'rgba(251, 146, 60, 0.12)' : 'transparent' }}>
                          <td style={{ padding: '7px 4px', color: isSusp ? '#c2410c' : textSecondary, width: '55%', fontWeight: isSusp ? '600' : '400', fontSize: '12px' }}>
                            {isSusp && <span style={{ marginRight: '4px' }}>⚑</span>}{label}
                          </td>
                          <td style={{ padding: '7px 4px', color: isSusp ? '#c2410c' : textPrimary, fontWeight: '500', textAlign: 'right', fontSize: '13px' }}>{display}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sketch tab */}
      {tab === 'sketch' && (
        <div style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '20px' }}>
          <MachineSketch machine={machine} darkMode={darkMode} />
        </div>
      )}

      {/* Files tab */}
      {tab === 'files' && (
        <div style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '24px' }}>
          {user?.role === 'master' && (
            <form onSubmit={handleFileUpload} style={{ marginBottom: '24px', padding: '16px', border: `2px dashed ${borderColor}`, borderRadius: '8px' }}>
              <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} style={{ display: 'block', marginBottom: '8px', color: textPrimary }} />
              <button type="submit" disabled={!uploadFile}
                style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: uploadFile ? 'pointer' : 'not-allowed', opacity: uploadFile ? 1 : 0.5 }}>
                Upload File
              </button>
            </form>
          )}
          {files.length === 0 ? (
            <p style={{ color: textSecondary }}>No files attached</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {files.map((file) => (
                <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: `1px solid ${borderColor}`, borderRadius: '6px' }}>
                  <div>
                    <div style={{ fontWeight: '500', color: textPrimary }}>{file.file_name}</div>
                    <div style={{ fontSize: '12px', color: textSecondary }}>{file.file_type} • {(file.file_size / 1024).toFixed(0)} KB • {new Date(file.uploaded_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleFileDownload(file.id, file.file_name)}
                      style={{ padding: '6px 12px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>Download</button>
                    {user?.role === 'master' && (
                      <button onClick={() => fileService.delete(file.id).then(() => loadData())}
                        style={{ padding: '6px 12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>Delete</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Revisions tab */}
      {tab === 'revisions' && (
        <div style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '24px' }}>
          {revisions.length === 0 ? (
            <p style={{ color: textSecondary }}>No revision history</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {revisions.map((rev) => (
                <div key={rev.id} style={{ border: `1px solid ${borderColor}`, borderRadius: '6px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: '500', color: textPrimary }}>Revision {rev.revision_number}</div>
                      <div style={{ fontSize: '12px', color: textSecondary }}>{rev.change_type?.toUpperCase()}</div>
                      <div style={{ fontSize: '11px', color: textSecondary, marginTop: '4px' }}>{new Date(rev.changed_at).toLocaleString()}{rev.username ? ` by ${rev.username}` : ''}</div>
                    </div>
                    <div style={{ fontSize: '13px', color: textPrimary }}>{rev.change_summary}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
};
