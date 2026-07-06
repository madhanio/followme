'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ArrowRight, ShieldAlert } from 'lucide-react';

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
    <main className="min-h-screen bg-[#070708] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Ambient backgrounds */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 w-[350px] h-[350px] rounded-full bg-sky-500/5 blur-[100px] pointer-events-none" />

      {/* Login Card */}
      <div className="w-full max-w-md bg-[#0b0b0d]/80 border border-zinc-900 rounded-2xl p-8 backdrop-blur-md shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-center mb-4">
            <Lock className="h-5 w-5 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Access Control</h1>
          <p className="text-xs text-zinc-500 mt-1 font-mono">FollowMe Dashboard Gateway</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-mono tracking-widest text-zinc-500 mb-2">
              Security Key
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#050506] border border-zinc-900 focus:border-emerald-500/40 rounded-lg py-2.5 pl-3.5 pr-10 text-sm text-zinc-200 placeholder-zinc-700 outline-none transition-all font-mono"
                disabled={isLoading}
                required
                autoFocus
              />
              <button
                type="submit"
                disabled={isLoading}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md bg-zinc-900 border border-zinc-850 hover:bg-emerald-500/10 hover:border-emerald-500/30 flex items-center justify-center text-zinc-400 hover:text-emerald-400 transition-all cursor-pointer"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 flex items-center gap-2.5 text-xs text-red-400 font-mono">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
