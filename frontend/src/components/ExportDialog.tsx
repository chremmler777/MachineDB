import React, { useState } from 'react';
import { machineService } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

interface ExportDialogProps {
  darkMode?: boolean;
  defaultPlant?: string; // '', 'USA' or 'Mexico'
  onClose: () => void;
}

type Detail = 'overview' | 'full';
type Format = 'xlsx' | 'html';

export const ExportDialog: React.FC<ExportDialogProps> = ({ darkMode = true, defaultPlant = '', onClose }) => {
  const { t } = useLanguage();
  const [plant, setPlant] = useState<string>(defaultPlant);
  const [detail, setDetail] = useState<Detail>('overview');
  const [format, setFormat] = useState<Format>('xlsx');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const panelBg = darkMode ? '#1f2937' : '#ffffff';
  const text = darkMode ? '#e5e7eb' : '#111827';
  const subText = darkMode ? '#9ca3af' : '#6b7280';
  const border = darkMode ? '#374151' : '#d1d5db';

  const handleExport = async () => {
    const plantParam = plant === 'USA' || plant === 'Mexico' ? plant : undefined;

    setBusy(true);
    setError(null);
    try {
      const res = await machineService.exportList({ format, detail, ...(plantParam ? { plant: plantParam } : {}) });

      // Derive filename from Content-Disposition, fall back to a sensible default.
      let filename = `KTX_Machines.${format}`;
      const cd = res.headers['content-disposition'] as string | undefined;
      const match = cd && /filename="?([^"]+)"?/.exec(cd);
      if (match) filename = match[1];

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const Segment: React.FC<{
    active: boolean;
    onClick: () => void;
    title: string;
    desc?: string;
  }> = ({ active, onClick, title, desc }) => (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        textAlign: 'left',
        padding: '10px 12px',
        borderRadius: '8px',
        border: `1.5px solid ${active ? '#3b82f6' : border}`,
        background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
        color: text,
        cursor: 'pointer',
        transition: 'all 0.12s',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 700 }}>{title}</div>
      {desc && <div style={{ fontSize: '11px', color: subText, marginTop: '2px' }}>{desc}</div>}
    </button>
  );

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: subText,
    marginBottom: '6px',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: panelBg,
          width: '440px',
          maxWidth: '92vw',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 12px 48px rgba(0,0,0,0.45)',
          color: text,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700 }}>{t('export.title')}</h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: subText, fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Facility */}
        <div style={{ marginBottom: '16px' }}>
          <div style={labelStyle}>{t('export.facility')}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Segment active={plant === ''} onClick={() => setPlant('')} title={t('export.all')} />
            <Segment active={plant === 'USA'} onClick={() => setPlant('USA')} title="USA" />
            <Segment active={plant === 'Mexico'} onClick={() => setPlant('Mexico')} title="Mexico" />
          </div>
        </div>

        {/* Detail level */}
        <div style={{ marginBottom: '16px' }}>
          <div style={labelStyle}>{t('export.detail')}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Segment active={detail === 'overview'} onClick={() => setDetail('overview')} title={t('export.overview')} desc={t('export.overviewDesc')} />
            <Segment active={detail === 'full'} onClick={() => setDetail('full')} title={t('export.full')} desc={t('export.fullDesc')} />
          </div>
        </div>

        {/* Format */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}>{t('export.format')}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Segment active={format === 'xlsx'} onClick={() => setFormat('xlsx')} title={t('export.excel')} />
            <Segment active={format === 'html'} onClick={() => setFormat('html')} title={t('export.html')} desc={t('export.htmlDesc')} />
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{ padding: '8px 16px', borderRadius: '6px', border: `1px solid ${border}`, background: 'transparent', color: text, fontSize: '13px', cursor: 'pointer' }}
          >
            {t('export.cancel')}
          </button>
          <button
            onClick={handleExport}
            disabled={busy}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              background: busy ? '#6b7280' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: busy ? 'default' : 'pointer',
              boxShadow: '0 1px 4px rgba(59,130,246,0.4)',
            }}
          >
            {busy ? t('export.exporting') : t('export.download')}
          </button>
        </div>
      </div>
    </div>
  );
};
