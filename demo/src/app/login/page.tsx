'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, LogIn, KeyRound, Sparkles, CheckCircle2 } from 'lucide-react';

export default function DemoLoginPage() {
  const [password, setPassword] = useState('demo1234');
  const [username, setUsername] = useState('Admin');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      router.push('/');
    }, 300);
  };

  return (
    <main className="min-h-screen bg-[#f8f9fa] dark:bg-[#0a0a0c] text-[#1a1c1c] dark:text-[#f0f0f0] flex items-center justify-center p-4 relative overflow-hidden font-sans select-none transition-colors duration-300">
      {/* Background Decor */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-500/5 blur-[140px] pointer-events-none" />
      
      {/* Demo Main Login Card */}
      <div className="w-full max-w-md bg-white dark:bg-[#121215] border border-[#dadada] dark:border-[#2a2a2a] rounded-3xl p-8 shadow-xl relative z-10 space-y-6">
        
        {/* Demo Mode Notice Badge */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center gap-3 text-amber-700 dark:text-amber-300 text-xs">
          <Sparkles className="h-5 w-5 shrink-0 text-amber-500 animate-pulse" />
          <div>
            <span className="font-bold block uppercase tracking-wider text-[10px] text-amber-500">Public Demo Access</span>
            <span>No password required! Click <strong>Enter Dashboard</strong> with any password or empty fields.</span>
          </div>
        </div>

        {/* Top Header */}
        <div className="flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-[#e60023]/10 border border-[#e60023]/20 flex items-center justify-center mb-3 shadow-sm">
            <Lock className="h-7 w-7 text-[#e60023]" />
          </div>
          <h1 className="text-2xl font-black text-[#1a1c1c] dark:text-[#f0f0f0] tracking-tight font-jakarta">FollowMe Demo Login</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-mono tracking-wide">
            Interactive Preview Gateway • User: Admin
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] uppercase font-mono tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-50/50 dark:bg-[#18181c] border border-[#dadada] dark:border-[#2a2a2a] focus:border-[#e60023] focus:ring-1 focus:ring-[#e60023] rounded-xl py-3 px-4 text-sm text-[#1a1c1c] dark:text-[#f0f0f0] outline-none font-mono"
              placeholder="Admin"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase font-mono tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-[#e60023]" /> Password (Optional in Demo)
            </label>
            <input
              type="password"
              placeholder="Any password or empty..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-50/50 dark:bg-[#18181c] border border-[#dadada] dark:border-[#2a2a2a] focus:border-[#e60023] focus:ring-1 focus:ring-[#e60023] rounded-xl py-3 px-4 text-sm text-[#1a1c1c] dark:text-[#f0f0f0] outline-none font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#e60023] hover:bg-[#c0001b] text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer font-sans text-sm tracking-wide active:scale-95"
          >
            {isLoading ? (
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span>Enter Demo Dashboard</span>
                <LogIn className="h-4 w-4" />
              </>
            )}
          </button>

          <div className="text-center pt-2">
            <span className="text-[11px] text-zinc-400 font-mono flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Instant Access Enabled
            </span>
          </div>
        </form>
      </div>
    </main>
  );
}
