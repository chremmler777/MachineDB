import React, { useState, useEffect } from 'react';
import { machineService, importService, fileService } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

interface AdminPanelProps {
  darkMode?: boolean;
  onNavigate?: (page: string, params?: any) => void;
}

type FieldDef = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'textarea' | 'select';
  unit?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
};

type SectionDef = { titleKey: string; fields: FieldDef[] };

const FORM_SECTIONS: SectionDef[] = [
  {
    titleKey: 'admin.sectionMachineInfo',
    fields: [
      { key: 'internal_name', label: 'Machine Name', type: 'text', required: true },
      { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
      { key: 'model', label: 'Model', type: 'text' },
      { key: 'serial_number', label: 'Serial Number', type: 'text' },
      { key: 'order_number', label: 'Order Number', type: 'text' },
      { key: 'year_of_construction', label: 'Year', type: 'number' },
      { key: 'plant_location', label: 'Plant', type: 'select', options: [{ value: '', label: '— Select —' }, { value: 'USA', label: 'USA' }, { value: 'Mexico', label: 'Mexico' }] },
    ]
  },
  {
    titleKey: 'admin.sectionDimensions',
    fields: [
      { key: 'length_mm', label: 'Length', type: 'number', unit: 'mm' },
      { key: 'width_mm', label: 'Width', type: 'number', unit: 'mm' },
      { key: 'height_mm', label: 'Height', type: 'number', unit: 'mm' },
      { key: 'weight_kg', label: 'Weight', type: 'number', unit: 'kg' },
    ]
  },
  {
    titleKey: 'admin.sectionClampingUnit',
    fields: [
      { key: 'clamping_force_kn', label: 'Clamping Force', type: 'number', unit: 't' },
      { key: 'centering_ring_nozzle_mm', label: 'Centering Ring Nozzle', type: 'number', unit: 'mm' },
      { key: 'centering_ring_ejector_mm', label: 'Centering Ring Ejector', type: 'number', unit: 'mm' },
      { key: 'fine_centering', label: 'Fine Centering', type: 'boolean' },
      { key: 'mold_height_min_mm', label: 'Mold Height Min', type: 'number', unit: 'mm' },
      { key: 'mold_height_max_mm', label: 'Mold Height Max', type: 'number', unit: 'mm' },
      { key: 'opening_stroke_mm', label: 'Opening Stroke', type: 'number', unit: 'mm' },
      { key: 'clearance_horizontal_mm', label: 'Clearance Horizontal', type: 'number', unit: 'mm' },
      { key: 'clearance_vertical_mm', label: 'Clearance Vertical', type: 'number', unit: 'mm' },
      { key: 'rotary_table', label: 'Rotary Table', type: 'boolean' },
      { key: 'max_weight_nozzle_kg', label: 'Max Weight Nozzle', type: 'number', unit: 'kg' },
      { key: 'max_weight_ejector_kg', label: 'Max Weight Ejector', type: 'number', unit: 'kg' },
    ]
  },
  {
    titleKey: 'admin.sectionToolConnections',
    fields: [
      { key: 'temperature_control_circuits', label: 'Temp Control Circuits', type: 'number' },
      { key: 'cascade_count', label: 'Cascade Count', type: 'number' },
      { key: 'hot_runner_integrated', label: 'Hot Runner Integrated', type: 'boolean' },
      { key: 'hot_runner_external', label: 'Hot Runner External', type: 'boolean' },
      { key: 'core_pulls_nozzle', label: 'Core Pulls Nozzle', type: 'number' },
      { key: 'core_pulls_ejector', label: 'Core Pulls Ejector', type: 'number' },
      { key: 'pneumatic_nozzle', label: 'Pneumatic Nozzle', type: 'boolean' },
      { key: 'pneumatic_ejector', label: 'Pneumatic Ejector', type: 'boolean' },
      { key: 'ejector_stroke_mm', label: 'Ejector Stroke', type: 'number', unit: 'mm' },
      { key: 'ejector_thread', label: 'Ejector Thread', type: 'text' },
      { key: 'ejector_max_travel_mm', label: 'Ejector Max Travel', type: 'number', unit: 'mm' },
    ]
  },
  {
    titleKey: 'admin.sectionInterfaces',
    fields: [
      { key: 'mechanical_interface_tool', label: 'Mech. Interface Tool', type: 'text' },
      { key: 'mechanical_interface_robot', label: 'Mech. Interface Robot', type: 'text' },
      { key: 'electrical_interface_tool', label: 'Elec. Interface Tool', type: 'text' },
      { key: 'electrical_interface_hotrunner', label: 'Elec. Interface Hot Runner', type: 'text' },
      { key: 'electrical_interface_ejector', label: 'Elec. Interface Ejector', type: 'text' },
      { key: 'electrical_interface_corepull', label: 'Elec. Interface Core Pull', type: 'text' },
      { key: 'electrical_interface_robot', label: 'Elec. Interface Robot', type: 'text' },
    ]
  },
  {
    titleKey: 'admin.sectionIU1',
    fields: [
      { key: 'iu1_screw_diameter_mm', label: 'Screw Diameter', type: 'number', unit: 'mm' },
      { key: 'iu1_shot_volume_cm3', label: 'Shot Volume', type: 'number', unit: 'cm³' },
      { key: 'iu1_injection_flow_cm3s', label: 'Injection Flow', type: 'number', unit: 'cm³/s' },
      { key: 'iu1_plasticizing_rate_gs', label: 'Plasticizing Rate', type: 'number', unit: 'g/s' },
      { key: 'iu1_ld_ratio', label: 'L/D Ratio', type: 'number' },
      { key: 'iu1_injection_pressure_bar', label: 'Injection Pressure', type: 'number', unit: 'bar' },
      { key: 'iu1_shot_weight_g', label: 'Shot Weight', type: 'number', unit: 'g' },
      { key: 'iu1_screw_type', label: 'Screw Type', type: 'text' },
      { key: 'iu1_nozzle', label: 'Nozzle', type: 'text' },
    ]
  },
  {
    titleKey: 'admin.sectionIU2',
    fields: [
      { key: 'iu2_screw_diameter_mm', label: 'Screw Diameter', type: 'number', unit: 'mm' },
      { key: 'iu2_shot_volume_cm3', label: 'Shot Volume', type: 'number', unit: 'cm³' },
      { key: 'iu2_injection_flow_cm3s', label: 'Injection Flow', type: 'number', unit: 'cm³/s' },
      { key: 'iu2_plasticizing_rate_gs', label: 'Plasticizing Rate', type: 'number', unit: 'g/s' },
      { key: 'iu2_ld_ratio', label: 'L/D Ratio', type: 'number' },
      { key: 'iu2_injection_pressure_bar', label: 'Injection Pressure', type: 'number', unit: 'bar' },
      { key: 'iu2_shot_weight_g', label: 'Shot Weight', type: 'number', unit: 'g' },
      { key: 'iu2_screw_type', label: 'Screw Type', type: 'text' },
      { key: 'iu2_nozzle', label: 'Nozzle', type: 'text' },
    ]
  },
  {
    titleKey: 'admin.sectionRobot',
    fields: [
      { key: 'robot_manufacturer', label: 'Manufacturer', type: 'text' },
      { key: 'robot_model', label: 'Model', type: 'text' },
      { key: 'robot_serial', label: 'Serial', type: 'text' },
      { key: 'robot_vacuum_circuits', label: 'Vacuum Circuits', type: 'number' },
      { key: 'robot_air_circuits', label: 'Air Circuits', type: 'number' },
      { key: 'robot_electrical_signals', label: 'Electrical Signals', type: 'number' },
    ]
  },
  {
    titleKey: 'admin.sectionMeta',
    fields: [
      { key: 'special_controls', label: 'Special Controls', type: 'textarea' },
      { key: 'mucell', label: 'MuCell', type: 'boolean' },
      { key: 'remarks', label: 'Remarks', type: 'textarea' },
    ]
  },
];

export const AdminPanel: React.FC<AdminPanelProps> = ({ darkMode = true }) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'machines' | 'import' | 'users'>('machines');

  // Machine list state
  const [machines, setMachines] = useState<any[]>([]);
  const [listSearch, setListSearch] = useState('');
  const [loadingList, setLoadingList] = useState(true);

  // Edit state
  const [editingMachine, setEditingMachine] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [suspiciousFields, setSuspiciousFields] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Comments & history
  const [comments, setComments] = useState<any[]>([]);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [revertingId, setRevertingId] = useState<number | null>(null);
  const [deletingRevId, setDeletingRevId] = useState<number | null>(null);
  const [confirmDeleteRevId, setConfirmDeleteRevId] = useState<number | null>(null);
  const [wamFiles, setWamFiles] = useState<any[]>([]);
  const [wamUploadFile, setWamUploadFile] = useState<File | null>(null);
  const [uploadingWam, setUploadingWam] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  const bg = darkMode ? '#111827' : '#f3f4f6';
  const panelBg = darkMode ? '#1f2937' : '#ffffff';
  const borderColor = darkMode ? '#374151' : '#e5e7eb';
  const textPrimary = darkMode ? '#f9fafb' : '#111827';
  const textSecondary = darkMode ? '#9ca3af' : '#6b7280';
  const inputBg = darkMode ? '#111827' : '#ffffff';
  const rowHover = darkMode ? '#2d3748' : '#f0f9ff';

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 8px',
    border: `1px solid ${borderColor}`, borderRadius: '4px',
    backgroundColor: inputBg, color: textPrimary, fontSize: '13px', boxSizing: 'border-box',
  };

  useEffect(() => { loadMachines(); }, []);

  const loadMachines = async () => {
    setLoadingList(true);
    try {
      const res = await machineService.list({ limit: 1000 });
      setMachines(res.data.machines || []);
    } finally {
      setLoadingList(false);
    }
  };

  const openEdit = async (machine: any) => {
    setIsNew(false);
    setEditingMachine(machine);
    setDeleteTarget(null);
    setDeleteText('');
    setSaveMsg('');
    // Build form data as strings
    const fd: Record<string, any> = {};
    FORM_SECTIONS.forEach(s => s.fields.forEach(f => {
      const v = machine[f.key];
      if (f.type === 'boolean') fd[f.key] = v === true ? 'true' : v === false ? 'false' : '';
      else fd[f.key] = v === null || v === undefined ? '' : String(v);
    }));
    setFormData(fd);
    setSuspiciousFields(Array.isArray(machine.suspicious_fields) ? machine.suspicious_fields : []);
    // Load comments, history & WAM files
    const [cRes, rRes, fRes] = await Promise.all([
      machineService.getComments(machine.id),
      machineService.getRevisions(machine.id),
      fileService.list(machine.id),
    ]);
    setComments(cRes.data);
    setRevisions(rRes.data);
    setWamFiles(fRes.data.filter((f: any) => f.file_type === 'wam'));
  };

  const openNew = () => {
    setIsNew(true);
    setEditingMachine(null);
    setDeleteTarget(null);
    setDeleteText('');
    setSaveMsg('');
    const fd: Record<string, any> = {};
    FORM_SECTIONS.forEach(s => s.fields.forEach(f => { fd[f.key] = ''; }));
    setFormData(fd);
    setSuspiciousFields([]);
    setComments([]);
    setRevisions([]);
  };

  const toggleSuspicious = (key: string) => {
    setSuspiciousFields(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const buildPayload = () => {
    const payload: Record<string, any> = { suspicious_fields: suspiciousFields };
    FORM_SECTIONS.forEach(s => s.fields.forEach(f => {
      const v = formData[f.key];
      if (v === '' || v === undefined) {
        payload[f.key] = null;
      } else if (f.type === 'number') {
        payload[f.key] = parseFloat(v) || null;
      } else if (f.type === 'boolean') {
        payload[f.key] = v === 'true' ? true : v === 'false' ? false : null;
      } else {
        payload[f.key] = v;
      }
    }));
    return payload;
  };

  const handleSave = async () => {
    const name = formData['internal_name']?.trim();
    if (!name) { setSaveMsg('Machine name is required'); return; }
    setSaving(true);
    setSaveMsg('');
    try {
      const payload = buildPayload();
      if (isNew) {
        await machineService.create(payload);
        setSaveMsg('✓ Machine created');
        await loadMachines();
        openNew(); // reset form
      } else {
        await machineService.update(editingMachine.id, payload);
        setSaveMsg('✓ Saved');
        await loadMachines();
        // Refresh revisions
        const rRes = await machineService.getRevisions(editingMachine.id);
        setRevisions(rRes.data);
      }
    } catch (e: any) {
      setSaveMsg(`✗ ${e.response?.data?.error || 'Save failed'}`);
    } finally {
      setSaving(false);
    }
  };

  const startDelete = (machine: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(machine);
    setDeleteText('');
    setEditingMachine(null);
    setIsNew(false);
  };

  const handleDelete = async () => {
    if (deleteText !== deleteTarget.internal_name) return;
    setDeleting(true);
    try {
      await machineService.delete(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteText('');
      await loadMachines();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !editingMachine) return;
    setAddingComment(true);
    try {
      await machineService.addComment(editingMachine.id, newComment.trim());
      setNewComment('');
      const cRes = await machineService.getComments(editingMachine.id);
      setComments(cRes.data);
    } finally {
      setAddingComment(false);
    }
  };

  const handleRevert = async (revisionId: number) => {
    if (!editingMachine) return;
    setRevertingId(revisionId);
    try {
      const res = await machineService.revertRevision(editingMachine.id, revisionId);
      const machine = res.data;
      // Rebuild form from reverted state
      const fd: Record<string, any> = {};
      FORM_SECTIONS.forEach(s => s.fields.forEach(f => {
        const v = machine[f.key];
        if (f.type === 'boolean') fd[f.key] = v === true ? 'true' : v === false ? 'false' : '';
        else fd[f.key] = v === null || v === undefined ? '' : String(v);
      }));
      setFormData(fd);
      setSuspiciousFields(Array.isArray(machine.suspicious_fields) ? machine.suspicious_fields : []);
      setSaveMsg('✓ Reverted');
      await loadMachines();
      const rRes = await machineService.getRevisions(editingMachine.id);
      setRevisions(rRes.data);
    } catch (e: any) {
      setSaveMsg(`✗ ${e.response?.data?.error || 'Revert failed'}`);
    } finally {
      setRevertingId(null);
    }
  };

  const handleWamUpload = async () => {
    if (!wamUploadFile || !editingMachine) return;
    setUploadingWam(true);
    try {
      await fileService.upload(editingMachine.id, wamUploadFile, 'wam', 'WAM technical drawing');
      setWamUploadFile(null);
      const [fRes, rRes] = await Promise.all([
        fileService.list(editingMachine.id),
        machineService.getRevisions(editingMachine.id),
      ]);
      setWamFiles(fRes.data.filter((f: any) => f.file_type === 'wam'));
      setRevisions(rRes.data);
      await loadMachines();
    } catch (e: any) {
      setSaveMsg(`✗ ${e.response?.data?.error || 'WAM upload failed'}`);
    } finally {
      setUploadingWam(false);
    }
  };

  const handleWamDownload = async (fileId: number, fileName: string) => {
    try {
      const res = await fileService.download(fileId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (e) {
      console.error('Download failed', e);
    }
  };

  const handleWamDelete = async (fileId: number) => {
    if (!editingMachine) return;
    try {
      await fileService.delete(fileId);
      const [fRes, rRes] = await Promise.all([
        fileService.list(editingMachine.id),
        machineService.getRevisions(editingMachine.id),
      ]);
      setWamFiles(fRes.data.filter((f: any) => f.file_type === 'wam'));
      setRevisions(rRes.data);
      await loadMachines();
    } catch (e: any) {
      setSaveMsg(`✗ ${e.response?.data?.error || 'Delete failed'}`);
    }
  };

  const handleDeleteRevision = async (revisionId: number) => {
    if (!editingMachine) return;
    setDeletingRevId(revisionId);
    try {
      await machineService.deleteRevision(editingMachine.id, revisionId);
      setConfirmDeleteRevId(null);
      const rRes = await machineService.getRevisions(editingMachine.id);
      setRevisions(rRes.data);
    } catch (e: any) {
      setSaveMsg(`✗ ${e.response?.data?.error || 'Delete failed'}`);
    } finally {
      setDeletingRevId(null);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);
    try {
      const res = await importService.uploadExcel(importFile);
      setImportMsg(`✓ ${res.data.message}`);
      setImportFile(null);
      await loadMachines();
    } catch (e: any) {
      setImportMsg(`✗ ${e.response?.data?.error || 'Upload failed'}`);
    } finally {
      setImporting(false);
    }
  };

  const filteredMachines = machines.filter(m =>
    !listSearch || m.internal_name?.toLowerCase().includes(listSearch.toLowerCase()) ||
    m.manufacturer?.toLowerCase().includes(listSearch.toLowerCase())
  );

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', cursor: 'pointer', background: 'none', border: 'none',
    borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
    color: active ? '#3b82f6' : textSecondary, fontWeight: active ? '600' : '400', fontSize: '14px',
  });

  const renderFormField = (f: FieldDef) => {
    const isSusp = suspiciousFields.includes(f.key);
    const suspBg = isSusp ? 'rgba(251, 146, 60, 0.15)' : 'transparent';
    const suspBorder = isSusp ? '1px solid rgba(251, 146, 60, 0.6)' : `1px solid ${borderColor}`;

    const fieldInput = () => {
      const style: React.CSSProperties = {
        ...inputStyle, flex: 1,
        backgroundColor: isSusp ? 'rgba(251, 146, 60, 0.08)' : inputBg,
        border: `1px solid ${isSusp ? 'rgba(251,146,60,0.6)' : borderColor}`,
      };
      if (f.type === 'boolean') {
        return (
          <select style={style} value={formData[f.key] ?? ''} onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}>
            <option value="">—</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );
      }
      if (f.type === 'select') {
        return (
          <select style={style} value={formData[f.key] ?? ''} onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}>
            {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      }
      if (f.type === 'textarea') {
        return (
          <textarea rows={2} style={{ ...style, resize: 'vertical' }}
            value={formData[f.key] ?? ''} onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))} />
        );
      }
      return (
        <input
          type={f.type === 'number' ? 'number' : 'text'}
          style={style}
          value={formData[f.key] ?? ''}
          onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
        />
      );
    };

    return (
      <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', borderRadius: '4px', backgroundColor: suspBg, border: suspBorder, marginBottom: '3px' }}>
        <label style={{ fontSize: '12px', color: textSecondary, width: '170px', flexShrink: 0, fontWeight: isSusp ? '600' : '400' }}>
          {f.label}{f.unit ? ` (${f.unit})` : ''}{f.required ? ' *' : ''}
          {isSusp && <span style={{ marginLeft: '4px', color: '#f97316', fontSize: '10px' }}>⚑</span>}
        </label>
        {fieldInput()}
        <button
          title={t('admin.markSuspicious')}
          onClick={() => toggleSuspicious(f.key)}
          style={{
            flexShrink: 0, width: '24px', height: '24px', border: 'none', borderRadius: '4px', cursor: 'pointer',
            backgroundColor: isSusp ? '#f97316' : 'transparent',
            color: isSusp ? '#fff' : textSecondary, fontSize: '13px', padding: 0,
          }}
        >⚑</button>
      </div>
    );
  };

  const showEditPanel = (isNew || editingMachine) && !deleteTarget;
  const editTitle = isNew ? t('admin.newMachine') : editingMachine?.internal_name;

  return (
    <div style={{ height: 'calc(100vh - 64px)', backgroundColor: bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${borderColor}`, backgroundColor: panelBg, flexShrink: 0 }}>
        <button style={tabBtn(tab === 'machines')} onClick={() => setTab('machines')}>{t('admin.tabMachines')}</button>
        <button style={tabBtn(tab === 'import')} onClick={() => setTab('import')}>{t('admin.tabImport')}</button>
        <button style={tabBtn(tab === 'users')} onClick={() => setTab('users')}>{t('admin.tabUsers')}</button>
      </div>

      {/* ── MACHINES TAB ── */}
      {tab === 'machines' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left: machine list */}
          <div style={{ width: '280px', flexShrink: 0, borderRight: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column', backgroundColor: panelBg }}>
            <div style={{ padding: '12px', borderBottom: `1px solid ${borderColor}` }}>
              <button
                onClick={openNew}
                style={{ width: '100%', padding: '8px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px', marginBottom: '8px' }}
              >
                + {t('admin.addMachine')}
              </button>
              <input
                type="text" placeholder={t('admin.searchMachines')} value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                style={{ ...inputStyle, fontSize: '12px' }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingList ? (
                <div style={{ padding: '16px', color: textSecondary, fontSize: '13px' }}>Loading...</div>
              ) : filteredMachines.map(m => {
                const susp = Array.isArray(m.suspicious_fields) ? m.suspicious_fields : [];
                const isSelected = editingMachine?.id === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => openEdit(m)}
                    style={{
                      padding: '10px 12px', cursor: 'pointer', borderBottom: `1px solid ${borderColor}`,
                      backgroundColor: isSelected ? (darkMode ? '#2d3748' : '#eff6ff') : 'transparent',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = rowHover; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {susp.length > 0 && <span style={{ color: '#f97316', marginRight: '4px' }}>⚑</span>}
                        {m.internal_name}
                      </div>
                      <div style={{ fontSize: '11px', color: textSecondary }}>{m.manufacturer} · {m.plant_location}</div>
                      {susp.length > 0 && (
                        <div style={{ fontSize: '10px', color: '#f97316', marginTop: '2px' }}>{susp.length} {t('admin.suspiciousCount')}</div>
                      )}
                    </div>
                    <button
                      onClick={e => startDelete(m, e)}
                      style={{ marginLeft: '6px', padding: '3px 6px', color: '#ef4444', background: 'none', border: `1px solid #ef4444`, borderRadius: '4px', cursor: 'pointer', fontSize: '11px', flexShrink: 0 }}
                    >✕</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: edit panel or delete confirm or placeholder */}
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: bg }}>

            {/* DELETE CONFIRM */}
            {deleteTarget && (
              <div style={{ padding: '32px', maxWidth: '520px' }}>
                <div style={{ backgroundColor: '#fef2f2', border: '2px solid #ef4444', borderRadius: '8px', padding: '24px' }}>
                  <h3 style={{ color: '#7f1d1d', fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
                    🗑 {t('admin.confirmDelete')}
                  </h3>
                  <p style={{ color: '#991b1b', marginBottom: '6px', fontSize: '14px' }}>{t('admin.deleteWarning')}</p>
                  <div style={{ backgroundColor: '#fee2e2', borderRadius: '4px', padding: '8px 12px', marginBottom: '16px', fontWeight: '700', color: '#7f1d1d', fontSize: '15px' }}>
                    {deleteTarget.internal_name}
                  </div>
                  <input
                    type="text" placeholder={t('admin.typeNameHere')} value={deleteText}
                    onChange={e => setDeleteText(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '2px solid #ef4444', borderRadius: '6px', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box', backgroundColor: '#fff', color: '#111' }}
                  />
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={handleDelete}
                      disabled={deleteText !== deleteTarget.internal_name || deleting}
                      style={{
                        padding: '10px 20px', backgroundColor: deleteText === deleteTarget.internal_name ? '#ef4444' : '#9ca3af',
                        color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: deleteText === deleteTarget.internal_name ? 'pointer' : 'not-allowed', fontSize: '14px',
                      }}
                    >
                      {deleting ? '...' : t('admin.delete')}
                    </button>
                    <button
                      onClick={() => { setDeleteTarget(null); setDeleteText(''); }}
                      style={{ padding: '10px 20px', backgroundColor: panelBg, border: `1px solid ${borderColor}`, borderRadius: '6px', color: textPrimary, cursor: 'pointer', fontSize: '14px' }}
                    >
                      {t('admin.cancel')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* EDIT / CREATE FORM */}
            {showEditPanel && (
              <div style={{ padding: '20px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: textPrimary }}>
                    {isNew ? `+ ${editTitle}` : `✎ ${editTitle}`}
                    {suspiciousFields.length > 0 && (
                      <span style={{ marginLeft: '10px', fontSize: '13px', color: '#f97316', fontWeight: '400' }}>
                        ⚑ {suspiciousFields.length} {t('admin.suspiciousCount')}
                      </span>
                    )}
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {saveMsg && (
                      <span style={{ fontSize: '13px', color: saveMsg.startsWith('✓') ? '#22c55e' : '#ef4444' }}>{saveMsg}</span>
                    )}
                    <button
                      onClick={() => { setEditingMachine(null); setIsNew(false); setSaveMsg(''); }}
                      style={{ padding: '7px 14px', backgroundColor: panelBg, border: `1px solid ${borderColor}`, borderRadius: '6px', color: textPrimary, cursor: 'pointer', fontSize: '13px' }}
                    >
                      {t('admin.cancel')}
                    </button>
                    <button
                      onClick={handleSave} disabled={saving}
                      style={{ padding: '7px 18px', backgroundColor: saving ? '#6b7280' : '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px' }}
                    >
                      {saving ? t('admin.saving') : t('admin.save')}
                    </button>
                  </div>
                </div>

                {/* Form sections */}
                {FORM_SECTIONS.map(section => (
                  <div key={section.titleKey} style={{ backgroundColor: panelBg, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '14px', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: '700', color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                      {t(section.titleKey)}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '0' }}>
                      {section.fields.map(f => renderFormField(f))}
                    </div>
                  </div>
                ))}

                {/* WAM section — only for existing machines */}
                {!isNew && editingMachine && (
                  <div style={{ backgroundColor: panelBg, border: `2px solid rgba(59,130,246,0.4)`, borderRadius: '8px', padding: '14px', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                      {t('admin.wam')}
                    </h4>

                    {/* Current WAM */}
                    {wamFiles.length > 0 ? (
                      <div style={{ padding: '10px 12px', backgroundColor: darkMode ? '#111827' : '#f0f9ff', borderRadius: '6px', border: `1px solid ${borderColor}`, marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: textSecondary, marginBottom: '6px' }}>{t('admin.wamCurrent')}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: textPrimary }}>📄 {wamFiles[0].file_name}</div>
                            <div style={{ fontSize: '11px', color: textSecondary, marginTop: '2px' }}>
                              {(wamFiles[0].file_size / 1024).toFixed(0)} KB · {new Date(wamFiles[0].uploaded_at).toLocaleString()} · {wamFiles[0].username || 'Unknown'}
                            </div>
                          </div>
                          <button onClick={() => handleWamDownload(wamFiles[0].id, wamFiles[0].file_name)}
                            style={{ padding: '5px 12px', color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: '6px', background: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                            ↓ {t('admin.download')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: textSecondary, fontSize: '13px', marginBottom: '10px' }}>{t('admin.wamNoFile')}</div>
                    )}

                    {/* Upload new WAM */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: wamFiles.length > 1 ? '10px' : '0' }}>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: textSecondary, flexShrink: 0 }}>{t('admin.wamUpload')}:</label>
                      <input type="file" onChange={e => setWamUploadFile(e.target.files?.[0] || null)}
                        style={{ flex: 1, fontSize: '12px', color: textPrimary }} />
                      <button onClick={handleWamUpload} disabled={!wamUploadFile || uploadingWam}
                        style={{ padding: '5px 14px', backgroundColor: wamUploadFile && !uploadingWam ? '#3b82f6' : '#9ca3af', color: '#fff', border: 'none', borderRadius: '6px', cursor: wamUploadFile ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: '600', flexShrink: 0 }}>
                        {uploadingWam ? '...' : '↑ Upload'}
                      </button>
                    </div>

                    {/* WAM version history */}
                    {wamFiles.length > 1 && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t('admin.wamHistory')}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {wamFiles.slice(1).map((f: any) => (
                            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: darkMode ? '#111827' : '#f9fafb', borderRadius: '4px', border: `1px solid ${borderColor}` }}>
                              <div style={{ fontSize: '12px', color: textSecondary }}>
                                📄 {f.file_name} · {(f.file_size / 1024).toFixed(0)} KB · {new Date(f.uploaded_at).toLocaleString()}
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => handleWamDownload(f.id, f.file_name)}
                                  style={{ padding: '3px 8px', color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: '4px', background: 'none', cursor: 'pointer', fontSize: '11px' }}>↓</button>
                                <button onClick={() => handleWamDelete(f.id)}
                                  style={{ padding: '3px 8px', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', background: 'none', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Comments section — only for existing machines */}
                {!isNew && editingMachine && (
                  <div style={{ backgroundColor: panelBg, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '14px', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: '700', color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                      {t('admin.comments')}
                    </h4>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <input
                        type="text" placeholder={t('admin.addComment')} value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button
                        onClick={handleAddComment} disabled={addingComment || !newComment.trim()}
                        style={{ padding: '6px 14px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}
                      >
                        {t('admin.submitComment')}
                      </button>
                    </div>
                    {comments.length === 0 ? (
                      <p style={{ color: textSecondary, fontSize: '13px' }}>{t('admin.noComments')}</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {comments.map(c => (
                          <div key={c.id} style={{ padding: '10px 12px', backgroundColor: darkMode ? '#111827' : '#f9fafb', borderRadius: '6px', border: `1px solid ${borderColor}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '12px', fontWeight: '600', color: '#3b82f6' }}>{c.username || 'Unknown'}</span>
                              <span style={{ fontSize: '11px', color: textSecondary }}>{new Date(c.created_at).toLocaleString()}</span>
                            </div>
                            <div style={{ fontSize: '13px', color: textPrimary }}>{c.comment}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Revision history — only for existing machines */}
                {!isNew && editingMachine && (
                  <div style={{ backgroundColor: panelBg, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '14px', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: '700', color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                      {t('admin.revisionHistory')}
                    </h4>
                    {revisions.length === 0 ? (
                      <p style={{ color: textSecondary, fontSize: '13px' }}>{t('admin.noRevisions')}</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {revisions.map(r => {
                          const typeColor = r.change_type === 'delete' ? '#ef4444' : r.change_type === 'create' ? '#22c55e' : r.change_type === 'revert' ? '#a855f7' : '#3b82f6';
                          const lines = (r.change_summary || '').split('\n').filter(Boolean);
                          const isReverting = revertingId === r.id;
                          return (
                          <div key={r.id} style={{ backgroundColor: darkMode ? '#111827' : '#f9fafb', borderRadius: '6px', border: `1px solid ${borderColor}`, overflow: 'hidden' }}>
                            {/* Header row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: lines.length ? `1px solid ${borderColor}` : 'none' }}>
                              <div>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: textPrimary }}>Rev {r.revision_number}</span>
                                <span style={{ fontSize: '11px', fontWeight: '600', color: typeColor, textTransform: 'uppercase', marginLeft: '8px' }}>{r.change_type}</span>
                                <span style={{ fontSize: '11px', color: textSecondary, marginLeft: '8px' }}>{new Date(r.changed_at).toLocaleString()} {t('admin.by')} {r.username || 'Unknown'}</span>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                {r.change_type !== 'delete' && r.change_type !== 'log' && r.new_data && (
                                  <button
                                    onClick={() => handleRevert(r.id)}
                                    disabled={isReverting}
                                    style={{ padding: '3px 10px', fontSize: '11px', color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: '4px', backgroundColor: 'transparent', cursor: 'pointer' }}
                                  >
                                    {isReverting ? '...' : `↩ ${t('admin.restore')}`}
                                  </button>
                                )}
                                {confirmDeleteRevId === r.id ? (
                                  <>
                                    <button
                                      onClick={() => handleDeleteRevision(r.id)}
                                      disabled={deletingRevId === r.id}
                                      style={{ padding: '3px 10px', fontSize: '11px', color: '#fff', backgroundColor: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                      {deletingRevId === r.id ? '...' : t('admin.confirmDeleteRevision')}
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteRevId(null)}
                                      style={{ padding: '3px 8px', fontSize: '11px', color: textSecondary, border: `1px solid ${borderColor}`, borderRadius: '4px', backgroundColor: 'transparent', cursor: 'pointer' }}
                                    >✕</button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteRevId(r.id)}
                                    style={{ padding: '3px 10px', fontSize: '11px', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', backgroundColor: 'transparent', cursor: 'pointer' }}
                                  >
                                    {t('admin.deleteRevision')}
                                  </button>
                                )}
                              </div>
                            </div>
                            {/* Changed fields */}
                            {lines.length > 0 && (
                              <div style={{ padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {lines.map((line: string, i: number) => {
                                  const isSuspLine = line === 'Suspicious flags updated';
                                  const [fieldPart, changePart] = line.split(': ').length > 1 ? [line.split(': ')[0], line.split(': ').slice(1).join(': ')] : [line, null];
                                  const [oldVal, newVal] = changePart ? changePart.split(' → ') : [null, null];
                                  return (
                                    <div key={i} style={{ fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                                      <span style={{ color: isSuspLine ? '#f97316' : textSecondary, fontFamily: 'monospace', flexShrink: 0 }}>{fieldPart}</span>
                                      {oldVal !== null && newVal !== undefined && (
                                        <>
                                          <span style={{ color: '#ef4444', textDecoration: 'line-through', opacity: 0.8 }}>{oldVal}</span>
                                          <span style={{ color: textSecondary }}>→</span>
                                          <span style={{ color: '#22c55e' }}>{newVal}</span>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* PLACEHOLDER */}
            {!showEditPanel && !deleteTarget && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: textSecondary, fontSize: '14px' }}>
                {t('admin.noMachineSelected')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── IMPORT TAB ── */}
      {tab === 'import' && (
        <div style={{ padding: '24px', overflowY: 'auto' }}>
          <div style={{ backgroundColor: panelBg, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '24px', maxWidth: '560px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: textPrimary }}>Import Machines from Excel</h3>
            <form onSubmit={handleImport}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: textSecondary, marginBottom: '6px' }}>Select Excel File</label>
              <input type="file" accept=".xlsx,.xls" onChange={e => setImportFile(e.target.files?.[0] || null)}
                style={{ display: 'block', marginBottom: '12px', color: textPrimary }} />
              <p style={{ fontSize: '12px', color: textSecondary, marginBottom: '16px' }}>Expected: MachineDataBase.xlsx or MachineList_USA.xlsx</p>
              {importMsg && (
                <div style={{ padding: '10px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '13px', backgroundColor: importMsg.startsWith('✓') ? '#f0fdf4' : '#fef2f2', color: importMsg.startsWith('✓') ? '#14532d' : '#7f1d1d', border: `1px solid ${importMsg.startsWith('✓') ? '#22c55e' : '#ef4444'}` }}>
                  {importMsg}
                </div>
              )}
              <button type="submit" disabled={!importFile || importing}
                style={{ padding: '9px 20px', backgroundColor: importFile && !importing ? '#3b82f6' : '#9ca3af', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: importFile && !importing ? 'pointer' : 'not-allowed', fontSize: '14px' }}>
                {importing ? 'Importing...' : 'Import Machines'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <div style={{ padding: '24px', overflowY: 'auto' }}>
          <div style={{ backgroundColor: panelBg, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '24px', maxWidth: '560px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px', color: textPrimary }}>User Management</h3>
            <p style={{ color: textSecondary, marginBottom: '16px', fontSize: '14px' }}>User management UI coming soon. Current credentials:</p>
            <div style={{ backgroundColor: darkMode ? '#111827' : '#f9fafb', borderRadius: '6px', padding: '12px', fontSize: '13px', color: textPrimary }}>
              <div style={{ marginBottom: '6px' }}><strong>master</strong> — password: master123 — Full access</div>
              <div style={{ marginBottom: '6px' }}><strong>viewer_usa</strong> — password: viewer123 — USA read-only</div>
              <div><strong>viewer_mexico</strong> — password: viewer123 — Mexico read-only</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
