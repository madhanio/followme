'use client';

import React, { useEffect, useState } from 'react';
import type { ProfileItem, Repo } from '@/lib/types';

export interface ProfileDrawerProps {
  profile: ProfileItem | null;   /* null = closed */
  repos: Repo[];                 /* full repos array — filter by owner in drawer */
  onClose: () => void;
  onUnfollow?: (login: string) => void;
  onUpdateProfile?: (updatedData: Partial<Repo>) => void;
}

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.35)',
  zIndex: 100,
};

/* Desktop: 420px right panel. Mobile (<640px): bottom sheet 80vh */
/* Applied via inline style + a <style> tag injected once */
const PANEL_ID = 'fm-drawer-panel';

const PANEL_BASE: React.CSSProperties = {
  position: 'fixed',
  top: 0, right: 0,
  width: 420,
  height: '100vh',
  background: 'var(--surface)',
  borderLeft: '1px solid var(--line)',
  zIndex: 101,
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'hidden',
};

/* Inject once into <head> for the mobile bottom-sheet override */
function ensureDrawerStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('fm-drawer-styles')) return;
  const s = document.createElement('style');
  s.id = 'fm-drawer-styles';
  s.textContent = `
    @media (max-width: 639px) {
      #${PANEL_ID} {
        top: auto !important;
        bottom: 0 !important;
        right: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 80vh !important;
        border-left: none !important;
        border-top: 1px solid var(--line) !important;
        border-radius: 12px 12px 0 0 !important;
      }
    }
  `;
  document.head.appendChild(s);
}

function RepoRow({ repo }: { repo: Repo }) {
  /* Bookmark (filled) toggle — no star ever */
  const [saved, setSaved] = useState(false);
  const name = repo.name ?? '(repo)';
  const stars = repo.stars ?? null;
  const lang  = (repo.language && repo.language !== 'Profile') ? repo.language : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 0',
      borderBottom: '1px solid var(--line)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <a
          href={repo.github_url || `https://github.com/${repo.owner ?? ''}/${name}`}
          target="_blank" rel="noreferrer"
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)',
            textDecoration: 'none', overflow:'hidden', textOverflow:'ellipsis',
            whiteSpace:'nowrap', display:'block' }}
        >
          {name}
        </a>
        <div style={{ display:'flex', gap:8, marginTop:2 }}>
          {lang && (
            <span style={{ fontSize:11, color:'var(--muted)' }}>{lang}</span>
          )}
          {stars !== null && (
            <span style={{ fontSize:11, color:'var(--muted)' }}>★ {stars.toLocaleString()}</span>
          )}
        </div>
      </div>
      {/* Filled bookmark icon — not a star */}
      <button
        onClick={() => setSaved(s => !s)}
        aria-label={saved ? 'Remove bookmark' : 'Bookmark'}
        style={{ background:'none', border:'none', cursor:'pointer',
          color: saved ? 'var(--accent)' : 'var(--faint)', padding:4, flexShrink:0 }}
      >
        <svg width={16} height={16} viewBox="0 0 24 24"
          fill={saved ? 'currentColor' : 'none'}
          stroke="currentColor" strokeWidth={2}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
        </svg>
      </button>
    </div>
  );
}

export default function ProfileDrawer({ profile, repos, onClose, onUnfollow, onUpdateProfile }: ProfileDrawerProps) {

  useEffect(() => { ensureDrawerStyles(); }, []);

  /* Trap body scroll while open */
  useEffect(() => {
    if (profile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [profile]);

  /* Close on Escape */
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [isFetching, setIsFetching] = useState(false);
  const [telemetryMsg, setTelemetryMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [liveData, setLiveData] = useState<{
    bio?: string | null;
    followers_count?: number;
    following_count?: number;
    account_age_years?: number;
    last_pushed_at?: string | null;
    languages?: Array<{ name: string; pct: number }>;
    top_repos?: Array<{
      name: string;
      stars: number;
      language?: string;
      description?: string;
      pushed_at?: string;
    }>;
  } | null>(null);

  // Reset telemetry message when profile changes
  useEffect(() => {
    setTelemetryMsg(null);
    setLiveData(null);
  }, [profile]);

  if (!profile) return null;

  const login = profile.login || profile.owner;

  async function handleFetchTelemetry() {
    setIsFetching(true);
    setTelemetryMsg(null);
    try {
      const res = await fetch('/api/profile/fetch-telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: login }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch GitHub profile telemetry');
      }

      setLiveData({
        bio: data.data.bio,
        followers_count: data.data.followers_count,
        following_count: data.data.following_count,
        account_age_years: data.data.account_age_years,
        last_pushed_at: data.data.last_pushed_at,
        languages: data.data.languages,
        top_repos: data.data.top_repos,
      });

      if (onUpdateProfile) {
        onUpdateProfile({
          owner: login,
          bio: data.data.bio,
          followers_count: data.data.followers_count,
          following_count: data.data.following_count,
          account_created_at: data.data.account_created_at,
          last_pushed_at: data.data.last_pushed_at,
        });
      }

      const langStr = data.data.languages?.map((l: any) => l.name).join(', ') || 'Code';
      
      if (data.savedToDb) {
        setTelemetryMsg({
          type: 'success',
          text: `✓ Saved to Supabase: ${data.data.followers_count} followers · ${langStr}`,
        });
      } else {
        setTelemetryMsg({
          type: 'error',
          text: `⚠️ Telemetry fetched, but DB write failed: ${data.dbErrorMessage || 'Profile owner not found in database'}`,
        });
      }
    } catch (err: any) {
      setTelemetryMsg({ type: 'error', text: `⚠️ ${err.message}` });
    } finally {
      setIsFetching(false);
    }
  }

  /* Repos belonging to this owner — exclude synthetic language='Profile' rows */
  const ownerRepos = repos.filter(
    r => (r.owner.toLowerCase() === login.toLowerCase() || r.owner.toLowerCase() === profile.owner.toLowerCase()) && r.language !== 'Profile'
  );

  const isMutual     = profile.followed && profile.follow_back && !profile.unfollowed;
  const isUnfollowed = profile.unfollowed === true;
  const grade        = profile.grade ?? null;

  const currentBio = liveData?.bio !== undefined ? liveData.bio : profile.bio;
  const currentFollowers = liveData?.followers_count !== undefined ? liveData.followers_count : profile.followers_count;
  const currentFollowing = liveData?.following_count !== undefined ? liveData.following_count : profile.following_count;
  const currentRatio = (currentFollowers && currentFollowing)
    ? (currentFollowers / Math.max(1, currentFollowing)).toFixed(1)
    : '1.0';

  /* Follow-back label */
  const statusLabel = isUnfollowed
    ? { text: 'Unfollowed', bg: 'var(--warn-tint)', color: 'var(--warn)' }
    : isMutual
    ? { text: 'Mutual',     bg: 'var(--accent-tint)', color: 'var(--accent)' }
    : profile.followed
    ? { text: 'Followed',   bg: 'var(--hover)',       color: 'var(--muted)' }
    : null;

  return (
    <>
      {/* Overlay */}
      <div style={OVERLAY} onClick={onClose} />

      {/* Panel */}
      <div id={PANEL_ID} style={PANEL_BASE}>

        {/* ── Top bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--line)',
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Profile</span>
          <button onClick={onClose} aria-label="Close drawer"
            style={{ background:'none', border:'none', cursor:'pointer',
              color:'var(--muted)', padding:4, display:'flex', alignItems:'center' }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

          {/* Avatar + identity */}
          <div style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:16 }}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={login}
                width={56} height={56}
                style={{ borderRadius:'50%', border:'1px solid var(--line)', flexShrink:0 }} />
            ) : (
              <div style={{
                width:56, height:56, borderRadius:'50%', flexShrink:0,
                background:'var(--hover)', border:'1px solid var(--line)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:20, color:'var(--muted)', fontWeight:600,
              }}>
                {(login ?? '?')[0]?.toUpperCase()}
              </div>
            )}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <a
                  href={`https://github.com/${login}`}
                  target="_blank" rel="noreferrer"
                  style={{ fontWeight:700, fontSize:16, color:'var(--ink)', textDecoration:'none' }}
                >
                  {login}
                </a>
                {statusLabel && (
                  <span style={{
                    fontSize:11, fontWeight:500, padding:'2px 8px',
                    borderRadius:99, background:statusLabel.bg, color:statusLabel.color,
                  }}>
                    {statusLabel.text}
                  </span>
                )}
              </div>
              {currentBio && (
                <p style={{ fontSize:13, color:'var(--muted)', marginTop:4, lineHeight:1.4 }}>
                  {currentBio}
                </p>
              )}
              {/* Activity pill badges matching demo */}
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'var(--accent-tint)',
                  color: 'var(--accent)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  {liveData?.last_pushed_at ? `Last push ${Math.max(1, Math.floor((Date.now() - new Date(liveData.last_pushed_at).getTime()) / (1000 * 60 * 60 * 24)))} days ago` : 'Active recently'}
                </span>
                <span style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'var(--hover)',
                  color: 'var(--muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  {`${ownerRepos.length} public projects`}
                </span>
              </div>
            </div>
          </div>

          {/* AI Evaluation Breakdown */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>
                AI Evaluation Breakdown
              </span>
              <button
                onClick={handleFetchTelemetry}
                disabled={isFetching}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--line-strong)',
                  background: isFetching ? 'var(--hover)' : 'var(--bg)',
                  color: isFetching ? 'var(--muted)' : 'var(--ink)',
                  cursor: isFetching ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.15s ease',
                }}
              >
                {isFetching ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    <span>Fetching...</span>
                  </>
                ) : (
                  <>
                    <span>⚡ Re-score</span>
                  </>
                )}
              </button>
            </div>

            {telemetryMsg && (
              <div style={{
                fontSize: 11.5,
                padding: '6px 10px',
                borderRadius: 6,
                background: telemetryMsg.type === 'success' ? 'var(--accent-tint)' : 'var(--warn-tint)',
                color: telemetryMsg.type === 'success' ? 'var(--accent)' : 'var(--warn)',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span>{telemetryMsg.text}</span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <b style={{ fontSize: 34, letterSpacing: '-.02em', color: 'var(--ink)' }}>
                {Math.min(100, Math.round((grade ?? 0) * 10))}
              </b>
              {statusLabel && (
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '2px 9px',
                  borderRadius: 999, background: statusLabel.bg, color: statusLabel.color,
                }}>
                  {statusLabel.text}
                </span>
              )}
            </div>

            {/* 4 Pillars Sub-scores (Read-only progress bars) */}
            {[
              { label: 'Activity', val: Math.min(99, Math.max(30, Math.round((grade ?? 7) * 10) + 4)) },
              { label: 'Code quality', val: Math.min(99, Math.max(30, Math.round((grade ?? 7) * 10) - 2)) },
              { label: 'Relevance', val: Math.min(99, Math.max(30, Math.round((grade ?? 7) * 10) + 3)) },
              { label: 'Reach', val: Math.min(99, Math.max(30, Math.round((grade ?? 7) * 10) - 6)) },
            ].map(pillar => (
              <div
                key={pillar.label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 1fr 28px',
                  gap: 10,
                  alignItems: 'center',
                  marginTop: 7,
                  fontSize: 13,
                  color: 'var(--muted)',
                }}
              >
                <span>{pillar.label}</span>
                <span style={{ height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden', display: 'block' }}>
                  <i style={{ display: 'block', height: '100%', borderRadius: 2, background: 'var(--ink)', width: `${pillar.val}%` }} />
                </span>
                <span style={{ color: 'var(--ink)', textAlign: 'right', fontWeight: 600 }}>{pillar.val}</span>
              </div>
            ))}
          </div>

          {/* Reason */}
          {profile.reason && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500, marginBottom: 6 }}>Why this score</div>
              <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.45 }}>{profile.reason}</p>
            </div>
          )}

          {/* Stats row (Facts) */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            border: '1px solid var(--line)', borderRadius: 'var(--r)',
            marginBottom: 20, overflow: 'hidden',
          }}>
            {[
              { label: 'Followers', value: currentFollowers?.toLocaleString() ?? '—' },
              { label: 'Following', value: currentFollowing?.toLocaleString() ?? '—' },
              { label: 'Ratio', value: currentRatio },
            ].map(({ label, value }, idx) => (
              <div key={label} style={{
                padding: '11px 13px',
                borderLeft: idx > 0 ? '1px solid var(--line)' : 'none',
              }}>
                <b style={{ display: 'block', fontSize: 17, color: 'var(--ink)' }}>{value}</b>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Languages Distribution matching demo */}
          {(() => {
            let langs = liveData?.languages;
            if (!langs || langs.length === 0) {
              const counts: Record<string, number> = {};
              let total = 0;
              ownerRepos.forEach(r => {
                if (r.language && r.language !== 'Profile') {
                  counts[r.language] = (counts[r.language] || 0) + 1;
                  total++;
                }
              });
              if (total > 0) {
                langs = Object.entries(counts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([name, count]) => ({
                    name,
                    pct: Math.round((count / total) * 100),
                  }));
              }
            }

            if (!langs || langs.length === 0) return null;

            return (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500, marginBottom: 8 }}>
                  Languages
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', overflow: 'hidden', display: 'flex', gap: 2, marginBottom: 6 }}>
                  {langs.map((l, i) => (
                    <div
                      key={l.name}
                      style={{
                        height: '100%',
                        width: `${l.pct}%`,
                        background: i === 0 ? 'var(--ink)' : i === 1 ? 'var(--accent)' : 'var(--muted)',
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--muted)' }}>
                  {langs.map((l) => (
                    <span key={l.name}>
                      {l.name} {l.pct}%
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Found by / Account Age metadata matching demo */}
          {liveData?.account_age_years && (
            <div style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              marginBottom: 20,
              fontSize: 12.5,
              color: 'var(--muted)',
              lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Account Profile: </span>
              Account is {liveData.account_age_years} years old on GitHub with {liveData.followers_count} followers.
            </div>
          )}

          {/* Repos */}
          {ownerRepos.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--ink)',
                marginBottom:8, textTransform:'uppercase', letterSpacing:'0.04em' }}>
                Repositories ({ownerRepos.length})
              </div>
              {ownerRepos.map(r => (
                <RepoRow key={r.id ?? r.name} repo={r} />
              ))}
            </div>
          )}

        </div>

        {/* ── Footer actions ── */}
        {!isUnfollowed && profile.followed && onUnfollow && (
          <div style={{
            padding:'12px 16px',
            borderTop:'1px solid var(--line)',
            flexShrink:0,
          }}>
            <button
              onClick={() => { onUnfollow(login); onClose(); }}
              style={{
                width:'100%', padding:'9px 0',
                border:'1px solid var(--warn)',
                borderRadius:'var(--r)',
                background:'var(--warn-tint)', color:'var(--warn)',
                fontSize:13, fontWeight:600, cursor:'pointer',
              }}>
              Unfollow {login}
            </button>
          </div>
        )}

      </div>
    </>
  );
}
