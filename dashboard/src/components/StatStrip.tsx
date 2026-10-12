'use client';

import type { Repo } from '@/lib/types';

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const W = 64, H = 24;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - (v / max) * H;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} style={{ display:'block', overflow:'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* Returns a 30-element array (oldest → today) of daily counts.
   isoDate field: the date column to bucket by (YYYY-MM-DD prefix match on created_at). */
function dailyCounts(
  rows: Array<{ created_at?: string | null }>,
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
    if (!row.created_at) continue;
    const key = row.created_at.slice(0, 10);
    if (key in buckets) buckets[key]++;
  }
  return Object.values(buckets);
}

function StatCell({
  label, primary, note, spark, sparkColor, isFirst, isLoading,
}: {
  label: string;
  primary: string;
  note?: string;
  spark: number[];
  sparkColor: string;
  isFirst?: boolean;
  isLoading?: boolean;
}) {
  return (
    <div
      style={{
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
        borderLeft: isFirst ? 'none' : '1px solid var(--line)',
        transition: 'background 0.18s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 500 }}>
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

  // Real 7-day delta calculation
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const followedThisWeek = repos.filter(r => r.followed && (r.followed_at || r.created_at || '') >= sevenDaysAgo).length;
  const weekDeltaLabel = followedThisWeek > 0 ? `+${followedThisWeek} this week` : 'Active connections';

  /* ── Sparklines (daily counts, last 30 days, using created_at) ── */
  const sparkFollowed    = dailyCounts(followed);
  const sparkFollowBack  = dailyCounts(followedBack);
  const sparkTopPicks    = dailyCounts(topPicks);
  const sparkUnfollowed  = dailyCounts(unfollowed);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r)',
      background: 'var(--surface)',
      boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.04))',
      transition: 'background 0.25s ease, border-color 0.25s ease',
      overflow: 'hidden',
    }}>
      <StatCell
        label="Followed"
        primary={followedTotal.toLocaleString()}
        note={weekDeltaLabel}
        spark={sparkFollowed}
        sparkColor="var(--accent)"
        isFirst={true}
        isLoading={isLoading}
      />
      <StatCell
        label="Follow-back rate"
        primary={`${pct}%`}
        note={`${followedBackTotal} of ${followedEver}`}
        spark={sparkFollowBack}
        sparkColor="var(--ink)"
        isLoading={isLoading}
      />
      <StatCell
        label="Top Picks"
        primary={topPicks.length.toLocaleString()}
        note="Quality score ≥ 90"
        spark={sparkTopPicks}
        sparkColor="var(--accent)"
        isLoading={isLoading}
      />
      <StatCell
        label="Unfollowed"
        primary={unfollowed.length.toLocaleString()}
        note="Past grace period"
        spark={sparkUnfollowed}
        sparkColor="var(--faint)"
        isLoading={isLoading}
      />
    </div>
  );
}
