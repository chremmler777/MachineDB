import React, { useEffect, useState } from 'react';
import { machineService, fileService } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface MachineDetailPageProps {
  machineId: number;
  onNavigate: (page: string, params?: any) => void;
  darkMode?: boolean;
}

const field = (label: string, value: any, unit?: string) => {
  if (value === null || value === undefined || value === '') return null;
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : `${value}${unit ? ' ' + unit : ''}`;
  return { label, display };
};

export const MachineDetailPage: React.FC<MachineDetailPageProps> = ({ machineId, onNavigate, darkMode = true }) => {
  const [machine, setMachine] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [tab, setTab] = useState<'specs' | 'files' | 'revisions'>('specs');
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

  const sections = [
    {
      title: 'Dimensions',
      rows: [
        field('Length', machine.length_mm, 'mm'),
        field('Width', machine.width_mm, 'mm'),
        field('Height', machine.height_mm, 'mm'),
        field('Weight', machine.weight_kg, 'kg'),
      ]
    },
    {
      title: 'Clamping Unit',
      rows: [
        field('Clamping Force', machine.clamping_force_kn, 't'),
        field('Centering Ring Nozzle', machine.centering_ring_nozzle_mm, 'mm'),
        field('Centering Ring Ejector', machine.centering_ring_ejector_mm, 'mm'),
        field('Fine Centering', machine.fine_centering),
        field('Mold Height Min', machine.mold_height_min_mm, 'mm'),
        field('Mold Height Max', machine.mold_height_max_mm, 'mm'),
        field('Opening Stroke', machine.opening_stroke_mm, 'mm'),
        field('Clearance H', machine.clearance_horizontal_mm, 'mm'),
        field('Clearance V', machine.clearance_vertical_mm, 'mm'),
        field('Rotary Table', machine.rotary_table),
        field('Max Weight Ejector', machine.max_weight_ejector_kg, 'kg'),
      ]
    },
    {
      title: 'Tool Connections',
      rows: [
        field('Temp Control Circuits', machine.temperature_control_circuits),
        field('Cascade', machine.cascade_count),
        field('Hot Runner Integrated', machine.hot_runner_integrated),
        field('Hot Runner External', machine.hot_runner_external),
        field('Core Pulls Nozzle', machine.core_pulls_nozzle),
        field('Core Pulls Ejector', machine.core_pulls_ejector),
        field('Pneumatic Nozzle', machine.pneumatic_nozzle),
        field('Pneumatic Ejector', machine.pneumatic_ejector),
        field('Ejector Stroke', machine.ejector_stroke_mm, 'mm'),
        field('Ejector Thread', machine.ejector_thread),
        field('Ejector Max Travel', machine.ejector_max_travel_mm, 'mm'),
      ]
    },
    {
      title: 'Interfaces',
      rows: [
        field('Mech Interface Tool', machine.mechanical_interface_tool),
        field('Mech Interface Robot', machine.mechanical_interface_robot),
        field('Elec Interface Tool', machine.electrical_interface_tool),
        field('Elec Interface Hot Runner', machine.electrical_interface_hotrunner),
        field('Elec Interface Ejector', machine.electrical_interface_ejector),
        field('Elec Interface Core Pull', machine.electrical_interface_corepull),
        field('Elec Interface Robot', machine.electrical_interface_robot),
      ]
    },
    {
      title: 'Injection Unit 1',
      rows: [
        field('Screw Diameter', machine.iu1_screw_diameter_mm, 'mm'),
        field('Shot Volume', machine.iu1_shot_volume_cm3, 'cm³'),
        field('Injection Flow', machine.iu1_injection_flow_cm3s, 'cm³/s'),
        field('Plasticizing Rate', machine.iu1_plasticizing_rate_gs, 'g/s'),
        field('L/D Ratio', machine.iu1_ld_ratio),
        field('Injection Pressure', machine.iu1_injection_pressure_bar, 'bar'),
        field('Shot Weight', machine.iu1_shot_weight_g, 'g'),
        field('Screw Type', machine.iu1_screw_type),
        field('Nozzle', machine.iu1_nozzle),
      ]
    },
    ...(machine.iu2_screw_diameter_mm ? [{
      title: 'Injection Unit 2',
      rows: [
        field('Screw Diameter', machine.iu2_screw_diameter_mm, 'mm'),
        field('Shot Volume', machine.iu2_shot_volume_cm3, 'cm³'),
        field('Injection Flow', machine.iu2_injection_flow_cm3s, 'cm³/s'),
        field('Plasticizing Rate', machine.iu2_plasticizing_rate_gs, 'g/s'),
        field('L/D Ratio', machine.iu2_ld_ratio),
        field('Injection Pressure', machine.iu2_injection_pressure_bar, 'bar'),
        field('Shot Weight', machine.iu2_shot_weight_g, 'g'),
        field('Screw Type', machine.iu2_screw_type),
        field('Nozzle', machine.iu2_nozzle),
      ]
    }] : []),
    ...(machine.robot_manufacturer ? [{
      title: 'Robot',
      rows: [
        field('Manufacturer', machine.robot_manufacturer),
        field('Model', machine.robot_model),
        field('Serial', machine.robot_serial),
        field('Vacuum Circuits', machine.robot_vacuum_circuits),
        field('Air Circuits', machine.robot_air_circuits),
        field('Electrical Signals', machine.robot_electrical_signals),
      ]
    }] : []),
    {
      title: 'Additional Info',
      rows: [
        field('Special Controls', machine.special_controls),
        field('MuCell', machine.mucell),
        field('Remarks', machine.remarks),
      ]
    },
  ];

  const tabStyle = (active: boolean) => ({
    padding: '8px 20px',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
    color: active ? '#3b82f6' : textSecondary,
    fontWeight: active ? '600' : '400',
    fontSize: '14px',
  });

  return (
    <div style={scrollContainer}>
    <div style={{ padding: '24px', color: textPrimary }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: textPrimary }}>{machine.internal_name}</h2>
        <button
          onClick={() => onNavigate('machines')}
          style={{ padding: '8px 16px', backgroundColor: cardBg, border: `1px solid ${borderColor}`, borderRadius: '8px', color: textPrimary, cursor: 'pointer' }}
        >
          ← Back
        </button>
      </div>

      {/* Summary card */}
      <div style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '16px', marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { label: 'Manufacturer', value: machine.manufacturer },
          { label: 'Model', value: machine.model },
          { label: 'Serial #', value: machine.serial_number },
          { label: 'Year', value: machine.year_of_construction },
          { label: 'Plant', value: machine.plant_location },
          { label: 'Order #', value: machine.order_number },
          { label: 'MuCell', value: machine.mucell ? 'Yes' : 'No' },
          { label: 'Clamping Force', value: machine.clamping_force_kn ? `${machine.clamping_force_kn} t` : '-' },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: '11px', color: textSecondary, marginBottom: '2px' }}>{label}</div>
            <div style={{ fontWeight: '600', color: textPrimary }}>{value || '-'}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${borderColor}`, marginBottom: '24px' }}>
        <button style={tabStyle(tab === 'specs')} onClick={() => setTab('specs')}>Specifications</button>
        <button style={tabStyle(tab === 'files')} onClick={() => setTab('files')}>Files ({files.length})</button>
        <button style={tabStyle(tab === 'revisions')} onClick={() => setTab('revisions')}>History ({revisions.length})</button>
      </div>

      {/* Specs tab */}
      {tab === 'specs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {sections.map(({ title, rows }) => {
            const filled = rows.filter(Boolean) as { label: string; display: string }[];
            if (filled.length === 0) return null;
            return (
              <div key={title} style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '16px' }}>
                <h3 style={{ fontWeight: '700', fontSize: '14px', marginBottom: '12px', color: textPrimary, borderBottom: `1px solid ${borderColor}`, paddingBottom: '8px' }}>{title}</h3>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <tbody>
                    {filled.map(({ label, display }) => (
                      <tr key={label} style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <td style={{ padding: '6px 0', color: textSecondary, width: '55%' }}>{label}</td>
                        <td style={{ padding: '6px 0', color: textPrimary, fontWeight: '500', textAlign: 'right' }}>{display}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
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
                      <div style={{ fontSize: '11px', color: textSecondary, marginTop: '4px' }}>{new Date(rev.changed_at).toLocaleString()} by {rev.username || 'Unknown'}</div>
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
