import React from 'react';

interface Props {
  inServiceFrom?: string | null;     // 'YYYY-MM-DD'
  plannedScrapFrom?: string | null;  // 'YYYY-MM-DD'
  today?: Date;                      // injectable for tests
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(date: string): string {
  const y = date.slice(0, 4);
  const m = Number(date.slice(5, 7));
  return `${MONTHS[m - 1]} ${y}`;
}

export function deriveBadge(
  inServiceFrom: string | null | undefined,
  plannedScrapFrom: string | null | undefined,
  today: Date,
): { text: string; color: string } | null {
  const todayStr = today.toISOString().slice(0, 10);

  if (inServiceFrom && inServiceFrom > todayStr) {
    return { text: `Arriving ${fmt(inServiceFrom)}`, color: '#d4a017' };
  }
  if (plannedScrapFrom && plannedScrapFrom <= todayStr) {
    return { text: `Scrapped ${fmt(plannedScrapFrom)}`, color: '#888' };
  }
  if (plannedScrapFrom) {
    const horizon = new Date(today); horizon.setMonth(horizon.getMonth() + 12);
    const horizonStr = horizon.toISOString().slice(0, 10);
    if (plannedScrapFrom <= horizonStr) {
      return { text: `Scrapping ${fmt(plannedScrapFrom)}`, color: '#d97706' };
    }
  }
  return null;
}

export const LifecycleBadge: React.FC<Props> = ({ inServiceFrom, plannedScrapFrom, today = new Date() }) => {
  const b = deriveBadge(inServiceFrom ?? null, plannedScrapFrom ?? null, today);
  if (!b) return null;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 6px',
      borderRadius: 4,
      fontSize: 11,
      background: b.color,
      color: 'white',
      whiteSpace: 'nowrap',
    }}>
      {b.text}
    </span>
  );
};
