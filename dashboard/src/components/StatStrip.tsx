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
  label, primary, secondary, spark, sparkColor,
}: {
  label: string;
  primary: string;
  secondary?: string;
  spark: number[];
  sparkColor: string;
}) {
  return (
    <div style={{
      flex: '1 1 0', minWidth: 0,
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r)',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    }}>
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        <span style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.04em', fontWeight:500 }}>
          {label}
        </span>
        <span style={{ fontSize:22, fontWeight:600, color:'var(--ink)', lineHeight:1.1 }}>
          {primary}
        </span>
        {secondary && (
          <span style={{ fontSize:12, color:'var(--muted)' }}>{secondary}</span>
        )}
      </div>
      <Sparkline values={spark} color={sparkColor} />
    </div>
  );
}

export interface StatStripProps {
  repos: Repo[];
}

export default function StatStrip({ repos }: StatStripProps) {

  /* ── Derive rows ── */
  const followed   = repos.filter(r => r.followed && !r.unfollowed);
  const followedBack = repos.filter(r => r.follow_back === true);
  const topPicks   = repos.filter(r => (r.grade ?? 0) >= 9 && r.language !== 'Profile');
  const unfollowed = repos.filter(r => r.unfollowed === true);

  /* ── Counts ── */
  const followedTotal    = followed.length;
  const followedBackTotal = followedBack.length;
  /* "Y followed" denominator: all rows where followed=true (including later unfollowed) */
  const followedEver     = repos.filter(r => r.followed === true).length;
  const pct              = followedEver > 0
    ? ((followedBackTotal / followedEver) * 100).toFixed(1)
    : '0.0';

  /* ── Sparklines (daily counts, last 30 days, using created_at) ── */
  const sparkFollowed    = dailyCounts(followed);
  const sparkFollowBack  = dailyCounts(followedBack);
  const sparkTopPicks    = dailyCounts(topPicks);
  const sparkUnfollowed  = dailyCounts(unfollowed);

  return (
    <div style={{ display:'flex', gap:12 }}>
      <StatCell
        label="Followed"
        primary={followedTotal.toLocaleString()}
        spark={sparkFollowed}
        sparkColor="var(--accent)"
      />
      <StatCell
        label="Followed Back"
        primary={`${followedBackTotal} / ${followedEver}`}
        secondary={`${pct}% conversion`}
        spark={sparkFollowBack}
        sparkColor="var(--accent)"
      />
      <StatCell
        label="Top Picks"
        primary={topPicks.length.toLocaleString()}
        secondary="score ≥ 9"
        spark={sparkTopPicks}
        sparkColor="var(--accent)"
      />
      <StatCell
        label="Unfollowed"
        primary={unfollowed.length.toLocaleString()}
        spark={sparkUnfollowed}
        sparkColor="var(--warn)"
      />
    </div>
  );
}
