'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert, LogIn, KeyRound } from 'lucide-react';

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

function LoginContent() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(urlError);
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const router = useRouter();

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
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'var(--ink)',
              color: 'var(--bg)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 20,
              letterSpacing: '-0.03em',
              marginBottom: 16,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            F
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
            <input
              type="password"
              placeholder="Enter master password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading || isOAuthLoading}
              required
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
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
