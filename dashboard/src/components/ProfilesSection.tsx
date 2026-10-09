'use client';

import React, { useState, useMemo } from 'react';
import type { ProfileItem } from '@/lib/types';

type Segment = 'all' | 'top' | 'followed' | 'mutual' | 'unfollowed';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'top',        label: 'Top Picks' },
  { key: 'followed',   label: 'Followed' },
  { key: 'mutual',     label: 'Mutual' },
  { key: 'unfollowed', label: 'Unfollowed' },
];

function applySegment(items: ProfileItem[], seg: Segment): ProfileItem[] {
  switch (seg) {
    case 'top':        return items.filter(p => (p.grade ?? 0) >= 9 && p.language !== 'Profile');
    case 'followed':   return items.filter(p => p.followed && !p.unfollowed);
    case 'mutual':     return items.filter(p => p.followed && p.follow_back && !p.unfollowed);
    case 'unfollowed': return items.filter(p => p.unfollowed === true);
    default:           return items;
  }
}

function ProfileRow({
  profile, onClick,
}: { profile: ProfileItem; onClick: () => void }) {
  const isMutual     = profile.followed && profile.follow_back && !profile.unfollowed;
  const isUnfollowed = profile.unfollowed === true;
  const grade        = profile.grade ?? null;
  const displayName  = profile.login || profile.owner;

  /* Badge */
  const badge = isUnfollowed
    ? { label: 'Unfollowed', bg: 'var(--warn-tint)', color: 'var(--warn)' }
    : isMutual
    ? { label: 'Mutual',     bg: 'var(--accent-tint)', color: 'var(--accent)' }
    : profile.followed
    ? { label: 'Followed',   bg: 'var(--hover)',       color: 'var(--muted)' }
    : null;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--line)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Avatar */}
      {profile.avatar_url ? (
        <img src={profile.avatar_url} alt={displayName}
          width={36} height={36}
          style={{ borderRadius: '50%', flexShrink: 0, border: '1px solid var(--line)' }} />
      ) : (
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: 'var(--hover)', border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: 'var(--muted)', fontWeight: 600,
        }}>
          {displayName[0]?.toUpperCase()}
        </div>
      )}

      {/* Identity */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </span>
          {badge && (
            <span style={{
              fontSize: 11, fontWeight: 500, padding: '2px 7px',
              borderRadius: 99, background: badge.bg, color: badge.color,
              flexShrink: 0,
            }}>
              {badge.label}
            </span>
          )}
        </div>
        {profile.bio && (
          <span style={{
            fontSize: 12, color: 'var(--muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'block', maxWidth: '100%',
          }}>
            {profile.bio}
          </span>
        )}
      </div>

      {/* Score */}
      {grade !== null && (() => {
        const displayScore = Math.min(100, Math.round((grade ?? 0) * 10));
        const isHighScore = displayScore >= 90;
        return (
          <div style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: 'var(--r)',
            background: isHighScore ? 'var(--accent-tint)' : 'var(--hover)',
            border: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700,
            color: isHighScore ? 'var(--accent)' : 'var(--muted)',
          }}>
            {displayScore}
          </div>
        );
      })()}
    </div>
  );
}

const PAGE_SIZE = 20;

export interface ProfilesSectionProps {
  profiles: ProfileItem[];
  onProfileClick: (profile: ProfileItem) => void;
}

export default function ProfilesSection({ profiles, onProfileClick }: ProfilesSectionProps) {
  const [segment, setSegment] = useState<Segment>('all');
  const [query,   setQuery]   = useState('');
  const [page,    setPage]    = useState(1);

  const filtered = useMemo(() => {
    const seg = applySegment(profiles, segment);
    if (!query.trim()) return seg;
    const q = query.toLowerCase();
    return seg.filter(p => {
      const name = p.login || p.owner;
      return name.toLowerCase().includes(q) || (p.bio ?? '').toLowerCase().includes(q);
    });
  }, [profiles, segment, query]);

  /* Reset page when filter changes */
  const visibleCount = page * PAGE_SIZE;
  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  function handleSegment(s: Segment) {
    setSegment(s);
    setPage(1);
  }
  function handleQuery(v: string) {
    setQuery(v);
    setPage(1);
  }

  /* Segment counts */
  const counts = useMemo(() =>
    Object.fromEntries(
      SEGMENTS.map(s => [s.key, applySegment(profiles, s.key).length])
    ) as Record<Segment, number>,
  [profiles]);

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 'var(--r)', overflow: 'hidden',
    }}>

      {/* ── Header bar ── */}
      <div style={{
        padding: '12px 16px 0',
        borderBottom: '1px solid var(--line)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>

        {/* Segmented control */}
        <div style={{ display: 'flex', gap: 4 }}>
          {SEGMENTS.map(s => (
            <button key={s.key} onClick={() => handleSegment(s.key)}
              style={{
                padding: '5px 12px', borderRadius: 'var(--r)',
                border: segment === s.key ? '1px solid var(--accent)' : '1px solid var(--line)',
                background: segment === s.key ? 'var(--accent-tint)' : 'transparent',
                color: segment === s.key ? 'var(--accent)' : 'var(--muted)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>
              {s.label}
              <span style={{ marginLeft: 5, opacity: 0.7 }}>({counts[s.key]})</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ paddingBottom: 10 }}>
          <input
            type="search"
            placeholder="Search by username or bio…"
            value={query}
            onChange={e => handleQuery(e.target.value)}
            style={{
              width: '100%', padding: '7px 12px',
              border: '1px solid var(--line)', borderRadius: 'var(--r)',
              background: 'var(--bg)', color: 'var(--ink)',
              fontSize: 13, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* ── Rows ── */}
      {visible.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          No profiles match this filter.
        </div>
      ) : (
        visible.map(p => (
          <ProfileRow key={p.login || p.owner} profile={p} onClick={() => onProfileClick(p)} />
        ))
      )}

      {/* ── Show more ── */}
      {hasMore && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
          <button
            onClick={() => setPage(pg => pg + 1)}
            style={{
              width: '100%', padding: '8px 0',
              border: '1px solid var(--line)', borderRadius: 'var(--r)',
              background: 'var(--hover)', color: 'var(--muted)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
            Show more ({filtered.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
