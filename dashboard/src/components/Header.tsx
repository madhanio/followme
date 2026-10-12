'use client';

import { useEffect, useState } from 'react';

export interface HeaderProps {
  status: 'idle' | 'running' | 'paused';
  lastRunLabel: string | null;
  onRunNow: () => void;
  onPause: () => void;
  onUnpause: () => void;
  onUnfollowOpen: () => void;
  onSettingsOpen: () => void;
}

export default function Header({
  status,
  lastRunLabel,
  onRunNow,
  onPause,
  onUnpause,
  onUnfollowOpen,
  onSettingsOpen,
}: HeaderProps) {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    const updateThemeState = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    updateThemeState();

    window.addEventListener('themechange', updateThemeState);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      const explicit = localStorage.getItem('fm-theme') || localStorage.getItem('theme');
      if (!explicit) {
        document.documentElement.classList.toggle('dark', e.matches);
        setIsDark(e.matches);
      }
    };
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      window.removeEventListener('themechange', updateThemeState);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  function toggleDark() {
    const isCurrentlyDark = document.documentElement.classList.contains('dark');
    const nextDark = !isCurrentlyDark;
    document.documentElement.classList.toggle('dark', nextDark);
    document.documentElement.style.colorScheme = nextDark ? 'dark' : 'light';
    const val = nextDark ? 'dark' : 'light';
    localStorage.setItem('fm-theme', val);
    localStorage.setItem('theme', val);
    document.cookie = `fm-theme=${val}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `theme=${val}; path=/; max-age=31536000; SameSite=Lax`;
    setIsDark(nextDark);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { isDark: nextDark } }));
  }

  return (
    <header style={{
      width: '100%',
      height: 56,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 16,
      position: 'sticky',
      top: 0,
      zIndex: 50,
      transition: 'background 0.25s ease, border-color 0.25s ease',
    }}>

      {/* LEFT GROUP */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6,
          background: 'var(--ink)',
          display: 'grid', placeItems: 'center',
          flexShrink: 0,
          transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1)',
          cursor: 'pointer',
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 2v8M3 2h6M3 6h4" stroke="var(--surface)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <span style={{ color:'var(--ink)', fontWeight:700, fontSize:15, letterSpacing:'-.01em', lineHeight:1 }}>FollowMe</span>

        {/* Status indicator */}
        <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--muted)', fontSize:13, marginLeft:4 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
            backgroundColor:
              status === 'running' ? 'var(--accent)'
              : status === 'paused' ? 'var(--warn)'
              : 'var(--accent)',
            boxShadow:
              status === 'paused' ? '0 0 0 3px var(--warn-tint)'
              : '0 0 0 3px var(--accent-tint)',
            transition: 'box-shadow 0.25s ease, background 0.25s ease',
          }} />
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>
            {status === 'running' ? 'Worker running' : status === 'paused' ? 'Worker paused' : 'Worker idle'}
          </span>
          {lastRunLabel && (
            <span style={{ color:'var(--muted)', fontSize:13, opacity: 0.85 }}>• {lastRunLabel}</span>
          )}
        </div>
      </div>

      {/* SPACER */}
      <div style={{ flex: 1 }} />

      {/* RIGHT GROUP */}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>

        {/* Run Now */}
        <button
          onClick={onRunNow}
          disabled={status === 'running'}
          style={{
            background: 'var(--ink)', color: 'var(--surface)',
            border: '1px solid var(--ink)', borderRadius: 7,
            padding: '5px 12px', fontSize: 12.5, fontWeight: 600,
            opacity: status === 'running' ? 0.5 : 1,
            cursor: status === 'running' ? 'not-allowed' : 'pointer',
            transition: 'all 0.16s cubic-bezier(0.16,1,0.3,1)',
          }}
        >Run Now</button>

        {/* Pause / Resume */}
        <button
          onClick={status === 'paused' ? onUnpause : onPause}
          style={{
            background: 'var(--surface)', color: 'var(--ink)',
            border: '1px solid var(--line-strong)', borderRadius: 7,
            padding: '5px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.16s cubic-bezier(0.16,1,0.3,1)',
          }}
        >{status === 'paused' ? 'Resume' : 'Pause'}</button>

        {/* Unfollow */}
        <button
          onClick={onUnfollowOpen}
          style={{
            background: 'var(--surface)', color: 'var(--ink)',
            border: '1px solid var(--line-strong)', borderRadius: 7,
            padding: '5px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.16s cubic-bezier(0.16,1,0.3,1)',
          }}
        >Unfollow</button>

        {/* Settings */}
        <button
          onClick={onSettingsOpen}
          aria-label="Settings"
          title="Settings"
          style={{
            width: 32, height: 32, borderRadius: 8,
            border: '1px solid var(--line-strong)',
            background: 'var(--surface)', color: 'var(--muted)',
            display: 'grid', placeItems: 'center', cursor: 'pointer',
            transition: 'all 0.18s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>

        {/* Theme button */}
        <button
          onClick={toggleDark}
          aria-label="Toggle theme"
          title="Toggle theme"
          style={{
            width: 32, height: 32, borderRadius: 8,
            border: '1px solid var(--line-strong)',
            background: 'var(--surface)', color: 'var(--muted)',
            display: 'grid', placeItems: 'center', cursor: 'pointer',
            transition: 'all 0.18s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* Sun — visible when document has .dark */}
          <svg className="hidden dark:block" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          {/* Moon — visible when light mode */}
          <svg className="block dark:hidden" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
          </svg>
        </button>

      </div>
    </header>
  );
}
