import type { Tool } from '../../types/capacity';

export function ToolInfoCard({
  tool,
  machEquiv,
  year,
  piecesPerYear,
}: {
  tool: Tool;
  machEquiv: number;
  year: number;
  piecesPerYear: number | undefined;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 12px)',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#ffffff',
        border: '1px solid #ececea',
        borderRadius: 14,
        padding: '14px 16px',
        width: 232,
        boxShadow: '0 12px 32px -12px rgba(20,20,30,0.18)',
        zIndex: 20,
        fontSize: 12,
        pointerEvents: 'none',
      }}
    >
      {/* Arrow indicator */}
      <span style={{
        content: '',
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%) rotate(45deg)',
        bottom: -6,
        width: 10, height: 10,
        background: '#ffffff',
        borderRight: '1px solid #ececea',
        borderBottom: '1px solid #ececea',
        display: 'block',
      }} />

      {/* Tool number + description */}
      <h5 style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
        {tool.tool_number}
        {tool.description && (
          <span style={{ fontWeight: 400, color: '#5a5a5e' }}> — {tool.description}</span>
        )}
      </h5>

      {/* Customer / program */}
      {(tool.customer || tool.program) && (
        <div style={{ color: '#8a8a8e', fontSize: 11, marginTop: 2 }}>
          {tool.customer}
          {tool.customer && tool.program && ' / '}
          {tool.program}
        </div>
      )}

      {/* Key/value rows */}
      <div style={{
        marginTop: 10, paddingTop: 10,
        borderTop: '1px solid #ececea',
        display: 'flex', flexDirection: 'column', gap: 5,
      }}>
        <InfoRow label="Cavities" value={String(tool.cavities)} />
        <InfoRow label="Cycle time" value={`${tool.rated_cycle_time_sec.toFixed(0)} s`} />
        <InfoRow
          label={`Pieces '${String(year).slice(2)}`}
          value={piecesPerYear != null ? piecesPerYear.toLocaleString() : '—'}
        />
        <InfoRow label="Mach. equiv." value={machEquiv.toFixed(2)} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      color: '#5a5a5e', fontSize: 11.5,
    }}>
      <span>{label}</span>
      <b style={{ color: '#1a1a1a', fontFamily: "'Geist Mono', monospace", fontWeight: 500 }}>
        {value}
      </b>
    </div>
  );
}
