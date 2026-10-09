'use client';

import React, { useEffect, useState } from 'react';
import type { ProfileItem, Repo } from '@/lib/types';

export interface ProfileDrawerProps {
  profile: ProfileItem | null;   /* null = closed */
  repos: Repo[];                 /* full repos array — filter by owner in drawer */
  onClose: () => void;
  onUnfollow?: (login: string) => void;
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

export default function ProfileDrawer({ profile, repos, onClose, onUnfollow }: ProfileDrawerProps) {

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

  if (!profile) return null;

  const login = profile.login || profile.owner;

  /* Repos belonging to this owner — exclude synthetic language='Profile' rows */
  const ownerRepos = repos.filter(
    r => (r.owner.toLowerCase() === login.toLowerCase() || r.owner.toLowerCase() === profile.owner.toLowerCase()) && r.language !== 'Profile'
  );

  const isMutual     = profile.followed && profile.follow_back && !profile.unfollowed;
  const isUnfollowed = profile.unfollowed === true;
  const grade        = profile.grade ?? null;

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
              {profile.bio && (
                <p style={{ fontSize:13, color:'var(--muted)', marginTop:4, lineHeight:1.4 }}>
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div style={{
            display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16,
          }}>
            {[
              { label:'Score', value: grade !== null ? String(grade) : '—' },
              { label:'Followers', value: profile.followers_count?.toLocaleString() ?? '—' },
              { label:'Following', value: profile.following_count?.toLocaleString() ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background:'var(--bg)', border:'1px solid var(--line)',
                borderRadius:'var(--r)', padding:'8px 10px', textAlign:'center',
              }}>
                <div style={{ fontSize:18, fontWeight:700, color:'var(--ink)' }}>{value}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Reason */}
          {profile.reason && (
            <div style={{
              background:'var(--bg)', border:'1px solid var(--line)',
              borderRadius:'var(--r)', padding:'10px 12px', marginBottom:16,
              fontSize:12, color:'var(--muted)', lineHeight:1.5,
            }}>
              <span style={{ fontWeight:600, color:'var(--ink)' }}>Grade reason: </span>
              {profile.reason}
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
