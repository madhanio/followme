'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ShieldAlert, LogIn, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

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
      }
    } catch (err: any) {
      setError('Connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#060608] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Red & Dark Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-red-600/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-red-900/15 blur-[120px] pointer-events-none" />

      {/* Masonry Background Decor Cards */}
      <div className="absolute inset-0 opacity-20 pointer-events-none grid grid-cols-2 md:grid-cols-4 gap-4 p-8 overflow-hidden scale-105 rotate-1">
        <div className="space-y-4">
          <div className="h-40 rounded-2xl bg-gradient-to-b from-red-950/40 to-zinc-900/40 border border-red-500/20" />
          <div className="h-64 rounded-2xl bg-zinc-900/30 border border-zinc-800/40" />
          <div className="h-48 rounded-2xl bg-zinc-900/40 border border-red-900/20" />
        </div>
        <div className="space-y-4 pt-12">
          <div className="h-56 rounded-2xl bg-zinc-900/40 border border-zinc-800/40" />
          <div className="h-44 rounded-2xl bg-gradient-to-b from-red-900/30 to-zinc-900/40 border border-red-500/30" />
          <div className="h-52 rounded-2xl bg-zinc-900/30 border border-zinc-800/30" />
        </div>
        <div className="space-y-4 hidden md:block">
          <div className="h-48 rounded-2xl bg-gradient-to-b from-red-900/30 to-zinc-900/30 border border-red-500/20" />
          <div className="h-52 rounded-2xl bg-zinc-900/40 border border-zinc-800/40" />
          <div className="h-44 rounded-2xl bg-zinc-900/30 border border-red-900/30" />
        </div>
        <div className="space-y-4 pt-8 hidden md:block">
          <div className="h-60 rounded-2xl bg-zinc-900/30 border border-zinc-800/30" />
          <div className="h-40 rounded-2xl bg-gradient-to-b from-red-950/40 to-zinc-900/40 border border-red-500/20" />
          <div className="h-56 rounded-2xl bg-zinc-900/40 border border-zinc-800/40" />
        </div>
      </div>

      {/* Main Access Control Masonry Card */}
      <div className="w-full max-w-md bg-[#0e0e11]/90 border border-red-500/20 rounded-3xl p-8 backdrop-blur-xl shadow-2xl shadow-red-950/20 relative z-10 transition-all">
        {/* Top Header Badge */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 shadow-lg shadow-red-500/10">
            <Lock className="h-7 w-7 text-red-500" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight font-jakarta">Access Control</h1>
          <p className="text-xs text-zinc-400 mt-1 font-mono tracking-wide">
            FollowMe Gateway • Enter Security Key
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] uppercase font-mono tracking-widest text-zinc-400 mb-2 flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-red-500" /> Security Key
            </label>
            <input
              type="password"
              placeholder="Enter access key..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#07070a] border border-zinc-800 focus:border-red-500/60 focus:ring-1 focus:ring-red-500/60 rounded-xl py-3.5 px-4 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all font-mono"
              disabled={isLoading}
              required
              autoFocus
            />
          </div>

          {/* Expanded Enter Action Button */}
          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/30 cursor-pointer font-sans text-sm tracking-wide"
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
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2.5 text-xs text-red-400 font-mono animate-shake">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
