'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert, LogIn, KeyRound, Eye, EyeOff } from 'lucide-react';

const GithubIcon = ({ size = 16, style, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, width: size, height: size, ...style }}
    {...props}
  >
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

function LoginContent() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDark, setIsDark] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(urlError);
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const router = useRouter();

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

  useEffect(() => {
    if (urlError) {
      setError(urlError);
    }
  }, [urlError]);

  const handleGitHubOAuth = () => {
    setIsOAuthLoading(true);
    setError(null);

    const width = 600;
    const height = 700;
    const left = typeof window !== 'undefined' ? window.screenX + (window.outerWidth - width) / 2 : 100;
    const top = typeof window !== 'undefined' ? window.screenY + (window.outerHeight - height) / 2 : 100;

    const popup = window.open(
      '/api/auth/github',
      'github_oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=no,resizable=yes`
    );

    if (!popup) {
      window.location.href = '/api/auth/github';
      return;
    }

    const checkTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkTimer);
        setIsOAuthLoading(false);
      }
    }, 500);

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_OAUTH_SUCCESS') {
        clearInterval(checkTimer);
        window.removeEventListener('message', onMessage);
        setIsOAuthLoading(false);
        setIsRedirecting(true);
        window.location.href = '/';
      } else if (event.data?.type === 'GITHUB_OAUTH_ERROR') {
        clearInterval(checkTimer);
        window.removeEventListener('message', onMessage);
        setIsOAuthLoading(false);
        setIsRedirecting(false);
        setError(event.data?.error || 'Authentication was denied or failed.');
      }
    };

    window.addEventListener('message', onMessage);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid credentials');
        setIsLoading(false);
      }
    } catch {
      setError('Connection failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'var(--bg)',
        color: 'var(--ink)',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* Background glow decoration */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--accent-tint) 0%, transparent 70%)',
          pointerEvents: 'none',
          opacity: 0.6,
        }}
      />

      {/* Top right Theme toggle */}
      <div style={{ position: 'absolute', top: 20, right: 24, zIndex: 20 }}>
        <button
          type="button"
          onClick={toggleDark}
          aria-label="Toggle dark mode"
          title="Toggle theme"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: '1px solid var(--line-strong)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--muted)',
            background: 'var(--surface)',
            cursor: 'pointer',
            transition: 'all 0.18s cubic-bezier(0.16,1,0.3,1)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Sun in dark mode */}
          <svg className="hidden dark:block" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          {/* Moon in light mode */}
          <svg className="block dark:hidden" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
          </svg>
        </button>
      </div>

      {/* Main Login Card */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 420,
          background: 'var(--surface)',
          border: '1px solid var(--line-strong)',
          borderRadius: 14,
          padding: '36px 32px',
          boxShadow: 'var(--shadow-hover)',
          boxSizing: 'border-box',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Brand Icon & Heading */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* Real FollowMe Brand Logo */}
            <img
              src="/logo-black-cropped.png"
              alt="FollowMe Logo"
              className="block dark:hidden"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            <img
              src="/logo-white-cropped.png"
              alt="FollowMe Logo"
              className="hidden dark:block"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
              color: 'var(--ink)',
              margin: 0,
            }}
          >
            Access Control
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--muted)',
              marginTop: 6,
              lineHeight: 1.4,
            }}
          >
            FollowMe Gateway • Sign in to continue
          </p>
        </div>

        {/* 1. GitHub OAuth Login Button */}
        <div style={{ marginBottom: 20 }}>
          <button
            type="button"
            onClick={handleGitHubOAuth}
            disabled={isOAuthLoading || isLoading}
            style={{
              width: '100%',
              padding: '11px 16px',
              fontSize: 13.5,
              fontWeight: 600,
              borderRadius: 'var(--r)',
              border: '1px solid var(--line-strong)',
              background: 'var(--hover)',
              color: 'var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              cursor: isOAuthLoading || isLoading ? 'not-allowed' : 'pointer',
              opacity: isOAuthLoading || isLoading ? 0.6 : 1,
              transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
          >
            {isOAuthLoading ? (
              <span
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '2px solid var(--ink)',
                  borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            ) : (
              <>
                <GithubIcon style={{ width: 16, height: 16 }} />
                <span>Continue with GitHub</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              margin: '20px 0 16px',
            }}
          >
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            <span
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 700,
                color: 'var(--faint)',
              }}
            >
              Or with master password
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>
        </div>

        {/* 2. Password Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--muted)',
                marginBottom: 7,
              }}
            >
              <KeyRound style={{ width: 13, height: 13, color: 'var(--accent)' }} />
              Master Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter master password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || isOAuthLoading}
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 14px',
                  fontSize: 14,
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r)',
                  background: 'var(--bg)',
                  color: 'var(--ink)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showPassword ? (
                  <EyeOff style={{ width: 16, height: 16 }} />
                ) : (
                  <Eye style={{ width: 16, height: 16 }} />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || isOAuthLoading || !password.trim()}
            style={{
              width: '100%',
              padding: '11px 16px',
              fontSize: 13.5,
              fontWeight: 600,
              borderRadius: 'var(--r)',
              border: 'none',
              background: 'var(--accent)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: isLoading || isOAuthLoading || !password.trim() ? 'not-allowed' : 'pointer',
              opacity: isLoading || isOAuthLoading || !password.trim() ? 0.6 : 1,
              transition: 'opacity 0.15s ease',
              boxShadow: 'var(--shadow-sm)',
              marginTop: 4,
            }}
          >
            {isLoading ? (
              <span
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '2px solid #ffffff',
                  borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            ) : (
              <>
                <span>Enter Dashboard</span>
                <LogIn style={{ width: 15, height: 15 }} />
              </>
            )}
          </button>

          {error && (
            <div
              style={{
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 'var(--r)',
                border: '1px solid #ef444433',
                background: '#ef444415',
                color: '#ef4444',
                fontSize: 12.5,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                wordBreak: 'break-word',
              }}
            >
              <ShieldAlert style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* Redirecting Overlay after OAuth success */}
        {isRedirecting && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 14,
              background: 'var(--surface)',
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: 24,
              textAlign: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'var(--accent-tint)',
                border: '1px solid var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: '2px solid var(--accent)',
                  borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                Authentication Successful!
              </h3>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Connecting to FollowMe Dashboard...
              </p>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: 'var(--muted)',
            background: 'var(--bg)',
          }}
        >
          Loading Access Control...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
