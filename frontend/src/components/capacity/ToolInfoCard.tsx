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
      className="absolute bottom-[calc(100%+10px)] left-1/2 z-20 w-[236px] bg-white border border-[#ececea] rounded-xl p-3.5 pointer-events-none"
      style={{
        transform: 'translateX(-50%)',
        boxShadow: '0 12px 32px -12px rgba(20,20,30,0.18), 0 2px 8px -4px rgba(20,20,30,0.08)',
      }}
    >
      <div className="text-[13px] font-medium leading-snug">
        {tool.tool_number}
        {tool.description && (
          <span className="text-[#5a5a5e] font-normal"> — {tool.description}</span>
        )}
      </div>
      {(tool.customer || tool.program) && (
        <div className="text-[11px] text-[#8a8a8e] mt-0.5">
          {tool.customer}
          {tool.customer && tool.program && ' / '}
          {tool.program}
        </div>
      )}
      <div className="mt-2.5 pt-2.5 border-t border-[#ececea] flex flex-col gap-1.5">
        <Row label="Cavities" value={String(tool.cavities)} />
        <Row label="Cycle time" value={`${tool.rated_cycle_time_sec.toFixed(0)} s`} />
        <Row label={`Pieces '${String(year).slice(2)}`} value={piecesPerYear != null ? piecesPerYear.toLocaleString() : '—'} />
        <Row label="Mach. equiv." value={machEquiv.toFixed(2)} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[11.5px]">
      <span className="text-[#5a5a5e]">{label}</span>
      <b className="font-mono font-medium text-[#1a1a1a]">{value}</b>
    </div>
  );
}
