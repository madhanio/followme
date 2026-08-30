'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, ShieldAlert, LogIn, KeyRound } from 'lucide-react';

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

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

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

    // Monitor popup close (e.g. user cancelled or closed dialog)
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
    } catch (err: any) {
      setError('Connection failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f9fa] dark:bg-[#0a0a0c] text-[#1a1c1c] dark:text-[#f0f0f0] flex items-center justify-center p-4 relative overflow-hidden font-sans select-none transition-colors duration-300">
      {/* Red & Soft Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-red-500/5 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-red-500/5 blur-[120px] pointer-events-none" />

      {/* Masonry Background Decor Cards */}
      <div className="absolute inset-0 opacity-15 dark:opacity-10 pointer-events-none grid grid-cols-2 md:grid-cols-4 gap-4 p-8 overflow-hidden scale-105 rotate-1">
        <div className="space-y-4">
          <div className="h-40 rounded-2xl bg-gradient-to-b from-red-100 dark:from-red-950/30 to-zinc-100 dark:to-zinc-900 border border-red-200 dark:border-red-900/30" />
          <div className="h-64 rounded-2xl bg-zinc-100/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800" />
          <div className="h-48 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/50 border border-red-100 dark:border-red-900/20" />
        </div>
        <div className="space-y-4 pt-12">
          <div className="h-56 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800" />
          <div className="h-44 rounded-2xl bg-gradient-to-b from-red-100 dark:from-red-950/30 to-zinc-100 dark:to-zinc-900 border border-red-200 dark:border-red-900/30" />
          <div className="h-52 rounded-2xl bg-zinc-100/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800" />
        </div>
        <div className="space-y-4 hidden md:block">
          <div className="h-48 rounded-2xl bg-gradient-to-b from-red-100 dark:from-red-950/30 to-zinc-100 dark:to-zinc-900 border border-red-200 dark:border-red-900/30" />
          <div className="h-52 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800" />
          <div className="h-44 rounded-2xl bg-zinc-100/50 dark:bg-zinc-900/40 border border-red-100 dark:border-red-900/20" />
        </div>
        <div className="space-y-4 pt-8 hidden md:block">
          <div className="h-60 rounded-2xl bg-zinc-100/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800" />
          <div className="h-40 rounded-2xl bg-gradient-to-b from-red-100 dark:from-red-950/30 to-zinc-100 dark:to-zinc-900 border border-red-200 dark:border-red-900/30" />
          <div className="h-56 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800" />
        </div>
      </div>

      {/* Main Access Control Card */}
      <div className="w-full max-w-md bg-white dark:bg-[#121215] border border-[#dadada] dark:border-[#2a2a2a] rounded-3xl p-8 shadow-xl shadow-zinc-200/50 dark:shadow-none relative z-10 transition-all">
        {/* Top Header Badge */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 shadow-sm">
            <Lock className="h-7 w-7 text-red-600" />
          </div>
          <h1 className="text-2xl font-black text-[#1a1c1c] dark:text-[#f0f0f0] tracking-tight font-jakarta">Access Control</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-mono tracking-wide">
            FollowMe Gateway • Sign in or Onboard
          </p>
        </div>

        {/* 1. GitHub OAuth Login / Onboarding Button */}
        <div className="space-y-4 mb-6">
          <button
            type="button"
            onClick={handleGitHubOAuth}
            disabled={isOAuthLoading || isLoading}
            className="w-full bg-[#24292e] hover:bg-[#1b1f23] dark:bg-[#1f2328] dark:hover:bg-[#2d333b] text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-sm cursor-pointer font-sans text-sm tracking-wide disabled:opacity-60 active:scale-[0.99]"
          >
            {isOAuthLoading ? (
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <GithubIcon className="h-4 w-4" />
                <span>Continue with GitHub</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#eeeeee] dark:border-[#2a2a2a]"></div>
            <span className="flex-shrink mx-3 text-[10px] uppercase font-mono font-bold tracking-widest text-zinc-400 dark:text-zinc-600">OR WITH PASSWORD</span>
            <div className="flex-grow border-t border-[#eeeeee] dark:border-[#2a2a2a]"></div>
          </div>
        </div>

        {/* 2. Password Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] uppercase font-mono tracking-widest text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-red-600" /> Master Password
            </label>
            <input
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-50/50 dark:bg-[#18181c] border border-[#dadada] dark:border-[#2a2a2a] focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl py-3.5 px-4 text-sm text-[#1a1c1c] dark:text-[#f0f0f0] placeholder-zinc-400 outline-none transition-all font-mono"
              disabled={isLoading || isOAuthLoading}
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || isOAuthLoading || !password.trim()}
            className="w-full bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-red-600/10 cursor-pointer font-sans text-sm tracking-wide"
          >
            {isLoading ? (
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span>Enter Dashboard</span>
                <LogIn className="h-4 w-4" />
              </>
            )}
          </button>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2.5 text-xs text-red-600 font-mono animate-shake">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
              <span className="break-all">{error}</span>
            </div>
          )}
        </form>

        {/* Redirecting Overlay after OAuth success */}
        {isRedirecting && (
          <div className="absolute inset-0 bg-white/95 dark:bg-[#121215]/95 rounded-3xl z-30 flex flex-col items-center justify-center space-y-3.5 p-6 text-center backdrop-blur-xs animate-in fade-in duration-200">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <span className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-emerald-500 border-t-transparent" />
            </div>
            <div>
              <h3 className="font-bold text-sm font-jakarta text-[#1a1c1c] dark:text-[#f0f0f0]">Authentication Successful!</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-1">Connecting to FollowMe Dashboard...</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8f9fa] dark:bg-[#0a0a0c] flex items-center justify-center text-xs font-mono text-zinc-400">Loading Access Control...</div>}>
      <LoginContent />
    </Suspense>
  );
}

