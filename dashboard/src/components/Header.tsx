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
    const val = nextDark ? 'dark' : 'light';
    localStorage.setItem('fm-theme', val);
    localStorage.setItem('theme', val);
    document.cookie = `fm-theme=${val}; path=/; max-age=31536000; SameSite=Lax`;
    setIsDark(nextDark);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { isDark: nextDark } }));
  }

  return (
    <header style={{
      width: '100%',
      height: 52,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 12,
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>

      {/* LEFT GROUP */}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{
          width:28, height:28, borderRadius:6,
          background:'var(--accent)', color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontWeight:800, fontSize:14, flexShrink:0,
        }}>F</div>
        <span style={{ color:'var(--ink)', fontWeight:600, fontSize:15, lineHeight:1 }}>FollowMe</span>

        {/* Status dot */}
        <span style={{
          width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
          backgroundColor:
            status === 'running' ? 'var(--accent)'
            : status === 'paused' ? 'var(--warn)'
            : 'var(--faint)',
        }} />

        {lastRunLabel && (
          <span style={{ color:'var(--muted)', fontSize:12 }}>{lastRunLabel}</span>
        )}
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
            background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 'var(--r)',
            padding: '4px 12px', fontSize: 13, fontWeight: 500,
            opacity: status === 'running' ? 0.5 : 1,
            cursor: status === 'running' ? 'not-allowed' : 'pointer',
          }}
        >Run Now</button>

        {/* Pause / Resume */}
        <button
          onClick={status === 'paused' ? onUnpause : onPause}
          style={{
            background: 'var(--hover)', color: 'var(--ink)',
            border: '1px solid var(--line)', borderRadius: 'var(--r)',
            padding: '4px 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >{status === 'paused' ? 'Resume' : 'Pause'}</button>

        {/* Unfollow */}
        <button
          onClick={onUnfollowOpen}
          style={{
            background: 'var(--hover)', color: 'var(--ink)',
            border: '1px solid var(--line)', borderRadius: 'var(--r)',
            padding: '4px 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >Unfollow</button>

        {/* Gear */}
        <button
          onClick={onSettingsOpen}
          aria-label="Settings"
          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', display:'flex', alignItems:'center', padding:4 }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>

        {/* Dark toggle */}
        <button
          onClick={toggleDark}
          aria-label="Toggle dark mode"
          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', display:'flex', alignItems:'center', padding:4 }}
        >
          {/* Sun — visible when document has .dark */}
          <svg className="hidden dark:block" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          {/* Moon — visible when light mode (no .dark class) */}
          <svg className="block dark:hidden" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
          </svg>
        </button>

      </div>
    </header>
  );
}
