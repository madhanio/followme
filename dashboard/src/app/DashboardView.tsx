'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import mainCharacter from '../../public/animations/main_character.json';
import { supabase } from '@/lib/supabase';
import { triggerWorker } from './actions';
import { 
  Search, 
  Filter, 
  Play, 
  RotateCw, 
  Star, 
  UserPlus, 
  Terminal, 
  BookOpen, 
  CheckCircle, 
  XCircle,
  ExternalLink,
  Code,
  ShieldAlert,
  ArrowUpDown,
  CornerDownRight,
  TrendingUp,
  UserMinus,
  AlertTriangle
} from 'lucide-react';

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

const cleanSnippet = (text: string) => {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').trim();
};

// Numeric CountUp animation component
function AnimatedCounter({ value, duration = 500, active = true }: { value: number; duration?: number; active?: boolean }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!active) {
      setDisplayValue(value);
      return;
    }

    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setDisplayValue(Math.floor(progress * value));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [value, duration, active]);

  return <span>{displayValue}</span>;
}

// Decimal CountUp animation component
function AnimatedDecimalCounter({ value, duration = 500, active = true }: { value: number; duration?: number; active?: boolean }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!active) {
      setDisplayValue(value);
      return;
    }

    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setDisplayValue(progress * value);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [value, duration, active]);

  return <span>{displayValue.toFixed(1)}</span>;
}

interface Repo {
  id: number;
  github_url: string;
  owner: string;
  name: string;
  stars: number;
  language: string;
  topics: string[];
  readme_snippet: string;
  grade: number;
  graded_at: string;
  followed?: boolean;
  starred?: boolean;
  followed_at?: string;
  follow_back?: boolean;
  unfollowed?: boolean;
  follow_skipped?: boolean;
  follow_skip_reason?: string;
}

interface Log {
  id: number;
  action: string;
  repo_id: number | null;
  timestamp: string;
  status: string;
  message: string;
}

interface DashboardViewProps {
  initialRepos: Repo[];
  initialLogs: Log[];
}

export default function DashboardView({ initialRepos, initialLogs }: DashboardViewProps) {
  const router = useRouter();

  // Local synced state for live queries
  const [repos, setRepos] = useState<Repo[]>(initialRepos);
  const [logs, setLogs] = useState<Log[]>(initialLogs);

  // Sync state if initialProps change
  useEffect(() => {
    setRepos(initialRepos);
  }, [initialRepos]);

  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);
  
  // Interactive filters
  const [searchTerm, setSearchTerm] = useState('');
  const [minGrade, setMinGrade] = useState<number>(0);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [followedFilter, setFollowedFilter] = useState<'All' | 'Yes' | 'No' | 'Unfollowed' | 'Skipped'>('All');
  const [starredFilter, setStarredFilter] = useState<'All' | 'Yes' | 'No'>('All');
  const [activeTab, setActiveTab] = useState<'repos' | 'logs'>('repos');
  const [sortBy, setSortBy] = useState<'date' | 'grade' | 'stars'>('date');

  // Animation States
  const [isFirstMount, setIsFirstMount] = useState(true);

  // Refreshing State
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Triggering State
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerStatus, setTriggerStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Selected Repo Modal
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);

  useEffect(() => {
    // End first mount phase after all startup animations complete (1.2 seconds)
    const timer = setTimeout(() => {
      setIsFirstMount(false);
    }, 1250);
    return () => clearTimeout(timer);
  }, []);

  // Derive unique languages
  const languages = useMemo(() => {
    const list = new Set<string>();
    repos.forEach(r => {
      if (r.language) list.add(r.language);
    });
    return ['All', ...Array.from(list)];
  }, [repos]);

  // Statistics and owner profile resolution
  const ownerFollowStatus = useMemo(() => {
    const statusMap = new Map<string, { followed: boolean; unfollowed: boolean; follow_skipped: boolean; follow_back: boolean; reason: string | null }>();
    
    // Sort ascending by graded_at so that later records correctly override earlier states
    const sorted = [...repos].sort((a, b) => new Date(a.graded_at || 0).getTime() - new Date(b.graded_at || 0).getTime());
    
    sorted.forEach(repo => {
      statusMap.set(repo.owner.toLowerCase(), {
        followed: !!repo.followed,
        unfollowed: !!repo.unfollowed,
        follow_skipped: !!repo.follow_skipped,
        follow_back: !!repo.follow_back,
        reason: repo.follow_skip_reason || null
      });
    });
    return statusMap;
  }, [repos]);

  const stats = useMemo(() => {
    const total = repos.length;
    const starred = repos.filter(r => r.starred).length;
    
    let followed = 0;
    let unfollowed = 0;
    let skipped = 0;
    let mutuals = 0;

    ownerFollowStatus.forEach((status) => {
      if (status.followed) followed++;
      if (status.unfollowed) unfollowed++;
      if (status.follow_skipped) skipped++;
      if (status.follow_back) mutuals++;
    });

    const totalGrade = repos.reduce((acc, r) => acc + (r.grade || 0), 0);
    const avgGrade = total > 0 ? (totalGrade / total) : 0;

    return { total, starred, followed, unfollowed, skipped, avgGrade, mutuals };
  }, [repos, ownerFollowStatus]);

  // Apply filters and sorting
  const filteredRepos = useMemo(() => {
    return repos
      .filter(repo => {
        const matchesSearch = 
          `${repo.owner}/${repo.name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (repo.topics && repo.topics.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));
        
        const matchesGrade = repo.grade >= minGrade;
        
        const matchesLang = selectedLanguage === 'All' || repo.language === selectedLanguage;
        
        const ownerStatus = ownerFollowStatus.get(repo.owner.toLowerCase());
        const isFollowed = ownerStatus ? ownerStatus.followed : false;
        const isUnfollowed = ownerStatus ? ownerStatus.unfollowed : false;
        const isSkipped = ownerStatus ? ownerStatus.follow_skipped : false;

        const matchesFollow = 
          followedFilter === 'All' || 
          (followedFilter === 'Yes' && isFollowed) || 
          (followedFilter === 'No' && !isFollowed && !isUnfollowed && !isSkipped) ||
          (followedFilter === 'Unfollowed' && isUnfollowed) ||
          (followedFilter === 'Skipped' && isSkipped);

        const matchesStar = 
          starredFilter === 'All' || 
          (starredFilter === 'Yes' && repo.starred) || 
          (starredFilter === 'No' && !repo.starred);

        return matchesSearch && matchesGrade && matchesLang && matchesFollow && matchesStar;
      })
      .sort((a, b) => {
        if (sortBy === 'grade') return b.grade - a.grade;
        if (sortBy === 'stars') return b.stars - a.stars;
        return new Date(b.graded_at || 0).getTime() - new Date(a.graded_at || 0).getTime();
      });
  }, [repos, searchTerm, minGrade, selectedLanguage, followedFilter, starredFilter, sortBy, ownerFollowStatus]);

  // Group filtered repos by unique owner for Profile Card view
  const filteredProfiles = useMemo(() => {
    if (followedFilter === 'All') return [];

    const profilesMap = new Map<string, {
      owner: string;
      reposCount: number;
      avgGrade: number;
      totalGrade: number;
      isStarred: boolean;
      followStatus: { followed: boolean; unfollowed: boolean; follow_skipped: boolean; follow_back: boolean; reason: string | null };
    }>();

    filteredRepos.forEach(repo => {
      const ownerLower = repo.owner.toLowerCase();
      const existing = profilesMap.get(ownerLower);
      const ownerStatus = ownerFollowStatus.get(ownerLower) || {
        followed: !!repo.followed,
        unfollowed: !!repo.unfollowed,
        follow_skipped: !!repo.follow_skipped,
        follow_back: !!repo.follow_back,
        reason: repo.follow_skip_reason || null
      };

      if (!existing) {
        profilesMap.set(ownerLower, {
          owner: repo.owner,
          reposCount: 1,
          totalGrade: repo.grade || 0,
          avgGrade: repo.grade || 0,
          isStarred: !!repo.starred,
          followStatus: ownerStatus,
        });
      } else {
        existing.reposCount += 1;
        existing.totalGrade += (repo.grade || 0);
        existing.avgGrade = existing.totalGrade / existing.reposCount;
        if (repo.starred) {
          existing.isStarred = true;
        }
      }
    });

    return Array.from(profilesMap.values());
  }, [filteredRepos, followedFilter, ownerFollowStatus]);

  // Handle reload action with direct async fetches
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const [reposRes, logsRes] = await Promise.all([
        supabase.from('repos').select('*'),
        supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(50)
      ]);
      if (reposRes.data) {
        setRepos(reposRes.data);
      }
      if (logsRes.data) {
        setLogs(logsRes.data);
      }
      router.refresh();
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle run trigger
  const handleTrigger = async () => {
    if (isTriggering) return;
    setIsTriggering(true);
    setTriggerStatus(null);

    const result = await triggerWorker();
    
    setIsTriggering(false);
    setTriggerStatus({ success: result.success, message: result.success ? result.message : result.error });

    if (result.success) {
      // Trigger a direct refetch so the logs data updates immediately
      setIsRefreshing(true);
      try {
        const [reposRes, logsRes] = await Promise.all([
          supabase.from('repos').select('*'),
          supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(50)
        ]);
        if (reposRes.data) setRepos(reposRes.data);
        if (logsRes.data) setLogs(logsRes.data);
        router.refresh();
      } catch (err) {
        console.error("Post-trigger refresh failed:", err);
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  // Grade color ramp (green -> sky -> yellow -> red)
  const getGradeColor = (grade: number) => {
    if (grade >= 8) return 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/60';
    if (grade >= 6) return 'bg-sky-950/20 text-sky-400 border border-sky-900/60';
    if (grade >= 4) return 'bg-amber-950/20 text-amber-500 border border-amber-900/60';
    return 'bg-rose-950/20 text-rose-500 border border-rose-900/60';
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#070708] text-slate-100 font-sans selection:bg-zinc-800 selection:text-zinc-100 antialiased">
      {/* Startup Animation Keyframe Blocks */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-startup-logo {
          animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-startup-stat {
          opacity: 0;
          animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-startup-card {
          opacity: 0;
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Top Banner Details */}
      <header className="border-b border-zinc-900 bg-[#0c0c0e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className={`flex items-center space-x-3.5 ${isFirstMount ? 'animate-startup-logo' : ''}`}>
            <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-inner">
              <GithubIcon className="h-5 w-5 text-zinc-300" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                FollowMe <span className="text-[10px] tracking-widest uppercase font-mono px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded">Beta</span>
              </h1>
              <p className="text-xs text-zinc-500 font-mono">Automated discovery & active peer evaluation</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-zinc-400 hover:text-white rounded-lg border border-zinc-800 bg-[#0f0f11] hover:bg-zinc-900 transition-all cursor-pointer flex items-center justify-center disabled:opacity-50"
              title="Refresh Dashboard Data"
            >
              <RotateCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-white' : ''}`} />
            </button>
            <button
              onClick={handleTrigger}
              disabled={isTriggering}
              className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-mono text-xs tracking-wider uppercase transition-all duration-200 border cursor-pointer w-full sm:w-auto ${
                isTriggering 
                  ? 'bg-zinc-950 text-zinc-650 border-zinc-900 cursor-not-allowed'
                  : 'bg-white hover:bg-zinc-200 text-black border-transparent hover:scale-[1.01]'
              }`}
            >
              {isTriggering ? (
                <>
                  <RotateCw className="h-3 w-3 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 fill-black text-black" />
                  <span>Run Evaluation Job</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Action Status Message */}
      {triggerStatus && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className={`p-4 rounded-lg border flex items-center justify-between font-mono text-xs ${
            triggerStatus.success 
              ? 'bg-emerald-950/20 border-emerald-900/60 text-emerald-400'
              : 'bg-rose-950/20 border-rose-900/60 text-rose-400'
          }`}>
            <div className="flex items-center space-x-2.5">
              {triggerStatus.success ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-rose-500" />}
              <span>{triggerStatus.message}</span>
            </div>
            <button 
              onClick={() => setTriggerStatus(null)}
              className="text-[10px] hover:text-white px-2 py-0.5 rounded border border-transparent hover:border-zinc-800 transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Stats Row Strip */}
      <section className="bg-[#0b0b0d] border-b border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-5">
            
            {/* Stat Card 1 */}
            <div 
              className={`border-l border-zinc-800 pl-4 py-1 ${isFirstMount ? 'animate-startup-stat' : ''}`}
              style={isFirstMount ? { animationDelay: '150ms' } : {}}
            >
              <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500 block">Total Graded</span>
              <span className="text-xl font-bold text-white tracking-tight">
                {isRefreshing ? (
                  <span className="h-5 w-10 bg-zinc-850 rounded animate-pulse inline-block mt-1"></span>
                ) : (
                  <AnimatedCounter value={stats.total} active={isFirstMount} />
                )}
              </span>
            </div>

            {/* Stat Card 2 */}
            <div 
              className={`border-l border-zinc-800 pl-4 py-1 ${isFirstMount ? 'animate-startup-stat' : ''}`}
              style={isFirstMount ? { animationDelay: '210ms' } : {}}
            >
              <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500 block">Avg Quality</span>
              <span className="text-xl font-bold text-white tracking-tight flex items-baseline">
                {isRefreshing ? (
                  <span className="h-5 w-12 bg-zinc-850 rounded animate-pulse inline-block mt-1"></span>
                ) : (
                  <>
                    <AnimatedDecimalCounter value={stats.avgGrade} active={isFirstMount} />
                    <span className="text-xs text-zinc-650 ml-1">/ 10</span>
                  </>
                )}
              </span>
            </div>

            {/* Stat Card 3 */}
            <div 
              className={`border-l border-zinc-800 pl-4 py-1 ${isFirstMount ? 'animate-startup-stat' : ''}`}
              style={isFirstMount ? { animationDelay: '270ms' } : {}}
            >
              <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-550 block">Starred</span>
              <span className="text-xl font-bold text-amber-450 flex items-center gap-1.5">
                {isRefreshing ? (
                  <span className="h-5 w-8 bg-zinc-850 rounded animate-pulse inline-block mt-1"></span>
                ) : (
                  <>
                    <AnimatedCounter value={stats.starred} active={isFirstMount} />
                    <Star className="h-3.5 w-3.5 fill-amber-400/20 text-amber-455" />
                  </>
                )}
              </span>
            </div>

            {/* Stat Card 4 */}
            <div 
              className={`border-l border-zinc-800 pl-4 py-1 ${isFirstMount ? 'animate-startup-stat' : ''}`}
              style={isFirstMount ? { animationDelay: '330ms' } : {}}
            >
              <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500 block">Followed</span>
              <span className="text-xl font-bold text-teal-400 flex items-center gap-1.5">
                {isRefreshing ? (
                  <span className="h-5 w-8 bg-zinc-850 rounded animate-pulse inline-block mt-1"></span>
                ) : (
                  <>
                    <AnimatedCounter value={stats.followed} active={isFirstMount} />
                    <UserPlus className="h-3.5 w-3.5 text-teal-405" />
                  </>
                )}
              </span>
            </div>

            {/* Stat Card 5 */}
            <div 
              className={`border-l border-zinc-800 pl-4 py-1 ${isFirstMount ? 'animate-startup-stat' : ''}`}
              style={isFirstMount ? { animationDelay: '390ms' } : {}}
            >
              <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500 block">Mutuals</span>
              <span className="text-xl font-bold text-indigo-400 flex items-center gap-1.5">
                {isRefreshing ? (
                  <span className="h-5 w-8 bg-zinc-850 rounded animate-pulse inline-block mt-1"></span>
                ) : (
                  <>
                    <AnimatedCounter value={stats.mutuals} active={isFirstMount} />
                    <CheckCircle className="h-3.5 w-3.5 text-indigo-405" />
                  </>
                )}
              </span>
            </div>

            {/* Stat Card 6 */}
            <div 
              className={`border-l border-zinc-800 pl-4 py-1 ${isFirstMount ? 'animate-startup-stat' : ''}`}
              style={isFirstMount ? { animationDelay: '450ms' } : {}}
            >
              <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500 block">Unfollowed</span>
              <span className="text-xl font-bold text-zinc-400 flex items-center gap-1.5">
                {isRefreshing ? (
                  <span className="h-5 w-8 bg-zinc-850 rounded animate-pulse inline-block mt-1"></span>
                ) : (
                  <>
                    <AnimatedCounter value={stats.unfollowed} active={isFirstMount} />
                    <UserMinus className="h-3.5 w-3.5 text-zinc-405" />
                  </>
                )}
              </span>
            </div>

            {/* Stat Card 7 */}
            <div 
              className={`border-l border-zinc-800 pl-4 py-1 ${isFirstMount ? 'animate-startup-stat' : ''}`}
              style={isFirstMount ? { animationDelay: '510ms' } : {}}
            >
              <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500 block">Skipped</span>
              <span className="text-xl font-bold text-amber-500/80 flex items-center gap-1.5">
                {isRefreshing ? (
                  <span className="h-5 w-8 bg-zinc-850 rounded animate-pulse inline-block mt-1"></span>
                ) : (
                  <>
                    <AnimatedCounter value={stats.skipped} active={isFirstMount} />
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500/85" />
                  </>
                )}
              </span>
            </div>

          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col space-y-6">
        <div className="flex border-b border-zinc-900">
          <button
            onClick={() => setActiveTab('repos')}
            className={`px-5 py-3 font-mono text-xs uppercase tracking-wider transition-all border-b-2 flex items-center space-x-2 cursor-pointer ${
              activeTab === 'repos' 
                ? 'border-white text-white' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <GithubIcon className="h-3.5 w-3.5" />
            <span>Target Profiles ({filteredRepos.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-5 py-3 font-mono text-xs uppercase tracking-wider transition-all border-b-2 flex items-center space-x-2 cursor-pointer ${
              activeTab === 'logs' 
                ? 'border-white text-white' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Worker Logs ({initialLogs.length})</span>
          </button>
        </div>

        {activeTab === 'repos' ? (
          <div className="space-y-6">
            
            {/* Horizontal Filter Bar */}
            <div className="bg-[#0b0b0d] border border-zinc-900 rounded-xl p-4 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                
                {/* Search Input */}
                <div className="relative w-full md:max-w-xs">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search query, name, topic..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#070708] border border-zinc-800 rounded-lg py-2 pl-9 pr-4 text-xs font-mono text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition"
                  />
                </div>

                {/* Filter Actions */}
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                  
                  {/* Language Selector */}
                  <div className="flex items-center space-x-2 bg-[#070708] border border-zinc-850 px-3 py-1.5 rounded-lg">
                    <span className="text-zinc-500">Language:</span>
                    <select
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="bg-transparent text-zinc-300 focus:outline-none cursor-pointer"
                    >
                      {languages.map((lang) => (
                        <option key={lang} value={lang} className="bg-[#0c0c0e]">{lang}</option>
                      ))}
                    </select>
                  </div>

                  {/* Quality Filter */}
                  <div className="flex items-center space-x-2 bg-[#070708] border border-zinc-850 px-3 py-1.5 rounded-lg">
                    <span className="text-zinc-500">Min Grade:</span>
                    <select
                      value={minGrade}
                      onChange={(e) => setMinGrade(Number(e.target.value))}
                      className="bg-transparent text-zinc-300 focus:outline-none cursor-pointer"
                    >
                      {[0, 4, 5, 6, 7, 8, 9].map((g) => (
                        <option key={g} value={g} className="bg-[#0c0c0e]">{g || 'Any'}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sort Filter */}
                  <div className="flex items-center space-x-2 bg-[#070708] border border-zinc-850 px-3 py-1.5 rounded-lg">
                    <span className="text-zinc-500">Sort By:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-transparent text-zinc-300 focus:outline-none cursor-pointer"
                    >
                      <option value="date" className="bg-[#0c0c0e]">Graded Date</option>
                      <option value="grade" className="bg-[#0c0c0e]">Quality Score</option>
                      <option value="stars" className="bg-[#0c0c0e]">Stars Count</option>
                    </select>
                  </div>

                  {/* Reset All Link */}
                  {(searchTerm || minGrade > 0 || selectedLanguage !== 'All' || followedFilter !== 'All' || starredFilter !== 'All') && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setMinGrade(0);
                        setSelectedLanguage('All');
                        setFollowedFilter('All');
                        setStarredFilter('All');
                        setSortBy('date');
                      }}
                      className="text-[10px] text-zinc-400 hover:text-white underline cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Pills Selectors */}
              <div className="flex flex-wrap items-center gap-6 pt-3 border-t border-zinc-900 text-xs font-mono">
                
                {/* Follow Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-550 mr-1">Profile Follow Status:</span>
                  {(['All', 'Yes', 'No', 'Unfollowed', 'Skipped'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setFollowedFilter(opt)}
                      className={`px-2.5 py-1 rounded-md text-[10px] border tracking-wider transition cursor-pointer ${
                        followedFilter === opt
                          ? 'bg-zinc-100 border-transparent text-black font-semibold'
                          : 'bg-transparent border-zinc-855 hover:border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {opt === 'Yes' ? 'Followed' : opt === 'No' ? 'Pending' : opt}
                    </button>
                  ))}
                </div>

                {/* Starred Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-550 mr-1">Starred Status:</span>
                  {(['All', 'Yes', 'No'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setStarredFilter(opt)}
                      className={`px-2.5 py-1 rounded-md text-[10px] border tracking-wider transition cursor-pointer ${
                        starredFilter === opt
                          ? 'bg-zinc-100 border-transparent text-black font-semibold'
                          : 'bg-transparent border-zinc-850 hover:border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {opt === 'Yes' ? 'Starred' : opt === 'No' ? 'Not Starred' : opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Repos Cards List */}
            {isRefreshing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="bg-[#0b0b0d] border border-zinc-900 rounded-xl p-5 flex flex-col justify-between h-[230px] animate-pulse">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-2 w-2/3">
                          <div className="h-2.5 bg-zinc-800 rounded w-1/3"></div>
                          <div className="h-4 bg-zinc-850 rounded w-3/4"></div>
                        </div>
                        <div className="h-6 bg-zinc-800 rounded w-16"></div>
                      </div>
                      <div className="h-3 bg-zinc-900 rounded w-1/2 mb-4"></div>
                      <div className="space-y-2 mt-4">
                        <div className="h-3 bg-zinc-850 rounded"></div>
                        <div className="h-3 bg-zinc-850 rounded w-5/6"></div>
                      </div>
                    </div>
                    <div className="border-t border-zinc-900 pt-3.5 mt-4 flex justify-between">
                      <div className="h-4 bg-zinc-900 rounded w-24"></div>
                      <div className="h-4 bg-zinc-900 rounded w-12"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (followedFilter !== 'All' ? filteredProfiles.length === 0 : filteredRepos.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 w-full bg-[#0b0b0d] border border-zinc-900 rounded-xl">
                <div className="w-48 h-48 flex items-center justify-center">
                  <Lottie animationData={mainCharacter} loop={true} className="w-48 h-48" />
                </div>
                <p className="text-white font-semibold text-sm font-mono uppercase tracking-wider">No results found</p>
                <p className="text-zinc-550 text-xs font-mono">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {followedFilter !== 'All' ? (
                  filteredProfiles.map((profile, idx) => (
                    <div
                      key={profile.owner}
                      className={`bg-[#0b0b0d] border border-zinc-900 hover:border-zinc-800 rounded-xl p-5 transition-all flex flex-col justify-between ${isFirstMount ? 'animate-startup-card' : ''}`}
                      style={isFirstMount ? { animationDelay: `${idx * 80}ms` } : {}}
                    >
                      <div>
                        {/* Header: Avatar, Username and External Link */}
                        <div className="flex items-center space-x-3.5 mb-4">
                          <img 
                            src={`https://github.com/${profile.owner}.png`} 
                            alt={profile.owner} 
                            className="h-10 w-10 rounded-full border border-zinc-850 bg-zinc-900 object-cover" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://unavatar.io/github/${profile.owner}`;
                            }}
                          />
                          <div>
                            <a
                              href={`https://github.com/${profile.owner}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-bold text-zinc-100 hover:text-white transition flex items-center space-x-1.5"
                            >
                              <span>@{profile.owner}</span>
                              <ExternalLink className="h-3 w-3 text-zinc-500" />
                            </a>
                            <span className="text-[10px] text-zinc-500 font-mono">Developer Profile</span>
                          </div>
                        </div>

                        {/* Summary details */}
                        <div className="grid grid-cols-2 gap-3.5 bg-[#070708] border border-zinc-900/60 p-3 rounded-lg font-mono text-xs mb-4">
                          <div>
                            <span className="text-[10px] text-zinc-550 block">Graded Repos</span>
                            <span className="text-zinc-200 font-semibold">{profile.reposCount} {profile.reposCount === 1 ? 'repo' : 'repos'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-550 block">Avg Quality Score</span>
                            <span className="text-zinc-200 font-semibold flex items-baseline">
                              {profile.avgGrade.toFixed(1)}
                              <span className="text-[10px] text-zinc-650 ml-0.5">/10</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Operational tags */}
                      <div className="flex flex-wrap items-center justify-between border-t border-zinc-900 pt-3.5 mt-2 gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                          {/* Follow Status Badge */}
                          {profile.followStatus.followed && (
                            <span className="inline-flex items-center space-x-1 bg-teal-500/5 border border-teal-500/15 text-teal-400 px-2 py-0.5 rounded">
                              Followed
                            </span>
                          )}
                          {profile.followStatus.follow_back && (
                            <span className="inline-flex items-center space-x-1 bg-indigo-500/5 border border-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded font-bold">
                              Mutual Follow
                            </span>
                          )}
                          {profile.followStatus.unfollowed && (
                            <span className="inline-flex items-center space-x-1 bg-zinc-850 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                              Unfollowed
                            </span>
                          )}
                          {profile.followStatus.follow_skipped && (
                            <span 
                              className="inline-flex items-center space-x-1 bg-amber-500/5 border border-amber-500/15 text-amber-500/80 px-2 py-0.5 rounded"
                              title={profile.followStatus.reason || 'Skipped'}
                            >
                              Skipped: {profile.followStatus.reason || 'Target Check'}
                            </span>
                          )}
                          {!profile.followStatus.followed && !profile.followStatus.unfollowed && !profile.followStatus.follow_skipped && (
                            <span className="inline-flex items-center space-x-1 bg-zinc-900 border border-zinc-850 text-zinc-450 px-2 py-0.5 rounded">
                              Pending
                            </span>
                          )}

                          {/* Starred Badge */}
                          {profile.isStarred && (
                            <span className="inline-flex items-center space-x-1 bg-amber-500/5 border border-amber-500/15 text-amber-500 px-2 py-0.5 rounded">
                              <Star className="h-2.5 w-2.5 fill-amber-500/20 text-amber-500" />
                              <span>Starred Repos</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  filteredRepos.map((repo, idx) => (
                    <div
                      key={repo.id}
                      className={`bg-[#0b0b0d] border border-zinc-900 hover:border-zinc-800 rounded-xl p-5 transition-all flex flex-col justify-between ${isFirstMount ? 'animate-startup-card' : ''}`}
                      style={isFirstMount ? { animationDelay: `${idx * 80}ms` } : {}}
                    >
                      <div>
                        {/* Name, Quality and GitHub URL */}
                        <div className="flex items-start justify-between space-x-3 mb-2">
                          <div className="truncate">
                            <span className="text-[10px] text-zinc-500 font-mono block">@{repo.owner}</span>
                            <a
                              href={repo.github_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-bold text-zinc-100 hover:text-white transition flex items-center space-x-1.5 truncate"
                            >
                              <span>{repo.name}</span>
                              <ExternalLink className="h-3 w-3 text-zinc-500" />
                            </a>
                          </div>
                          <div className={`px-2.5 py-1 rounded text-xs font-mono border ${getGradeColor(repo.grade)}`}>
                            Grade {repo.grade}
                          </div>
                        </div>

                        {/* Stars and language */}
                        <div className="flex items-center space-x-3.5 text-[11px] font-mono text-zinc-505 mb-3.5">
                          <span className="flex items-center space-x-1">
                            <Star className="h-3 w-3 fill-amber-400/10 text-amber-500/80" />
                            <span>{repo.stars}</span>
                          </span>
                          {repo.language && (
                            <span className="flex items-center space-x-1">
                              <Code className="h-3 w-3 text-zinc-450" />
                              <span>{repo.language}</span>
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-650">
                            {new Date(repo.graded_at).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Snippet Description */}
                        {repo.readme_snippet && (
                          <div className="text-xs text-zinc-450 bg-[#070708] border border-zinc-900/60 p-2.5 rounded-lg font-mono line-clamp-3 leading-relaxed mb-4">
                            {cleanSnippet(repo.readme_snippet).split('\n').filter(line => line.trim() !== '')[0] || 'No readme description.'}
                          </div>
                        )}

                        {/* Topics Tags */}
                        {repo.topics && repo.topics.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {repo.topics.slice(0, 3).map((topic) => (
                              <span
                                key={topic}
                                className="text-[9px] font-mono px-2 py-0.5 bg-[#0e0e11] border border-zinc-850 text-zinc-550 rounded"
                              >
                                #{topic}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Operational Badges */}
                      <div className="flex flex-wrap items-center justify-between border-t border-zinc-900 pt-3.5 mt-2 gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                          {repo.starred ? (
                            <span className="inline-flex items-center space-x-1 bg-amber-500/5 border border-amber-500/15 text-amber-500 px-2 py-0.5 rounded">
                              Starred
                            </span>
                          ) : (
                            <span className="text-zinc-650 px-1">Unstarred</span>
                          )}
                          
                          {(() => {
                            const oStatus = ownerFollowStatus.get(repo.owner.toLowerCase());
                            if (!oStatus) return null;

                            return (
                              <>
                                {oStatus.followed && (
                                  <span className="inline-flex items-center space-x-1 bg-teal-500/5 border border-teal-500/15 text-teal-400 px-2 py-0.5 rounded">
                                    Followed
                                  </span>
                                )}

                                {oStatus.follow_back && (
                                  <span className="inline-flex items-center space-x-1 bg-indigo-500/5 border border-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded font-bold">
                                    Mutual Follow
                                  </span>
                                )}

                                {oStatus.unfollowed && (
                                  <span className="inline-flex items-center space-x-1 bg-zinc-850 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                                    Unfollowed
                                  </span>
                                )}

                                {oStatus.follow_skipped && (
                                  <span 
                                    className="inline-flex items-center space-x-1 bg-amber-500/5 border border-amber-500/15 text-amber-500/80 px-2 py-0.5 rounded"
                                    title={oStatus.reason || 'Skipped'}
                                  >
                                    Skipped: {oStatus.reason || 'Target Check'}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {repo.readme_snippet && (
                          <button
                            onClick={() => setSelectedRepo(repo)}
                            className="text-[10px] font-mono font-semibold text-zinc-300 hover:text-white transition flex items-center space-x-1 bg-[#0f0f12] border border-zinc-850 hover:border-zinc-800 px-2 py-1 rounded cursor-pointer"
                          >
                            <BookOpen className="h-3 w-3" />
                            <span>Readme</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          /* Mono activity logs */
          <div className="bg-[#0b0b0d] border border-zinc-900 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-900 bg-[#0c0c0e] flex items-center justify-between">
              <h3 className="font-mono text-xs font-semibold text-zinc-300 uppercase tracking-wider">Historical Logs</h3>
              <span className="text-[10px] font-mono text-zinc-550">Last 50 entries</span>
            </div>

            <div className="overflow-x-auto min-h-[500px]">
              <table className="w-full text-left border-collapse font-mono text-xs table-fixed">
                <thead>
                  <tr className="border-b border-zinc-900 text-zinc-550 bg-zinc-950/20 text-[10px] uppercase tracking-wider">
                    <th className="px-5 py-3 w-[220px]">Timestamp</th>
                    <th className="px-5 py-3 w-[140px]">Action</th>
                    <th className="px-5 py-3 w-[120px]">Status</th>
                    <th className="px-5 py-3">Context & Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60">
                  {isRefreshing ? (
                    [1, 2, 3, 4, 5].map((n) => (
                      <tr key={n} className="animate-pulse">
                        <td className="px-5 py-3">
                          <div className="h-3.5 bg-zinc-850 rounded w-24"></div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="h-4 bg-zinc-900 rounded w-16"></div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="h-3.5 bg-zinc-850 rounded w-12"></div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="h-3.5 bg-zinc-900 rounded w-4/5"></div>
                        </td>
                      </tr>
                    ))
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-zinc-600">
                        No operations logged.
                      </td>
                    </tr>
                  ) : (
                    [...logs]
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((log) => (
                        <tr key={log.id} className="hover:bg-zinc-900/10 transition text-zinc-350">
                          <td className="px-5 py-3 text-zinc-550 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] border ${
                              log.action === 'SYSTEM' ? 'bg-zinc-900 border-zinc-800 text-zinc-400' :
                              log.action === 'GRADE' ? 'bg-indigo-950/40 border-indigo-900/30 text-indigo-400' :
                              log.action === 'STAR' ? 'bg-amber-950/40 border-amber-900/30 text-amber-400' :
                              log.action === 'FOLLOW' ? 'bg-teal-950/40 border-teal-900/30 text-teal-400' :
                              log.action === 'SKIP_FOLLOW' ? 'bg-amber-950/20 border-amber-900/30 text-amber-500/90' :
                              'bg-zinc-900/40 border-zinc-850 text-zinc-450'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {log.status === 'SUCCESS' ? (
                              <span className="text-emerald-500 font-bold">SUCCESS</span>
                            ) : (
                              <span className="text-rose-500 font-bold">FAILED</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-zinc-300 max-w-md truncate" title={log.message}>
                            {log.message}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Simple Footer */}
      <footer className="mt-auto border-t border-zinc-950 bg-[#060607] py-6 text-center text-[10px] font-mono text-zinc-650">
        <p>FollowMe Dashboard — Verified evaluation runs logged in real time</p>
      </footer>

      {/* Snippet Overlay Modal */}
      {selectedRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b0b0d] border border-zinc-800 w-full max-w-3xl max-h-[80vh] rounded-xl flex flex-col shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-zinc-900 bg-[#0c0c0e] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-550 font-mono uppercase tracking-wider">Readme snippet evaluation</span>
                <h3 className="font-mono text-sm font-semibold text-zinc-100 flex items-center space-x-2">
                  <span>{selectedRepo.owner}/{selectedRepo.name}</span>
                  <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 rounded">
                    Score: {selectedRepo.grade}/10
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedRepo(null)}
                className="text-zinc-550 hover:text-white font-mono text-xs px-2.5 py-1 hover:bg-zinc-900 rounded border border-zinc-850 cursor-pointer transition"
              >
                Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto font-mono text-xs text-zinc-300 bg-[#070708]/80 leading-relaxed whitespace-pre-wrap select-text flex-1">
              {cleanSnippet(selectedRepo.readme_snippet) || 'No evaluation snippet.'}
            </div>
            
            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-zinc-900 bg-[#0c0c0e] flex justify-end">
              <a
                href={selectedRepo.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-mono font-semibold rounded transition cursor-pointer"
              >
                <span>Open in Github</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
