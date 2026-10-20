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
      borderBottom: '1px solid var(--line)',
      background: 'var(--surface)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      transition: 'background 0.25s ease, border-color 0.25s ease',
    }}>
      <div style={{
        maxWidth: 1120,
        margin: '0 auto',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        gap: 16,
      }}>

        {/* BRAND (Left) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: '-.01em',
          color: 'var(--ink)',
        }}>
          <span style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'var(--ink)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1)',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 2v8M3 2h6M3 6h4" stroke="var(--surface)" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', lineHeight: 1 }}>FollowMe</span>
        </div>

        {/* STATUS & ACTIONS (Right) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--muted)', fontSize: 13 }}>
          {/* Status Indicator */}
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background:
                status === 'running' ? 'var(--accent)'
                : status === 'paused' ? 'var(--warn)'
                : 'var(--accent)',
              display: 'inline-block',
              marginRight: 6,
              boxShadow:
                status === 'paused' ? '0 0 0 3px var(--warn-tint)'
                : '0 0 0 3px var(--accent-tint)',
              transition: 'box-shadow 0.25s ease, background 0.25s ease',
            }} />
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>
              {status === 'running' ? 'Worker running' : status === 'paused' ? 'Worker paused' : 'Worker idle'}
            </span>
          </span>

          {lastRunLabel && (
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>{lastRunLabel}</span>
          )}

          {/* Settings */}
          <button
            onClick={onSettingsOpen}
            aria-label="Settings"
            title="Settings"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid var(--line-strong)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--muted)',
              background: 'var(--surface)',
              cursor: 'pointer',
              transition: 'all 0.18s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>

          {/* Theme button (Sun in dark, Moon in light) */}
          <button
            onClick={toggleDark}
            aria-label="Toggle dark mode"
            title="Toggle theme"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid var(--line-strong)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--muted)',
              background: 'var(--surface)',
              cursor: 'pointer',
              transition: 'all 0.18s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            {/* Sun in dark mode */}
            <svg className="hidden dark:block" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            {/* Moon in light mode */}
            <svg className="block dark:hidden" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
            </svg>
          </button>
        </div>

      </div>
    </header>
  );
}
