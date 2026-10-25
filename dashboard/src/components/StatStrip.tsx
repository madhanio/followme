'use client';

import React, { useState } from 'react';
import type { Repo } from '@/lib/types';

function InteractiveSparkline({ values, color }: { values: number[]; color: string }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  if (values.length < 2) return null;

  const W = 84, H = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - 3 - ((v - min) / range) * (H - 6);
    return `${x},${y}`;
  }).join(' ');

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = Math.max(0, Math.min(W, ((e.clientX - rect.left) / rect.width) * W));
    const idx = Math.max(0, Math.min(values.length - 1, Math.round((px / W) * (values.length - 1))));
    setHoverIndex(idx);
  };

  const currentVal = hoverIndex !== null ? values[hoverIndex] : null;
  const posX = hoverIndex !== null ? (hoverIndex / (values.length - 1)) * W : 0;
  const posY = hoverIndex !== null ? H - 3 - ((values[hoverIndex] - min) / range) * (H - 6) : 0;

  // Approximate relative date label: 30 days back to today
  const getRelativeDay = (idx: number) => {
    const daysAgo = values.length - 1 - idx;
    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return 'Yesterday';
    return `${daysAgo}d ago`;
  };

  return (
    <div style={{ position: 'relative', width: W, height: H, flex: 'none', cursor: 'default' }}>
      <svg
        width={W}
        height={H}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {hoverIndex !== null && (
          <>
            <line x1={posX} y1={0} x2={posX} y2={H} stroke="var(--ink)" strokeWidth={1} strokeDasharray="2,2" opacity={0.6} />
            <circle cx={posX} cy={posY} r={3} fill={color} stroke="var(--surface)" strokeWidth={1.5} />
          </>
        )}
      </svg>
      {hoverIndex !== null && (
        <div style={{
          position: 'absolute',
          left: posX,
          top: -22,
          transform: 'translateX(-50%)',
          background: 'var(--ink)',
          color: 'var(--surface)',
          fontSize: 10.5,
          fontWeight: 600,
          padding: '2px 6px',
          borderRadius: 4,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          zIndex: 10,
        }}>
          {getRelativeDay(hoverIndex)}: {currentVal}
        </div>
      )}
    </div>
  );
}

/* Returns a 30-element array (oldest → today) of daily counts. */
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
          <InteractiveSparkline values={spark} color={sparkColor} />
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
  /* ── Deduplicate repos by owner for profile-accurate metrics ── */
  const ownersMap = new Map<string, {
    followed: boolean;
    follow_back: boolean;
    unfollowed: boolean;
    follow_skipped: boolean;
    grade: number;
    created_at?: string | null;
    followed_at?: string | null;
  }>();

  for (const r of repos) {
    const key = (r.owner || '').toLowerCase();
    if (!key) continue;
    const existing = ownersMap.get(key);
    if (!existing) {
      ownersMap.set(key, {
        followed: !!r.followed,
        follow_back: !!r.follow_back,
        unfollowed: !!r.unfollowed,
        follow_skipped: !!r.follow_skipped,
        grade: r.grade ?? 0,
        created_at: r.created_at,
        followed_at: r.followed_at,
      });
    } else {
      if (r.followed) existing.followed = true;
      if (r.follow_back) existing.follow_back = true;
      if (r.unfollowed) existing.unfollowed = true;
      if (r.follow_skipped) existing.follow_skipped = true;
      if ((r.grade ?? 0) > existing.grade) existing.grade = r.grade ?? 0;
      if (r.followed_at && !existing.followed_at) existing.followed_at = r.followed_at;
    }
  }

  const profiles = Array.from(ownersMap.values());

  /* ── Derive profile categories ── */
  const followedProfiles   = profiles.filter(p => p.followed && !p.unfollowed);
  const mutualProfiles     = profiles.filter(p => p.followed && p.follow_back && !p.unfollowed);
  const pendingProfiles    = profiles.filter(p => p.followed && !p.follow_back && !p.unfollowed);
  const topPickProfiles    = profiles.filter(p => p.grade >= 90 || (p.grade >= 9 && p.grade <= 10));

  /* ── Counts ── */
  const followedTotal = followedProfiles.length;
  const mutualTotal   = mutualProfiles.length;
  const pendingTotal  = pendingProfiles.length;
  const topPicksTotal = topPickProfiles.length;

  const pct = followedTotal > 0
    ? Math.round((mutualTotal / followedTotal) * 100)
    : 0;

  /* ── Sparklines (daily counts, last 30 days, using created_at) ── */
  const sparkFollowed = dailyCounts(followedProfiles);
  const sparkMutual   = dailyCounts(mutualProfiles);
  const sparkTopPicks = dailyCounts(topPickProfiles);
  const sparkPending  = dailyCounts(pendingProfiles);

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
        note={`${pendingTotal} pending · ${mutualTotal} mutual`}
        spark={sparkFollowed}
        sparkColor="var(--accent)"
        isFirst={true}
        isLoading={isLoading}
      />
      <StatCell
        label="Follow-back rate"
        primary={`${pct}%`}
        note={`${mutualTotal} of ${followedTotal} active`}
        spark={sparkMutual}
        sparkColor="var(--ink)"
        isLoading={isLoading}
      />
      <StatCell
        label="Top Picks"
        primary={topPicksTotal.toLocaleString()}
        note="Quality score ≥ 90"
        spark={sparkTopPicks}
        sparkColor="var(--accent)"
        isLoading={isLoading}
      />
      <StatCell
        label="Pending Response"
        primary={pendingTotal.toLocaleString()}
        note="Awaiting follow-back"
        spark={sparkPending}
        sparkColor="var(--faint)"
        isLoading={isLoading}
      />
    </div>
  );
}
