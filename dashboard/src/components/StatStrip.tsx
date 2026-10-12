'use client';

import type { Repo } from '@/lib/types';

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (!values || values.length < 2) return null;
  const w = 84, h = 28;
  const mx = Math.max(...values);
  const mn = Math.min(...values);
  const r = mx - mn || (mx > 0 ? mx : 1);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = mx === mn && mx === 0 
      ? h - 4 
      : (h - 3 - ((v - mn) / r) * (h - 6));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* Returns a 30-element array (oldest → today) of daily counts.
   dateGetter: extracts the ISO date string to bucket by. */
function dailyCounts(
  rows: Array<Record<string, any>>,
  dateGetter: (row: Record<string, any>) => string | null | undefined,
  days = 30
): number[] {
  const today = new Date();
  const buckets: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  for (const row of rows) {
    const raw = dateGetter(row);
    if (!raw) continue;
    const key = raw.slice(0, 10);
    if (key in buckets) buckets[key]++;
  }
  return Object.values(buckets);
}

function StatCell({
  label, primary, note, spark, sparkColor, isFirst, index, isLoading,
}: {
  label: string;
  primary: string;
  note?: string;
  spark: number[];
  sparkColor: string;
  isFirst?: boolean;
  index?: number;
  isLoading?: boolean;
}) {
  return (
    <div
      className={`p-3.5 sm:p-4 sm:px-4.5 flex flex-col gap-0.5 min-w-0 transition-colors duration-150 ${
        index !== undefined && index % 2 !== 0 ? 'border-l border-[var(--line)] sm:border-l' : ''
      } ${
        index !== undefined && index >= 2 ? 'border-t border-[var(--line)] sm:border-t-0' : ''
      } ${
        index !== undefined && index > 0 ? 'sm:border-l sm:border-[var(--line)]' : ''
      }`}
      style={{
        transition: 'background 0.18s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span
        className="text-[13px] font-medium leading-tight whitespace-normal break-words"
        style={{ color: 'var(--muted)' }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 2 }}>
        {isLoading ? (
          <div style={{
            width: 72, height: 28, borderRadius: 4,
            background: 'var(--hover)',
            animation: 'fm-pulse 1.6s ease-in-out infinite',
          }} />
        ) : (
          <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.15, color: 'var(--ink)' }}>
            {primary}
          </span>
        )}
        {isLoading ? (
          <div style={{
            width: 84, height: 28, borderRadius: 4,
            background: 'var(--hover)',
            animation: 'fm-pulse 1.6s ease-in-out infinite',
          }} />
        ) : (
          <Sparkline values={spark} color={sparkColor} />
        )}
      </div>
      {isLoading ? (
        <div style={{
          width: 60, height: 12, borderRadius: 3,
          background: 'var(--hover)',
          animation: 'fm-pulse 1.6s ease-in-out infinite',
          marginTop: 4,
        }} />
      ) : note ? (
        <span style={{ color: 'var(--faint)', fontSize: 12, marginTop: 2 }}>{note}</span>
      ) : null}
    </div>
  );
}

export interface StatStripProps {
  repos: Repo[];
  isLoading?: boolean;
}

export default function StatStrip({ repos, isLoading }: StatStripProps) {

  /* ── Derive rows ── */
  const followed   = repos.filter(r => r.followed && !r.unfollowed);
  const followedBack = repos.filter(r => r.follow_back === true && r.followed === true);
  const topPicks   = repos.filter(r => (r.grade ?? 0) >= 9 && r.language !== 'Profile');
  const unfollowed = repos.filter(r => r.unfollowed === true);

  /* ── Counts ── */
  const followedTotal    = followed.length;
  const followedBackTotal = followedBack.length;
  const followedEver     = repos.filter(r => r.followed === true).length;
  const pct              = followedEver > 0
    ? Math.round((followedBackTotal / followedEver) * 100)
    : 0;

  /* ── Sparklines (daily counts, last 30 days) ── */
  const sparkFollowed   = dailyCounts(followed, r => r.followed_at || r.graded_at || r.created_at);
  const sparkFollowBack = dailyCounts(followedBack, r => r.followed_at || r.graded_at || r.created_at);
  const sparkTopPicks   = dailyCounts(topPicks, r => r.graded_at || r.created_at);
  const sparkUnfollowed = dailyCounts(unfollowed, r => r.followed_at || r.created_at);

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-4 w-full"
      style={{
        border: '1px solid var(--line)',
        borderRadius: 'var(--r)',
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.04))',
        transition: 'background 0.25s ease, border-color 0.25s ease',
        overflow: 'hidden',
      }}
    >
      <StatCell
        label="Followed"
        primary={followedTotal.toLocaleString()}
        note="Active connections"
        spark={sparkFollowed}
        sparkColor="var(--accent)"
        index={0}
        isLoading={isLoading}
      />
      <StatCell
        label="Follow-back rate"
        primary={`${pct}%`}
        note={`${followedBackTotal} of ${followedEver}`}
        spark={sparkFollowBack}
        sparkColor="var(--ink)"
        index={1}
        isLoading={isLoading}
      />
      <StatCell
        label="Top Picks"
        primary={topPicks.length.toLocaleString()}
        note="Quality score ≥ 90"
        spark={sparkTopPicks}
        sparkColor="var(--accent)"
        index={2}
        isLoading={isLoading}
      />
      <StatCell
        label="Unfollowed"
        primary={unfollowed.length.toLocaleString()}
        note="Past grace period"
        spark={sparkUnfollowed}
        sparkColor="var(--faint)"
        index={3}
        isLoading={isLoading}
      />
    </div>
  );
}
