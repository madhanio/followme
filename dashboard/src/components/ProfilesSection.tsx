'use client';

import React, { useState, useMemo } from 'react';
import type { ProfileItem } from '@/lib/types';

type Segment = 'all' | 'top' | 'followed' | 'mutual';
type QuickPill = 'stars' | 'active' | 'highvol' | null;

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'top',        label: 'Top Picks' },
  { key: 'followed',   label: 'Followed' },
  { key: 'mutual',     label: 'Mutual' },
];

function applySegment(items: ProfileItem[], seg: Segment): ProfileItem[] {
  switch (seg) {
    case 'top':        return items.filter(p => ((p.grade ?? 0) >= 90 || ((p.grade ?? 0) >= 9 && (p.grade ?? 0) <= 10)) && p.language !== 'Profile');
    case 'followed':   return items.filter(p => p.followed && !p.follow_back && !p.unfollowed);
    case 'mutual':     return items.filter(p => p.followed && p.follow_back && !p.unfollowed);
    default:           return items.filter(p => p.followed && !p.unfollowed);
  }
}

function matchesPill(p: ProfileItem, pill: QuickPill): boolean {
  if (!pill) return true;
  if (pill === 'stars') {
    const hasInRepos = p.repos.some(r => (r.stars || 0) >= 100);
    const hasInTopRepos = Array.isArray(p.top_repos) && p.top_repos.some((r: any) => (r.stars || r.stargazers_count || 0) >= 100);
    return hasInRepos || hasInTopRepos;
  }
  if (pill === 'active') {
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const hasActivePush = p.last_pushed_at && new Date(p.last_pushed_at).getTime() >= fourteenDaysAgo;
    const hasRepoPush = p.repos.some(r => r.last_pushed_at && new Date(r.last_pushed_at).getTime() >= fourteenDaysAgo);
    const hasTopRepoPush = Array.isArray(p.top_repos) && p.top_repos.some((r: any) => r.pushed_at && new Date(r.pushed_at).getTime() >= fourteenDaysAgo);
    return Boolean(hasActivePush || hasRepoPush || hasTopRepoPush);
  }
  if (pill === 'highvol') {
    const hasManyRepos = (p.public_repos_count || 0) >= 5 || p.reposCount >= 3;
    const hasManyFollowers = (p.followers_count || 0) >= 100;
    return hasManyRepos || hasManyFollowers;
  }
  return true;
}

function synthesizeReason(p: ProfileItem): string {
  // If we have an AI evaluation or high quality graded reason, display it
  if (p.reason && !p.reason.toLowerCase().includes('high repository quality and active commit cadence')) {
    return p.reason;
  }
  // Check if profile was skipped
  if (p.followStatus.follow_skipped && p.followStatus.reason) {
    return `Skipped: ${p.followStatus.reason}`;
  }
  // Evidence-based dynamic synthesis from top repositories & languages
  const topRepo = (Array.isArray(p.top_repos) && p.top_repos[0]) || p.repos[0];
  const firstLang = Array.isArray(p.languages) ? p.languages[0] : null;
  const lang = (typeof firstLang === 'object' && firstLang !== null ? (firstLang as any).name : firstLang)
    || (p.language && p.language !== 'Profile' ? p.language : topRepo?.language);
  const stars = topRepo?.stars || (topRepo as any)?.stargazers_count || 0;
  
  if (stars >= 100 && lang) {
    return `Maintains ${topRepo.name} with ${stars.toLocaleString()} stars in ${lang}.`;
  }
  if (lang && p.reposCount >= 2) {
    return `Active ${lang} open-source contributor with ${p.reposCount} public projects.`;
  }
  if (lang) {
    return `Active ${lang} developer shipping public repositories.`;
  }
  if (stars >= 50 && topRepo?.name) {
    return `Created ${topRepo.name} with ${stars.toLocaleString()} stars.`;
  }
  return `Consistent open-source contributions and active commit cadence.`;
}

function ProfileRow({
  profile, onClick,
}: { profile: ProfileItem; onClick: () => void }) {
  const isMutual     = profile.followed && profile.follow_back && !profile.unfollowed;
  const isUnfollowed = profile.unfollowed === true;
  const grade        = profile.grade ?? 0;
  const username     = profile.login || profile.owner;
  const fullName     = profile.display_name || (profile as any).name || null;
  const displayScore = Math.min(100, grade <= 10 && grade > 0 ? Math.round(grade * 10) : Math.round(grade));
  const isTopPick    = displayScore >= 90 && !profile.followStatus.follow_skipped;

  /* Status badge text & styling */
  const statusLabel = isUnfollowed
    ? { text: 'Unfollowed', bg: 'var(--warn-tint)', color: 'var(--warn)' }
    : isMutual
    ? { text: 'Mutual', bg: 'var(--accent-tint)', color: 'var(--accent)' }
    : profile.followed
    ? { text: 'Followed', bg: 'var(--accent-tint)', color: 'var(--accent)' }
    : profile.followStatus.follow_skipped
    ? { text: 'Skipped', bg: 'var(--warn-tint)', color: 'var(--warn)' }
    : { text: 'Queued', bg: 'var(--hover)', color: 'var(--muted)' };

  const reason = synthesizeReason(profile);

  const [isWhitelisted, setIsWhitelisted] = useState(profile.whitelisted ?? false);
  const [isTogglingWhitelist, setIsTogglingWhitelist] = useState(false);

  // Sync state if profile prop updates
  React.useEffect(() => {
    setIsWhitelisted(profile.whitelisted ?? false);
  }, [profile.whitelisted]);

  const hasDistinctName = Boolean(fullName && fullName.trim().toLowerCase() !== username.toLowerCase());

  const handleToggleWhitelist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTogglingWhitelist) return;
    const nextVal = !isWhitelisted;
    setIsWhitelisted(nextVal);
    setIsTogglingWhitelist(true);
    try {
      const { toggleWhitelist } = await import('@/app/actions');
      const res = await toggleWhitelist(username, nextVal);
      if (!res.success) {
        setIsWhitelisted(!nextVal); // revert
      } else {
        profile.whitelisted = nextVal;
      }
    } catch {
      setIsWhitelisted(!nextVal);
    } finally {
      setIsTogglingWhitelist(false);
    }
  };

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(200px, 1.4fr) 110px minmax(180px, 2fr) 100px 140px',
        alignItems: 'center',
        gap: 16,
        padding: '12px 18px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--line)',
        transition: 'background 0.14s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={fullName || username}
            width={32}
            height={32}
            style={{ borderRadius: '50%', flexShrink: 0, border: '1px solid var(--line)' }}
          />
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'var(--hover)', border: '1px solid var(--line)',
            display: 'grid', placeItems: 'center',
            fontSize: 12, color: 'var(--muted)', fontWeight: 700,
          }}>
            {(fullName || username)[0]?.toUpperCase()}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span>{hasDistinctName ? fullName : `@${username}`}</span>
            {/* Interactive Bookmark / Whitelist Button */}
            <button
              type="button"
              onClick={handleToggleWhitelist}
              title={isWhitelisted ? 'Whitelisted (Saved from auto-unfollow) — Click to remove' : 'Add to Whitelist (Protect from auto-unfollow)'}
              aria-label={isWhitelisted ? 'Remove from whitelist' : 'Add to whitelist'}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '2px 4px',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                color: isWhitelisted ? 'var(--ink)' : 'var(--muted)',
                opacity: isWhitelisted ? 1 : 0.45,
                transition: 'all 0.16s ease',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = isWhitelisted ? '1' : '0.45'; }}
            >
              <svg width="13" height="14" viewBox="0 0 24 24" fill={isWhitelisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          </div>
          {hasDistinctName && (
            <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>@{username}</div>
          )}
        </div>
      </div>

      {/* Score with Mini Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>
        <span>{displayScore}</span>
        <span style={{ width: 44, height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden', display: 'block' }}>
          <i style={{ display: 'block', height: '100%', borderRadius: 2, background: 'var(--ink)', width: `${displayScore}%`, transition: 'width 0.3s ease' }} />
        </span>
      </div>

      {/* Reason */}
      <div style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={reason}>
        {reason}
      </div>

      {/* Status Chip */}
      <div>
        <span style={{
          fontSize: 12, fontWeight: 600, padding: '2px 9px', borderRadius: 999,
          display: 'inline-block', background: statusLabel.bg, color: statusLabel.color,
        }}>
          {statusLabel.text}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          onClick={e => {
            e.stopPropagation();
            onClick();
          }}
          style={{
            fontSize: 12, fontWeight: 600, padding: '4px 9px', borderRadius: 6,
            border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)',
            cursor: 'pointer', transition: 'all 0.16s ease',
          }}
        >
          View
        </button>
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

export interface ProfilesSectionProps {
  profiles: ProfileItem[];
  onProfileClick: (profile: ProfileItem) => void;
  isLoading?: boolean;
}

export default function ProfilesSection({ profiles, onProfileClick, isLoading }: ProfilesSectionProps) {
  const [segment, setSegment] = useState<Segment>('all');
  const [activePill, setActivePill] = useState<QuickPill>(null);
  const [query,   setQuery]   = useState('');
  const [page,    setPage]    = useState(1);

  const filtered = useMemo(() => {
    let list = applySegment(profiles, segment);
    if (activePill) {
      list = list.filter(p => matchesPill(p, activePill));
    }
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(p => {
      const name = p.login || p.owner;
      return name.toLowerCase().includes(q) || (p.bio ?? '').toLowerCase().includes(q);
    });
  }, [profiles, segment, activePill, query]);

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
  function togglePill(pill: 'stars' | 'active' | 'highvol') {
    setActivePill(prev => prev === pill ? null : pill);
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

      {/* ── Toolbar matching demo ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 18px',
        flexWrap: 'wrap',
        borderBottom: '1px solid var(--line)',
      }}>
        {/* Segmented control + Quick pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex',
            border: '1px solid var(--line-strong)',
            borderRadius: 8,
            padding: 2,
            background: 'var(--bg)',
          }}>
            {SEGMENTS.map(s => {
              const isSelected = segment === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => handleSegment(s.key)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: isSelected ? 600 : 500,
                    color: isSelected ? 'var(--ink)' : 'var(--muted)',
                    background: isSelected ? 'var(--surface)' : 'transparent',
                    boxShadow: isSelected ? '0 0 0 1px var(--line-strong)' : 'none',
                    cursor: 'pointer',
                    border: 'none',
                    transition: 'all 0.16s cubic-bezier(0.16,1,0.3,1)',
                  }}
                >
                  {s.label}
                  {!isLoading && (
                    <span style={{ color: isSelected ? 'var(--muted)' : 'var(--faint)', marginLeft: 5, fontWeight: 400 }}>
                      {counts[s.key]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick evidence filter pills matching demo */}
          <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => togglePill('stars')}
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: '4px 9px',
                borderRadius: 6,
                border: activePill === 'stars' ? '1px solid var(--ink)' : '1px solid var(--line)',
                background: activePill === 'stars' ? 'var(--ink)' : 'var(--surface)',
                color: activePill === 'stars' ? 'var(--surface)' : 'var(--muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.16s ease',
              }}
            >
              ⭐ &gt;100 Stars
            </button>
            <button
              onClick={() => togglePill('active')}
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: '4px 9px',
                borderRadius: 6,
                border: activePill === 'active' ? '1px solid var(--ink)' : '1px solid var(--line)',
                background: activePill === 'active' ? 'var(--ink)' : 'var(--surface)',
                color: activePill === 'active' ? 'var(--surface)' : 'var(--muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.16s ease',
              }}
            >
              ⚡ Active (&lt;14d)
            </button>
            <button
              onClick={() => togglePill('highvol')}
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: '4px 9px',
                borderRadius: 6,
                border: activePill === 'highvol' ? '1px solid var(--ink)' : '1px solid var(--line)',
                background: activePill === 'highvol' ? 'var(--ink)' : 'var(--surface)',
                color: activePill === 'highvol' ? 'var(--surface)' : 'var(--muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.16s ease',
              }}
            >
              🔥 High Commits
            </button>
          </div>
        </div>

        {/* Search */}
        <input
          type="search"
          placeholder="Search candidates…"
          value={query}
          onChange={e => handleQuery(e.target.value)}
          style={{
            border: '1px solid var(--line-strong)',
            borderRadius: 8,
            padding: '7px 11px',
            minWidth: 220,
            background: 'var(--surface)',
            color: 'var(--ink)',
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      {/* Table Column Header in clean title-case */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(200px, 1.4fr) 110px minmax(180px, 2fr) 100px 140px',
        alignItems: 'center',
        gap: 16,
        padding: '0 18px',
        height: 36,
        color: 'var(--faint)',
        fontSize: 12.5,
        borderBottom: '1px solid var(--line)',
        background: 'var(--hover)',
      }}>
        <span>Developer</span>
        <span>Score</span>
        <span>Why this score</span>
        <span>Status</span>
        <span style={{ textAlign: 'right' }}>Action</span>
      </div>

      {/* ── Rows ── */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px',
              borderBottom: '1px solid var(--line)',
            }}>
              {/* Skeleton Avatar */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--hover)',
                animation: 'fm-pulse 1.6s ease-in-out infinite',
                flexShrink: 0,
              }} />
              {/* Skeleton Info */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{
                  width: 140, height: 14, borderRadius: 4,
                  background: 'var(--hover)',
                  animation: 'fm-pulse 1.6s ease-in-out infinite',
                }} />
                <div style={{
                  width: 220, height: 11, borderRadius: 4,
                  background: 'var(--hover)',
                  animation: 'fm-pulse 1.6s ease-in-out infinite',
                }} />
              </div>
              {/* Skeleton Score badge */}
              <div style={{
                width: 32, height: 32, borderRadius: 'var(--r)',
                background: 'var(--hover)',
                animation: 'fm-pulse 1.6s ease-in-out infinite',
                flexShrink: 0,
              }} />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
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
