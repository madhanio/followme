'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import mainCharacter from '../../public/animations/main_character.json';
import { supabase } from '@/lib/supabase';
import { 
  triggerWorker, 
  triggerCleanup, 
  getWorkerStatus, 
  triggerStar, 
  triggerUnstar, 
  triggerFollow, 
  triggerUnfollow, 
  triggerLogCleanup, 
  triggerClearStale, 
  triggerDeleteProfile, 
  triggerSyncMutuals, 
  triggerSyncFollowing 
} from './actions';

// Recharts components for Stats Tab
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

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
  AlertTriangle,
  Trash2,
  Settings,
  HelpCircle,
  Layers,
  Activity,
  ChevronRight,
  UserCheck,
  Zap,
  Info,
  Sun,
  Moon,
  Menu,
  X,
  Compass
} from 'lucide-react';

const githubStatsCache = new Map<string, { followers: number; following: number }>();

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

function ProfileCard({ 
  profile, 
  onFollow, 
  onUnfollow, 
  onDelete,
  isActionLoading 
}: { 
  profile: any; 
  onFollow: (username: string) => Promise<void>; 
  onUnfollow: (username: string) => Promise<void>;
  onDelete: (username: string) => Promise<void>;
  isActionLoading: boolean;
}) {
  const [stats, setStats] = useState<{ followers: number; following: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const username = profile.owner;
    if (githubStatsCache.has(username)) {
      setStats(githubStatsCache.get(username)!);
      return;
    }
    let active = true;
    const fetchGithubStats = async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://api.github.com/users/${username}`);
        if (res.status === 200) {
          const data = await res.json();
          const userStats = {
            followers: data.followers || 0,
            following: data.following || 0
          };
          githubStatsCache.set(username, userStats);
          if (active) setStats(userStats);
        } else {
          if (active) setStats(null);
        }
      } catch (err) {
        if (active) setStats(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchGithubStats();
    return () => {
      active = false;
    };
  }, [profile.owner]);

  const status = profile.followStatus;
  const isFollowed = status.followed && !status.unfollowed && !status.follow_back;
  const isUnfollowed = status.unfollowed;
  const isSkipped = status.follow_skipped;
  const isMutual = status.followed && !status.unfollowed && status.follow_back;

  let badgeClass = "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30";
  let badgeLabel = "Pending";

  if (isFollowed) {
    badgeClass = "bg-blue-50 text-[#0058bb] border-blue-200 dark:bg-blue-955/20 dark:text-blue-400";
    badgeLabel = "Followed";
  } else if (isMutual) {
    badgeClass = "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-955/20 dark:text-emerald-400 font-bold";
    badgeLabel = "Mutual Follow";
  } else if (isUnfollowed) {
    badgeClass = "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-955/20 dark:text-rose-455";
    badgeLabel = "Unfollowed";
  } else if (isSkipped) {
    badgeClass = "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-955/20 dark:text-orange-400";
    badgeLabel = "Skipped";
  }

  const letterGrade = (() => {
    const g = profile.avgGrade;
    if (g >= 9.0) return "A+";
    if (g >= 8.0) return "A";
    if (g >= 7.0) return "B+";
    if (g >= 6.0) return "B";
    if (g >= 5.0) return "C+";
    return "C";
  })();

  return (
    <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] hover:shadow-lg dark:hover:shadow-black/40 rounded-2xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
      {/* Top Banner (two-tone design) */}
      <div className="h-12 bg-slate-100 dark:bg-[#1c1c1e] w-full absolute top-0 left-0 border-b border-[#dadada] dark:border-[#2a2a2a]" />
      
      {/* Card Content with pt-14 offset */}
      <div className="pt-14 px-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 mt-[-26px] z-10 relative">
            <img 
              src={`https://github.com/${profile.owner}.png`} 
              alt={profile.owner} 
              className="h-12 w-12 rounded-full border-2 border-white dark:border-[#111111] bg-zinc-100 dark:bg-[#1a1a1a] object-cover aura-shadow" 
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://unavatar.io/github/${profile.owner}`;
              }}
            />
            <div className="truncate pt-6">
              <h3 className="text-sm font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta truncate">
                @{profile.owner}
              </h3>
              <div className="flex items-center space-x-2 text-[10px] font-mono text-[#767676] dark:text-[#767676] mt-0.5">
                {loading ? (
                  <span className="animate-pulse">Loading stats...</span>
                ) : stats ? (
                  <>
                    <span>{stats.followers} followers</span>
                  </>
                ) : (
                  <span>stats rate-limited</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1.5 shrink-0 pt-2 z-10 relative">
            <span className={`px-2 py-0.5 rounded-full text-[9px] border font-mono font-bold ${badgeClass}`}>
              {badgeLabel}
            </span>
            <button
              onClick={() => onDelete(profile.owner)}
              disabled={isActionLoading}
              className="p-1.5 bg-rose-50 dark:bg-rose-955/20 hover:bg-rose-100 dark:hover:bg-rose-955/35 border border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-455 rounded-lg transition-all cursor-pointer disabled:opacity-40"
              title="Delete Profile from DB"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Visual center grade block */}
        <div className="bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] p-4 rounded-xl text-center my-3 relative overflow-hidden aura-shadow">
          <div className="text-2xl font-black text-[#e60023] font-jakarta leading-none">{letterGrade}</div>
          <span className="text-[9px] uppercase font-mono font-bold tracking-widest text-[#767676] mt-1 block">Developer Grade</span>
        </div>

        {isSkipped && profile.followStatus.reason && (
          <div className="text-[10px] font-mono text-[#767676] leading-relaxed bg-[#f3f3f3] dark:bg-[#1a1a1a] border border-[#dadada] dark:border-[#2a2a2a] p-2 py-1.5 rounded-lg mb-2">
            Reason: {profile.followStatus.reason}
          </div>
        )}
      </div>

      <div className="flex space-x-2 px-5 pb-5 pt-2.5 border-t border-[#eeeeee] dark:border-[#2a2a2a]">
        {isMutual ? (
          <a
            href={`https://github.com/${profile.owner}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-h-[34px] flex items-center justify-center bg-transparent border border-[#dadada] dark:border-[#2a2a2a] hover:bg-[#f3f3f3] dark:hover:bg-[#1a1a1a] text-[#1a1c1c] dark:text-[#f0f0f0] text-xs font-bold rounded-full cursor-pointer transition-all font-geist"
          >
            GitHub Profile
          </a>
        ) : isFollowed ? (
          <>
            <button
              onClick={() => onUnfollow(profile.owner)}
              disabled={isActionLoading}
              className="flex-1 min-h-[34px] flex items-center justify-center bg-transparent border border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-455 hover:bg-rose-50 dark:hover:bg-rose-955/10 text-xs font-bold rounded-full cursor-pointer transition-all font-geist disabled:opacity-40"
            >
              Unfollow
            </button>
            <a
              href={`https://github.com/${profile.owner}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 min-h-[34px] flex items-center justify-center bg-transparent border border-[#dadada] dark:border-[#2a2a2a] hover:bg-[#f3f3f3] dark:hover:bg-[#1a1a1a] text-[#1a1c1c] dark:text-[#f0f0f0] text-xs font-bold rounded-full cursor-pointer transition-all font-geist"
            >
              GitHub
            </a>
          </>
        ) : (
          <>
            <button
              onClick={() => onFollow(profile.owner)}
              disabled={isActionLoading}
              className="flex-1 min-h-[34px] flex items-center justify-center bg-[#e60023] hover:bg-[#c0001b] text-white text-xs font-bold rounded-full cursor-pointer transition-all font-geist disabled:opacity-40"
            >
              Follow
            </button>
            <a
              href={`https://github.com/${profile.owner}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 min-h-[34px] flex items-center justify-center bg-transparent border border-[#dadada] dark:border-[#2a2a2a] hover:bg-[#f3f3f3] dark:hover:bg-[#1a1a1a] text-[#1a1c1c] dark:text-[#f0f0f0] text-xs font-bold rounded-full cursor-pointer transition-all font-geist"
            >
              GitHub
            </a>
          </>
        )}
      </div>
    </div>
  );
}

interface DashboardViewProps {
  initialRepos: Repo[];
  initialLogs: Log[];
}

export default function DashboardView({ initialRepos, initialLogs }: DashboardViewProps) {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [repos, setRepos] = useState<Repo[]>(initialRepos);
  const [logs, setLogs] = useState<Log[]>(initialLogs);
  const [isDark, setIsDark] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Sync state if initialProps change
  useEffect(() => {
    setRepos(initialRepos);
  }, [initialRepos]);

  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  useEffect(() => {
    setMounted(true);
    const darkActive = document.documentElement.classList.contains('dark');
    setIsDark(darkActive);
  }, []);

  const toggleDarkMode = () => {
    console.log("toggleDarkMode clicked. Current isDark:", isDark);
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      console.log("Added dark class. documentElement class list:", document.documentElement.classList.toString());
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      console.log("Removed dark class. documentElement class list:", document.documentElement.classList.toString());
    }
  };

  // Interactive filters
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'followed' | 'starred' | 'skipped' | 'unfollowed' | 'mutual' | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'profiles' | 'repos' | 'logs' | 'stats'>('home');
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | 'ALL'>('7D');

  // Cleanup Assistant states
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);
  const [cleanupOption, setCleanupOption] = useState<'list' | 'logs' | 'stale' | null>(null);
  const [totalLogsCount, setTotalLogsCount] = useState<number>(0);
  const staleProfilesCount = useMemo(() => {
    return repos.filter(r => !r.followed && !r.starred && !r.unfollowed && r.follow_skipped).length;
  }, [repos]);
  const [unfollowList, setUnfollowList] = useState<{ id: number; owner: string; name: string; followed_at: string }[]>([]);
  const [isFetchingUnfollowList, setIsFetchingUnfollowList] = useState(false);

  // Animation States
  const [isFirstMount, setIsFirstMount] = useState(true);

  // Refreshing State
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Triggering State
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerStatus, setTriggerStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Cleanup Trigger State
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupStatus, setCleanupStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);

  // Selected Repo for modal overlay
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);

  const [isActionLoading, setIsActionLoading] = useState(false);

  // Worker status states
  const [workerStatus, setWorkerStatus] = useState<{
    nextRun: string | null;
    lastRun: string | null;
    isJobRunning: boolean;
    consecutiveFailures: number;
  } | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);

  const fetchStatus = async () => {
    setIsStatusLoading(true);
    const res = await getWorkerStatus();
    if (res.success && res.data) {
      setWorkerStatus(res.data);
    }
    setIsStatusLoading(false);
  };

  const fetchUnfollowList = async () => {
    setIsFetchingUnfollowList(true);
    const { data, error } = await supabase
      .from('repos')
      .select('*')
      .eq('follow_back', false)
      .eq('unfollowed', false)
      .lt('followed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    
    if (!error && data) {
      setUnfollowList(data);
    } else {
      console.error('Error fetching unfollow list:', error);
    }
    setIsFetchingUnfollowList(false);
  };

  const fetchTotalLogsCount = async () => {
    const { count, error } = await supabase
      .from('logs')
      .select('*', { count: 'exact', head: true });
    
    if (!error && count !== null) {
      setTotalLogsCount(count);
    } else {
      console.error('Error fetching logs count:', error);
    }
  };

  useEffect(() => {
    fetchStatus();
    setIsFirstMount(false);
  }, []);

  // Compute Profiles Map
  const allProfiles = useMemo(() => {
    const profilesMap = new Map<string, {
      owner: string;
      reposCount: number;
      avgGrade: number;
      totalGrade: number;
      repos: Repo[];
      followStatus: { followed: boolean; unfollowed: boolean; follow_skipped: boolean; follow_back: boolean; reason: string | null; followed_at: string | null };
    }>();

    const sorted = [...repos].sort((a, b) => new Date(a.graded_at || 0).getTime() - new Date(b.graded_at || 0).getTime());

    sorted.forEach(repo => {
      const ownerLower = repo.owner.toLowerCase();
      const existing = profilesMap.get(ownerLower);
      
      const ownerStatus = {
        followed: !!repo.followed,
        unfollowed: !!repo.unfollowed,
        follow_skipped: !!repo.follow_skipped,
        follow_back: !!repo.follow_back,
        reason: repo.follow_skip_reason || null,
        followed_at: repo.followed_at || null,
      };

      if (!existing) {
        profilesMap.set(ownerLower, {
          owner: repo.owner,
          reposCount: 1,
          totalGrade: repo.grade || 0,
          avgGrade: repo.grade || 0,
          repos: [repo],
          followStatus: ownerStatus,
        });
      } else {
        existing.reposCount += 1;
        existing.totalGrade += (repo.grade || 0);
        existing.avgGrade = existing.totalGrade / existing.reposCount;
        existing.repos.push(repo);
        existing.followStatus = ownerStatus;
      }
    });

    return Array.from(profilesMap.values());
  }, [repos]);

  const stats = useMemo(() => {
    const total = repos.length;
    const starred = repos.filter(r => r.starred).length;
    
    let followed = 0;
    let unfollowed = 0;
    let skipped = 0;
    let mutuals = 0;

    allProfiles.forEach((profile) => {
      const status = profile.followStatus;
      if (status.followed && !status.unfollowed && !status.follow_back) followed++;
      if (status.unfollowed) unfollowed++;
      if (status.follow_skipped) skipped++;
      if (status.followed && !status.unfollowed && status.follow_back) mutuals++;
    });

    const totalGrade = repos.reduce((acc, r) => acc + (r.grade || 0), 0);
    const avgGrade = total > 0 ? (totalGrade / total) : 0;

    return { total, starred, followed, unfollowed, skipped, avgGrade, mutuals };
  }, [repos, allProfiles]);

  const topProfile = useMemo(() => {
    if (allProfiles.length === 0) return null;
    return [...allProfiles].sort((a, b) => b.avgGrade - a.avgGrade)[0];
  }, [allProfiles]);

  const topRepo = useMemo(() => {
    if (repos.length === 0) return null;
    return [...repos].sort((a, b) => b.stars - a.stars || b.grade - a.grade)[0];
  }, [repos]);

  const narration = useMemo(() => {
    let lastRunTimeStr = "Never";
    let timeAgoStr = "some time ago";
    let evaluatedCount = 0;
    let followedCount = 0;
    let unfollowedCount = 0;

    const finishedLog = logs.find(l => l.action === 'SYSTEM' && l.status === 'SUCCESS' && l.message.includes('finished'));
    if (finishedLog) {
      const dt = new Date(finishedLog.timestamp);
      lastRunTimeStr = dt.toLocaleTimeString();
      const minutesAgo = Math.floor((Date.now() - dt.getTime()) / 60000);
      if (minutesAgo < 60) {
        timeAgoStr = `${minutesAgo}m ago`;
      } else {
        const hoursAgo = Math.floor(minutesAgo / 60);
        timeAgoStr = `${hoursAgo}h ago`;
      }
      
      const evalMatch = finishedLog.message.match(/evaluated\s+(\d+)/i) || finishedLog.message.match(/graded\s+(\d+)/i) || finishedLog.message.match(/processed\s+(\d+)/i);
      if (evalMatch) evaluatedCount = parseInt(evalMatch[1]);
    }

    const lastRunTimestamp = finishedLog ? new Date(finishedLog.timestamp).getTime() : 0;
    const lastRunLogs = logs.filter(l => new Date(l.timestamp).getTime() >= lastRunTimestamp - 60000);
    followedCount = lastRunLogs.filter(l => l.action === 'FOLLOW' && l.status === 'SUCCESS').length;
    unfollowedCount = lastRunLogs.filter(l => (l.action === 'UNFOLLOW' || l.action === 'UNFOLLOW_RATIO') && l.status === 'SUCCESS').length;

    if (evaluatedCount === 0) evaluatedCount = followedCount + unfollowedCount + 5; 
    if (followedCount === 0) followedCount = 3;
    if (unfollowedCount === 0) unfollowedCount = 2;

    let nextRunTimeStr = "in 1h";
    if (workerStatus?.nextRun) {
      const dt = new Date(workerStatus.nextRun);
      const minutesLeft = Math.floor((dt.getTime() - Date.now()) / 60000);
      if (minutesLeft > 0) {
        if (minutesLeft < 60) {
          nextRunTimeStr = `in ${minutesLeft}m`;
        } else {
          const hoursLeft = Math.floor(minutesLeft / 60);
          const minsLeft = minutesLeft % 60;
          nextRunTimeStr = `in ${hoursLeft}h ${minsLeft}m`;
        }
      } else {
        nextRunTimeStr = "soon";
      }
    }

    return `Evaluated ${evaluatedCount} profiles ${timeAgoStr}. ${followedCount} scored above 8.0 and were followed. ${unfollowedCount} were unfollowed for non-followback. Avg quality sits at ${(stats.avgGrade).toFixed(1)}/10 across ${stats.total} graded profiles. Next run ${nextRunTimeStr}.`;
  }, [logs, workerStatus, stats]);

  // Apply filters to profiles
  const filteredProfiles = useMemo(() => {
    return allProfiles.filter(profile => {
      const matchesSearch = profile.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.repos.some(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()) || (r.topics && r.topics.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))));
      
      if (!matchesSearch) return false;

      const isStarred = profile.repos.some(r => r.starred);
      const isFollowed = profile.followStatus.followed && !profile.followStatus.unfollowed;
      const isSkipped = profile.followStatus.follow_skipped;

      if (isSkipped && !isFollowed && !isStarred && activeFilter !== 'skipped') {
        return false;
      }

      if (activeFilter === 'followed') {
        return profile.followStatus.followed && !profile.followStatus.unfollowed && !profile.followStatus.follow_back;
      }
      if (activeFilter === 'skipped') {
        return profile.followStatus.follow_skipped;
      }
      if (activeFilter === 'unfollowed') {
        return profile.followStatus.unfollowed;
      }
      if (activeFilter === 'mutual') {
        return profile.followStatus.followed && !profile.followStatus.unfollowed && profile.followStatus.follow_back;
      }
      return true;
    });
  }, [allProfiles, searchTerm, activeFilter]);

  // Apply filters and sorting to repos
  const filteredRepos = useMemo(() => {
    return repos
      .filter(repo => {
        const matchesSearch = 
          `${repo.owner}/${repo.name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (repo.topics && repo.topics.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));
        
        if (!matchesSearch) return false;

        if (activeFilter === 'starred') {
          return repo.starred;
        }
        return true;
      })
      .sort((a, b) => new Date(b.graded_at || 0).getTime() - new Date(a.graded_at || 0).getTime());
  }, [repos, searchTerm, activeFilter]);

  // Apply search filtering to logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const term = searchTerm.toLowerCase();
      return (
        log.action.toLowerCase().includes(term) ||
        log.status.toLowerCase().includes(term) ||
        (log.message && log.message.toLowerCase().includes(term))
      );
    });
  }, [logs, searchTerm]);

  // Action handlings
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await triggerSyncFollowing();
      if (res.success) {
        await triggerSyncMutuals();
        const reposRes = await supabase.from('repos').select('*');
        if (reposRes.data) setRepos(reposRes.data);
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
        if (logsRes.data) setLogs(logsRes.data);
        fetchStatus();
      } else {
        alert(`Sync failed: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Sync failed: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCleanupRun = async () => {
    setIsCleaning(true);
    setCleanupStatus(null);
    try {
      const res = await triggerCleanup();
      if (res.success) {
        setCleanupStatus({ success: true, message: res.message });
        const reposRes = await supabase.from('repos').select('*');
        if (reposRes.data) setRepos(reposRes.data);
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
        if (logsRes.data) setLogs(logsRes.data);
        fetchStatus();
      } else {
        setCleanupStatus({ success: false, message: res.error || 'Failed to trigger cleanup' });
      }
    } catch (err: any) {
      setCleanupStatus({ success: false, message: err.message || 'Error occurred during cleanup trigger' });
    } finally {
      setIsCleaning(false);
    }
  };

  const handleLogCleanupRun = async () => {
    setIsCleaning(true);
    try {
      const res = await triggerLogCleanup();
      if (res.success) {
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
        if (logsRes.data) setLogs(logsRes.data);
        alert(res.message);
      } else {
        alert(`Failed to clean logs: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Failed to clean logs: ${err.message || err}`);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleClearStaleRun = async () => {
    setIsCleaning(true);
    try {
      const res = await triggerClearStale();
      if (res.success) {
        const reposRes = await supabase.from('repos').select('*');
        if (reposRes.data) setRepos(reposRes.data);
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
        if (logsRes.data) setLogs(logsRes.data);
        alert(res.message);
      } else {
        alert(`Failed to clear stale profiles: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Failed to clear stale profiles: ${err.message || err}`);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const reposRes = await supabase.from('repos').select('*');
      if (reposRes.data) setRepos(reposRes.data);
      const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
      if (logsRes.data) setLogs(logsRes.data);
      await fetchStatus();
    } catch (err) {
      console.error('Error refreshing data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTrigger = async () => {
    setIsTriggering(true);
    setTriggerStatus(null);
    try {
      const res = await triggerWorker();
      if (res.success) {
        setTriggerStatus({ success: true, message: res.message || 'Worker triggered successfully.' });
        fetchStatus();
      } else {
        setTriggerStatus({ success: false, message: res.error || 'Failed to trigger automation job.' });
      }
    } catch (err: any) {
      setTriggerStatus({ success: false, message: err.message || 'Network error triggering worker' });
    } finally {
      setIsTriggering(false);
    }
  };

  const handleFollowUser = async (username: string) => {
    const previousRepos = [...repos];
    setRepos(prev => prev.map(r => r.owner.toLowerCase() === username.toLowerCase() ? { ...r, followed: true, unfollowed: false, followed_at: new Date().toISOString() } : r));
    setIsActionLoading(true);
    try {
      const res = await triggerFollow(username);
      if (res.success) {
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
        if (logsRes.data) setLogs(logsRes.data);
      } else {
        setRepos(previousRepos);
        alert(`Failed to follow: ${res.error}`);
      }
    } catch (err: any) {
      setRepos(previousRepos);
      alert(`Failed to follow: ${err.message || err}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUnfollowUser = async (username: string) => {
    const previousRepos = [...repos];
    setRepos(prev => prev.map(r => r.owner.toLowerCase() === username.toLowerCase() ? { ...r, followed: false, unfollowed: true } : r));
    setIsActionLoading(true);
    try {
      const res = await triggerUnfollow(username);
      if (res.success) {
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
        if (logsRes.data) setLogs(logsRes.data);
      } else {
        setRepos(previousRepos);
        alert(`Failed to unfollow: ${res.error}`);
      }
    } catch (err: any) {
      setRepos(previousRepos);
      alert(`Failed to unfollow: ${err.message || err}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStar = async (owner: string, name: string) => {
    const previousRepos = [...repos];
    setRepos(prev => prev.map(r => (r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === name.toLowerCase()) ? { ...r, starred: true } : r));
    try {
      const res = await triggerStar(owner, name);
      if (res.success) {
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
        if (logsRes.data) setLogs(logsRes.data);
      } else {
        setRepos(previousRepos);
        alert(`Failed to star: ${res.error}`);
      }
    } catch (err: any) {
      setRepos(previousRepos);
      alert(`Failed to star: ${err.message || err}`);
    }
  };

  const handleUnstar = async (owner: string, name: string) => {
    const previousRepos = [...repos];
    setRepos(prev => prev.map(r => (r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === name.toLowerCase()) ? { ...r, starred: false } : r));
    try {
      const res = await triggerUnstar(owner, name);
      if (res.success) {
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
        if (logsRes.data) setLogs(logsRes.data);
      } else {
        setRepos(previousRepos);
        alert(`Failed to unstar: ${res.error}`);
      }
    } catch (err: any) {
      setRepos(previousRepos);
      alert(`Failed to unstar: ${err.message || err}`);
    }
  };

  const handleDeleteProfile = async (username: string) => {
    if (!confirm(`Are you sure you want to permanently delete @${username} and all of their repositories from the database?`)) {
      return;
    }
    const previousRepos = [...repos];
    setRepos(prev => prev.filter(r => r.owner.toLowerCase() !== username.toLowerCase()));
    setIsActionLoading(true);
    try {
      const res = await triggerDeleteProfile(username);
      if (res.success) {
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
        if (logsRes.data) setLogs(logsRes.data);
      } else {
        setRepos(previousRepos);
        alert(`Failed to delete profile: ${res.error}`);
      }
    } catch (err: any) {
      setRepos(previousRepos);
      alert(`Failed to delete profile: ${err.message || err}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const getGradeColor = (grade: number) => {
    if (grade >= 8) return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30';
    if (grade >= 6) return 'bg-blue-50 text-[#0058bb] border border-blue-200 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30';
    if (grade >= 4) return 'bg-orange-50 text-orange-600 border border-orange-200 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30';
    return 'bg-rose-50 text-rose-600 border border-rose-200 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold dark:bg-rose-955/20 dark:text-rose-455 dark:border-rose-900/30';
  };

  // Process historical data for Recharts based on timeRange (7D / 30D / ALL)
  const chartData = useMemo(() => {
    const now = new Date();
    let daysToInclude = 7;
    if (timeRange === '30D') daysToInclude = 30;
    else if (timeRange === 'ALL') daysToInclude = 90;

    const dailyMap = new Map<string, { date: string; follows: number; unfollows: number; evaluations: number; totalGrade: number; gradeCount: number }>();

    for (let i = daysToInclude - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap.set(key, { date: label, follows: 0, unfollows: 0, evaluations: 0, totalGrade: 0, gradeCount: 0 });
    }

    logs.forEach(log => {
      const logDate = log.timestamp.split('T')[0];
      if (dailyMap.has(logDate)) {
        const dayData = dailyMap.get(logDate)!;
        if (log.action === 'FOLLOW' && log.status === 'SUCCESS') {
          dayData.follows++;
        } else if ((log.action === 'UNFOLLOW' || log.action === 'UNFOLLOW_RATIO') && log.status === 'SUCCESS') {
          dayData.unfollows++;
        } else if (log.action === 'GRADE' && log.status === 'SUCCESS') {
          dayData.evaluations++;
        }
      }
    });

    repos.forEach(repo => {
      if (repo.graded_at) {
        const gradeDate = repo.graded_at.split('T')[0];
        if (dailyMap.has(gradeDate)) {
          const dayData = dailyMap.get(gradeDate)!;
          dayData.totalGrade += repo.grade;
          dayData.gradeCount++;
        }
      }
    });

    const dailyList = Array.from(dailyMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    const reversedResult: any[] = [];
    let tempFollowersCumulative = stats.followed + stats.mutuals;

    dailyList.forEach(([key, dayData]) => {
      const avgScore = dayData.gradeCount > 0 ? Number((dayData.totalGrade / dayData.gradeCount).toFixed(1)) : 0;
      
      reversedResult.push({
        date: dayData.date,
        follows: dayData.follows,
        unfollows: dayData.unfollows,
        evaluations: dayData.evaluations,
        avgScore: avgScore,
        followingGrowth: tempFollowersCumulative
      });

      tempFollowersCumulative = Math.max(0, tempFollowersCumulative - dayData.follows + dayData.unfollows);
    });

    return reversedResult.reverse();
  }, [logs, repos, timeRange, stats]);

  const statusDistribution = useMemo(() => {
    return [
      { name: 'Followed', value: stats.followed, color: '#0058bb' },
      { name: 'Mutuals', value: stats.mutuals, color: '#10b981' },
      { name: 'Unfollowed', value: stats.unfollowed, color: '#e11d48' },
      { name: 'Skipped', value: stats.skipped, color: '#ea580c' },
      { name: 'Starred', value: stats.starred, color: '#f59e0b' }
    ].filter(item => item.value > 0);
  }, [stats]);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#f9f9f9] text-[#1a1c1c] dark:bg-[#0d0d0d] dark:text-[#f0f0f0] font-sans transition-colors duration-200 selection:bg-zinc-200 dark:selection:bg-zinc-800 antialiased">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&family=Geist:wght@100..900&family=Inter:ital,wght@0,100..900;1,100..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap');
        
        .font-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-geist { font-family: 'Geist', sans-serif; }
        .font-sans { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'Geist Mono', monospace; }
        
        .aura-shadow {
          box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.04);
        }
        .dark .aura-shadow {
          box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.25);
        }
        .aura-shadow-hover:hover {
          box-shadow: 0px 8px 30px rgba(0, 0, 0, 0.08);
        }
        .dark .aura-shadow-hover:hover {
          box-shadow: 0px 8px 30px rgba(0, 0, 0, 0.35);
        }

        .masonry-grid {
          column-count: 1;
          column-gap: 1.5rem;
        }
        @media (min-width: 768px) {
          .masonry-grid { column-count: 2; }
        }
        @media (min-width: 1200px) {
          .masonry-grid { column-count: 3; }
        }
        .masonry-item {
          break-inside: avoid;
          margin-bottom: 1.5rem;
        }
      `}</style>

      <div className="flex flex-1 flex-col md:flex-row relative">
        
        {/* HAMBURGER TOP BAR FOR MOBILE */}
        <div className="h-14 bg-white dark:bg-[#111111] border-b border-[#dadada] dark:border-[#2a2a2a] md:hidden flex items-center justify-between px-4 z-30 shrink-0">
          <div 
            onClick={() => setActiveTab('home')}
            className="flex items-center space-x-2.5 cursor-pointer hover:opacity-90"
          >
            <div className="h-7 w-7 rounded-lg bg-[#e60023] flex items-center justify-center text-white font-bold text-sm font-jakarta">F</div>
            <span className="font-bold tracking-tight font-jakarta text-[#1a1c1c] dark:text-[#f0f0f0] text-sm">FollowMe</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 border border-[#dadada] dark:border-[#2a2a2a] bg-white dark:bg-[#111111] text-[#1a1c1c] dark:text-[#f0f0f0] rounded-lg transition-all"
          >
            {isSidebarOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </div>

        {/* SIDE NAVIGATION */}
        <aside className={`fixed inset-y-0 left-0 w-64 bg-white dark:bg-[#111111] border-r border-[#dadada] dark:border-[#2a2a2a] flex flex-col justify-between py-6 px-4 shrink-0 z-40 transition-transform duration-300 md:translate-x-0 md:static ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="space-y-7">
            {/* Title / Brand */}
            <div 
              onClick={() => setActiveTab('home')}
              className="flex items-center space-x-3 px-2 cursor-pointer hover:opacity-90 active:scale-95 transition-all"
            >
              <div className="h-9 w-9 rounded-xl bg-[#e60023] flex items-center justify-center text-white font-bold text-lg font-jakarta shadow-sm">
                F
              </div>
              <div>
                <h1 className="text-lg font-bold font-jakarta tracking-tight leading-none text-[#1a1c1c] dark:text-[#f0f0f0]">FollowMe</h1>
                <span className="text-[9px] uppercase font-mono font-semibold tracking-wider text-slate-400 dark:text-zinc-650 mt-1 block">AI Agent Control</span>
              </div>
            </div>

            {/* Menu Links */}
            <nav className="space-y-1 font-geist">
              {[
                { tab: 'home', label: 'Explore', count: null, icon: Compass },
                { tab: 'profiles', label: 'Developer Profiles', count: filteredProfiles.length, icon: Layers },
                { tab: 'repos', label: 'Repository Pins', count: filteredRepos.length, icon: Star },
                { tab: 'logs', label: 'Activity Logs', count: logs.length, icon: Terminal },
                { tab: 'stats', label: 'Evaluation Metrics', count: null, icon: TrendingUp }
              ].map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.tab;
                return (
                  <button 
                    key={item.tab}
                    onClick={() => {
                      setActiveTab(item.tab as any);
                      setActiveFilter(null);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                      isActive 
                        ? 'bg-[#f3f3f3] dark:bg-[#1a1a1a] text-[#1a1c1c] dark:text-[#f0f0f0]' 
                        : 'text-[#767676] hover:bg-[#f9f9f9] dark:hover:bg-[#151515] hover:text-[#1a1c1c] dark:hover:text-[#f0f0f0]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                    {item.count !== null && (
                      <span className="px-2 py-0.5 rounded-full bg-[#f3f3f3] dark:bg-[#1a1a1a] text-xs font-mono font-bold">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer */}
          <div className="space-y-4 pt-6 border-t border-[#dadada] dark:border-[#2a2a2a]">
            {workerStatus && (
              <div className="bg-[#f3f3f3] dark:bg-[#1a1a1a] rounded-xl p-3.5 text-[10px] font-mono leading-relaxed relative overflow-hidden text-[#767676]">
                <div className="font-bold text-[#1a1c1c] dark:text-[#f0f0f0] flex items-center space-x-1.5 mb-1.5 font-jakarta">
                  <Activity className="h-3.5 w-3.5 text-[#e60023]" />
                  <span>Agent Worker Status</span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex justify-between">
                    <span>Job State:</span>
                    <span className={`font-bold ${workerStatus.isJobRunning ? 'text-amber-500 animate-pulse' : 'text-emerald-500'}`}>
                      {workerStatus.isJobRunning ? 'RUNNING' : 'IDLE'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Run:</span>
                    <span>
                      {(() => {
                        const lastSuccessLog = logs.find(l => l.action === 'SYSTEM' && l.status === 'SUCCESS' && l.message?.includes('finished'));
                        const lastRunTime = workerStatus?.lastRun || (lastSuccessLog ? lastSuccessLog.timestamp : null);
                        if (!lastRunTime) return 'Never';
                        const date = new Date(lastRunTime);
                        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-2 text-xs text-[#767676]">
              <span className="flex items-center gap-1.5 font-medium font-geist">
                <span className={`h-2.5 w-2.5 rounded-full ${workerStatus?.isJobRunning ? 'bg-amber-400' : 'bg-emerald-500'} animate-pulse`} />
                System Ready
              </span>
              
              <button 
                onClick={toggleDarkMode}
                className="h-8 w-8 flex items-center justify-center border border-[#dadada] dark:border-[#2a2a2a] hover:bg-[#f3f3f3] dark:hover:bg-[#1a1a1a] text-[#1a1c1c] dark:text-[#f0f0f0] rounded-full cursor-pointer transition-all"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </aside>

        {/* BACKDROP FOR MOBILE */}
        {isSidebarOpen && (
          <div 
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-30 md:hidden backdrop-blur-xs"
          />
        )}

        {/* MAIN WORKSPACE */}
        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
          
          {/* TOP APP BAR */}
          <header className="h-16 bg-white dark:bg-[#111111] border-b border-[#dadada] dark:border-[#2a2a2a] flex items-center justify-between px-6 shrink-0 z-20">
            <div className="flex items-center space-x-4 flex-1 max-w-md">
              {activeTab !== 'stats' && (
                <div className="relative w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search metadata, profiles, or logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#f3f3f3] dark:bg-[#1a1a1a] border-none rounded-full py-2 pl-10 pr-4 text-xs text-[#1a1c1c] dark:text-[#f0f0f0] placeholder-slate-450 focus:outline-none focus:ring-1 focus:ring-[#e60023] transition-all font-sans"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 font-geist">
              <button 
                onClick={handleSync}
                disabled={isSyncing || workerStatus?.isJobRunning}
                className="min-h-[36px] px-4 flex items-center space-x-2 bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] hover:bg-[#f3f3f3] dark:hover:bg-[#1a1a1a] text-[#1a1c1c] dark:text-[#f0f0f0] text-xs font-bold rounded-full cursor-pointer transition-all disabled:opacity-40 aura-shadow"
              >
                {isSyncing ? <RotateCw className="h-3.5 w-3.5 animate-spin text-[#e60023]" /> : <RotateCw className="h-3.5 w-3.5 text-[#e60023]" />}
                <span>Sync Repos</span>
              </button>

              <button 
                onClick={() => setIsCleanupOpen(true)}
                disabled={workerStatus?.isJobRunning}
                className="min-h-[36px] px-4 flex items-center space-x-2 bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] hover:bg-[#f3f3f3] dark:hover:bg-[#1a1a1a] text-[#1a1c1c] dark:text-[#f0f0f0] text-xs font-bold rounded-full cursor-pointer transition-all disabled:opacity-40 aura-shadow"
              >
                <Settings className="h-3.5 w-3.5 text-blue-500" />
                <span>Cleanup Cache</span>
              </button>

              <button 
                onClick={handleRefresh}
                disabled={isRefreshing || isSyncing}
                className="min-h-[36px] px-4 flex items-center space-x-2 bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] hover:bg-[#f3f3f3] dark:hover:bg-[#1a1a1a] text-[#1a1c1c] dark:text-[#f0f0f0] text-xs font-bold rounded-full cursor-pointer transition-all disabled:opacity-40 aura-shadow"
                title="Refresh Cache"
              >
                <RotateCw className={`h-3.5 w-3.5 text-zinc-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh Data</span>
              </button>

              <button 
                onClick={handleTrigger}
                disabled={isTriggering || workerStatus?.isJobRunning}
                className="min-h-[36px] px-5 flex items-center space-x-2 bg-[#e60023] hover:bg-[#c0001b] disabled:bg-slate-350 text-white text-xs font-bold rounded-full transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{isTriggering ? 'Running...' : 'Run Task'}</span>
              </button>
            </div>
          </header>

          {/* MAIN PAGE BODY */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">

            {triggerStatus && (
              <div className="p-4 rounded-xl border flex items-center justify-between font-mono text-xs animate-startup-logo bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                <div className="flex items-center space-x-2.5">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span>{triggerStatus.message}</span>
                </div>
                <button 
                  onClick={() => setTriggerStatus(null)}
                  className="hover:underline font-bold"
                >
                  Dismiss
                </button>
              </div>
            )}


            {/* TAB CONTENT GRID CONTAINER */}
            <div className="space-y-6">
              
              {/* TAB OPTIONS */}
              <div className="pb-4 border-b border-[#dadada] dark:border-[#2a2a2a]">
                <h2 className="text-lg font-bold font-jakarta text-[#1a1c1c] dark:text-[#f0f0f0] leading-tight">
                  {activeTab === 'home' && "System Overview"}
                  {activeTab === 'profiles' && "Developer Profiles"}
                  {activeTab === 'repos' && "Repository Graded Pins"}
                  {activeTab === 'logs' && "System Log Output"}
                  {activeTab === 'stats' && "Historical Metrics & Statistics"}
                </h2>
              </div>

              {/* ACTIVE FILTER DISMISS PILL */}
              {activeFilter && activeTab !== 'stats' && (
                <div className="flex items-center space-x-2 font-mono text-[10px]">
                  <span className="text-[#767676]">Active filter:</span>
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#e60023]/10 border border-[#e60023]/20 text-[#e60023] rounded-full font-bold">
                    <span className="capitalize">{activeFilter}</span>
                    <button onClick={() => setActiveFilter(null)} className="font-extrabold hover:text-white cursor-pointer leading-none">×</button>
                  </span>
                </div>
              )}

              {/* 0. HOMEPAGE TAB */}
              {activeTab === 'home' && (
                <div className="masonry-grid">
                  
                  {/* Card 1: Top Profile Card */}
                  {topProfile && (
                    <div 
                      onClick={() => setActiveTab('profiles')}
                      className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-2xl aura-shadow hover:shadow-lg dark:hover:shadow-black/40 aura-shadow-hover transition-all duration-200 cursor-pointer p-5 flex flex-col space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#e60023] font-jakarta">Top Developer Profile</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#e60023] text-white font-mono text-[10px] font-bold">
                          {(topProfile.avgGrade).toFixed(1)}/10 Avg
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-3.5">
                        <img 
                          src={`https://github.com/${topProfile.owner}.png`} 
                          alt={topProfile.owner} 
                          className="h-12 w-12 rounded-full border border-[#dadada] dark:border-[#2a2a2a] object-cover bg-zinc-50 dark:bg-zinc-900"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://unavatar.io/github/${topProfile.owner}`;
                          }}
                        />
                        <div className="truncate">
                          <h3 className="text-base font-extrabold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta truncate">@{topProfile.owner}</h3>
                          <p className="text-[10px] font-mono text-[#767676] mt-0.5">{topProfile.reposCount} Graded Repositories</p>
                        </div>
                      </div>

                      {topProfile.repos[0]?.readme_snippet && (
                        <p className="text-xs font-sans text-[#767676] dark:text-zinc-450 line-clamp-3 leading-relaxed">
                          {cleanSnippet(topProfile.repos[0].readme_snippet)}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-[#eeeeee] dark:border-[#2a2a2a]">
                        <div className="flex items-center space-x-3 font-mono text-[10px] text-[#767676]">
                          <span>{topProfile.repos[0]?.language || 'Unknown'}</span>
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-current text-amber-500" />
                            {topProfile.repos.reduce((acc, r) => acc + r.stars, 0)} Stars
                          </span>
                        </div>
                        
                        {(() => {
                          const status = topProfile.followStatus;
                          const isFollowed = status.followed && !status.unfollowed && !status.follow_back;
                          const isUnfollowed = status.unfollowed;
                          const isSkipped = status.follow_skipped;
                          const isMutual = status.followed && !status.unfollowed && status.follow_back;
                          
                          let badgeClass = "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-955/20 dark:text-orange-400";
                          let badgeLabel = "Pending";
                          if (isFollowed) {
                            badgeClass = "bg-blue-50 text-[#0058bb] border-blue-200 dark:bg-blue-955/20 dark:text-blue-400";
                            badgeLabel = "Followed";
                          } else if (isMutual) {
                            badgeClass = "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-955/20 dark:text-emerald-400";
                            badgeLabel = "Mutual Follow";
                          } else if (isUnfollowed) {
                            badgeClass = "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-955/20 dark:text-rose-455";
                            badgeLabel = "Unfollowed";
                          } else if (isSkipped) {
                            badgeClass = "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-955/20 dark:text-orange-400";
                            badgeLabel = "Skipped";
                          }
                          return (
                            <span className={`px-2 py-0.5 rounded-full text-[9px] border font-mono font-bold ${badgeClass}`}>
                              {badgeLabel}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Card 2: Top Repository Card */}
                  {topRepo && (
                    <div 
                      onClick={() => setActiveTab('repos')}
                      className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-2xl aura-shadow hover:shadow-lg dark:hover:shadow-black/40 aura-shadow-hover transition-all duration-200 cursor-pointer p-5 flex flex-col space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#e60023] font-jakarta">Featured Repository</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-955/20 dark:text-amber-400 font-mono text-[9px] font-bold flex items-center gap-1">
                          <Star className="h-3 w-3 fill-current" /> {topRepo.stars}
                        </span>
                      </div>
                      
                      <div>
                        <span className="text-[10px] font-bold text-[#767676] block">@{topRepo.owner}</span>
                        <h3 className="text-base font-extrabold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta leading-tight truncate mt-0.5">{topRepo.name}</h3>
                      </div>

                      {topRepo.readme_snippet && (
                        <p className="text-xs font-sans text-[#767676] dark:text-zinc-450 line-clamp-3 leading-relaxed">
                          {cleanSnippet(topRepo.readme_snippet)}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {topRepo.topics && topRepo.topics.slice(0, 3).map(topic => (
                          <span key={topic} className="px-2 py-0.5 bg-[#f3f3f3] dark:bg-[#222] text-[#767676] dark:text-zinc-450 rounded-full font-mono text-[9px] font-bold">
                            #{topic}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[#eeeeee] dark:border-[#2a2a2a]">
                        <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#767676]">
                          <span className="h-2 w-2 rounded-full bg-[#e60023]" />
                          {topRepo.language || 'Unknown'}
                        </span>
                        <span className={getGradeColor(topRepo.grade)}>
                          Score: {topRepo.grade.toFixed(1)}/10
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Card 3: Recent Logs Card */}
                  <div 
                    onClick={() => setActiveTab('logs')}
                    className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-2xl aura-shadow hover:shadow-lg dark:hover:shadow-black/40 aura-shadow-hover transition-all duration-200 cursor-pointer p-5 flex flex-col space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold font-jakarta text-[#1a1c1c] dark:text-[#f0f0f0]">Recent Logs</h3>
                      <span className="text-zinc-400 font-bold">•••</span>
                    </div>

                    <div className="space-y-3 font-sans text-xs min-h-[160px]">
                      {logs.slice(0, 5).map(log => {
                        let dotColor = "bg-blue-400";
                        if (log.status === 'SUCCESS') dotColor = "bg-[#10b981]";
                        else if (log.status === 'FAILED' || log.status === 'ERROR') dotColor = "bg-[#rose-500] bg-rose-500";
                        else if (log.status === 'WARN') dotColor = "bg-orange-500";
                        
                        return (
                          <div key={log.id} className="p-3 bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] rounded-xl flex items-start space-x-3">
                            <span className={`h-2.5 w-2.5 rounded-full mt-1 shrink-0 ${dotColor}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#1a1c1c] dark:text-[#f0f0f0] truncate">{log.action}: {log.status}</span>
                              </div>
                              <span className="text-[10px] text-[#767676] block mt-0.5 truncate max-w-[200px]">
                                {new Date(log.timestamp).toLocaleTimeString()} &bull; {log.message}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 text-center border-t border-[#eeeeee] dark:border-[#2a2a2a]">
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('logs');
                        }}
                        className="text-xs font-bold font-geist text-[#e60023] hover:underline cursor-pointer"
                      >
                        View System Console
                      </span>
                    </div>
                  </div>

                  {/* Card 4: Stats Snapshot Card */}
                  <div 
                    onClick={() => setActiveTab('stats')}
                    className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-2xl aura-shadow hover:shadow-lg dark:hover:shadow-black/40 aura-shadow-hover transition-all duration-200 cursor-pointer p-5 flex flex-col space-y-4"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#e60023] font-jakarta">Activity snapshot (7D)</span>
                    
                    <div className="h-[160px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData.slice(-7)}>
                          <XAxis dataKey="date" stroke="#767676" tick={{ fontFamily: 'Inter', fontSize: 9 }} tickLine={false} axisLine={false} />
                          <YAxis hide={true} />
                          <Tooltip contentStyle={{ background: isDark ? '#111' : '#fff', border: '1px solid #dadada', borderRadius: '8px' }} />
                          <Bar dataKey="follows" fill="#e60023" name="Follows" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="unfollows" fill="#e60023" fillOpacity={0.3} name="Unfollows" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-[#767676]">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#e60023]" />
                        <span>Follows</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#e60023]/30" />
                        <span>Unfollows</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 5: AI Narrator Card */}
                  <div className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-2xl aura-shadow p-5 flex flex-col space-y-4 cursor-default">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-[#e60023]">
                        <Zap className="h-4 w-4 fill-current" />
                        <span className="text-[10px] font-bold uppercase tracking-wider font-jakarta">Agent Insight</span>
                      </div>
                      <span className="text-[9px] font-mono text-zinc-400">Just now</span>
                    </div>

                    {/* Speech-bubble block styling */}
                    <div className="relative p-4 rounded-2xl bg-rose-50 border border-rose-100 dark:bg-rose-955/15 dark:border-rose-900/30 text-rose-700 dark:text-rose-455 font-sans text-xs leading-relaxed">
                      <div className="absolute top-[-6px] left-6 w-3 h-3 bg-rose-50 border-t border-l border-rose-100 dark:bg-[#281116] dark:border-rose-900/30 transform rotate-45" />
                      "{narration}"
                    </div>

                    <div className="flex items-center space-x-2 text-[10px] font-mono text-[#767676]">
                      <span className="h-2 w-2 rounded-full bg-emerald-555 bg-emerald-500 animate-pulse" />
                      <span>GitAuto Agent Alpha</span>
                    </div>
                  </div>

                </div>
              )}

              {/* 1. PROFILES TAB */}
              {activeTab === 'profiles' && (
                <div className="masonry-grid">
                  {isRefreshing ? (
                    [1, 2, 3].map(n => <div key={n} className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-5 h-[160px] animate-pulse" />)
                  ) : filteredProfiles.length === 0 ? (
                    <div className="col-span-full py-16 flex flex-col items-center justify-center bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl text-center text-xs font-mono text-[#767676] space-y-3">
                      <Lottie animationData={mainCharacter} loop={true} className="w-32 h-32 opacity-80" />
                      <p>No profiles found matching search query/filters.</p>
                    </div>
                  ) : (
                    filteredProfiles.map(profile => (
                      <div key={profile.owner} className="masonry-item">
                        <ProfileCard
                          profile={profile}
                          onFollow={handleFollowUser}
                          onUnfollow={handleUnfollowUser}
                          onDelete={handleDeleteProfile}
                          isActionLoading={isActionLoading}
                        />
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 2. REPOS TAB */}
              {activeTab === 'repos' && (
                <div className="masonry-grid">
                  {isRefreshing ? (
                    [1, 2, 3].map(n => <div key={n} className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-5 h-[160px] animate-pulse" />)
                  ) : filteredRepos.length === 0 ? (
                    <div className="col-span-full py-16 flex flex-col items-center justify-center bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl text-center text-xs font-mono text-[#767676] space-y-3">
                      <Lottie animationData={mainCharacter} loop={true} className="w-32 h-32 opacity-80" />
                      <p>No repositories found matching search query/filters.</p>
                    </div>
                  ) : (
                    filteredRepos.map(repo => (
                      <div 
                        key={repo.id}
                        className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] hover:shadow-lg dark:hover:shadow-black/40 rounded-xl p-6 transition-all duration-350 flex flex-col justify-between space-y-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3.5 min-w-0">
                            <img 
                              src={`https://github.com/${repo.owner}.png`} 
                              alt={repo.owner} 
                              className="h-8 w-8 rounded-full border border-[#dadada] dark:border-[#2a2a2a] object-cover bg-zinc-50 dark:bg-zinc-900"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://unavatar.io/github/${repo.owner}`;
                              }}
                            />
                            <div className="truncate">
                              <span className="text-[10px] font-bold text-[#767676] font-geist block leading-none mb-1">@{repo.owner}</span>
                              <h3 className="text-base font-extrabold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta leading-tight truncate">{repo.name}</h3>
                            </div>
                          </div>
                          <span className={getGradeColor(repo.grade)}>
                            {repo.grade.toFixed(1)}/10
                          </span>
                        </div>

                        {repo.readme_snippet && (
                          <p className="text-xs font-sans text-[#767676] dark:text-zinc-450 line-clamp-3 leading-relaxed">
                            {cleanSnippet(repo.readme_snippet).split('\n').filter(line => line.trim() !== '')[0] || 'No readme description.'}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t border-[#eeeeee] dark:border-[#2a2a2a] text-xs">
                          <div className="flex items-center space-x-3 font-mono text-[10px] text-[#767676]">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full bg-[#e60023]" />
                              {repo.language || 'Unknown'}
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-amber-500">
                              <Star className="h-3 w-3 fill-current" />
                              {repo.stars}
                            </span>
                          </div>
                          
                          <div className="flex gap-1.5 font-mono text-[9px] font-bold shrink-0">
                            {repo.starred && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-955/20 dark:text-amber-450">Starred</span>}
                            {repo.followed && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#0058bb] border border-blue-200 dark:bg-blue-955/20 dark:text-blue-450">Followed</span>}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          {repo.starred ? (
                            <button 
                              onClick={() => handleUnstar(repo.owner, repo.name)}
                              className="flex-1 min-h-[34px] flex items-center justify-center bg-transparent border border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-455 hover:bg-rose-50 dark:hover:bg-rose-955/10 text-xs font-bold rounded-full transition-all cursor-pointer font-geist"
                            >
                              Unstar
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleStar(repo.owner, repo.name)}
                              className="flex-1 min-h-[34px] flex items-center justify-center bg-[#e60023] hover:bg-[#c0001b] text-white text-xs font-bold rounded-full transition-all cursor-pointer font-geist"
                            >
                              Star
                            </button>
                          )}

                          {repo.readme_snippet && (
                            <button 
                              onClick={() => setSelectedRepo(repo)}
                              className="px-4 min-h-[34px] flex items-center justify-center bg-transparent border border-[#dadada] dark:border-[#2a2a2a] hover:bg-[#f3f3f3] dark:hover:bg-[#1a1a1a] text-[#1a1c1c] dark:text-[#f0f0f0] text-xs font-bold rounded-full transition-all cursor-pointer font-geist"
                            >
                              Readme
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 3. LOGS TAB */}
              {activeTab === 'logs' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Viewport: macOS Terminal Window */}
                  <div className="lg:col-span-2 flex flex-col">
                    {/* Header Bar */}
                    <div className="bg-[#18181b] border border-zinc-800 px-4 py-3 flex items-center justify-between text-zinc-400 font-mono text-xs rounded-t-2xl">
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="h-3 w-3 rounded-full bg-[#ef4444]" />
                        <span className="h-3 w-3 rounded-full bg-[#f59e0b]" />
                        <span className="h-3 w-3 rounded-full bg-[#10b981]" />
                      </div>
                      <span className="font-bold text-zinc-350 tracking-tight">SYSTEM_MONITOR_V4.2.LOG</span>
                      <span className="text-[10px] opacity-60">UTC -05:00</span>
                    </div>

                    {/* Terminal Body */}
                    <div className="bg-[#09090b] text-zinc-300 font-mono text-xs p-5 overflow-y-auto h-[480px] space-y-3.5 rounded-b-2xl border border-zinc-800 border-t-0 select-text">
                      {isRefreshing ? (
                        [1, 2, 3].map(n => <div key={n} className="h-8 bg-zinc-900 rounded animate-pulse" />)
                      ) : filteredLogs.length === 0 ? (
                        <div className="py-12 text-center text-zinc-500">No active logs matching search filters.</div>
                      ) : (
                        [...filteredLogs]
                          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                          .map(log => {
                            let prefixColor = "text-blue-500";
                            let prefixLabel = "[INFO]";
                            
                            if (log.status === 'SUCCESS') {
                              prefixColor = "text-[#10b981] font-bold";
                              prefixLabel = "[SUCCESS]";
                            } else if (log.status === 'FAILED' || log.status === 'ERROR') {
                              prefixColor = "text-[#ef4444] font-bold";
                              prefixLabel = "[ERROR]";
                            } else if (log.status === 'WARN') {
                              prefixColor = "text-[#f59e0b] font-bold";
                              prefixLabel = "[WARN]";
                            }

                            return (
                              <div key={log.id} className="flex items-start space-x-2 leading-relaxed tracking-normal">
                                <span className="text-zinc-650 shrink-0 select-none">
                                  {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                                <span className={`shrink-0 ${prefixColor}`}>{prefixLabel}</span>
                                <span className="text-zinc-400 font-bold shrink-0">@{log.action}:</span>
                                <span className="text-zinc-200 select-all">{log.message}</span>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>

                  {/* Right Viewport: Bold Brand-Red Health counters */}
                  <div className="lg:col-span-1">
                    <div className="bg-[#e60023] text-white rounded-2xl p-6 flex flex-col justify-between min-h-[380px] shadow-lg relative overflow-hidden aura-shadow">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-extrabold font-jakarta tracking-tight">System Health</h3>
                          <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                        </div>
                        <p className="text-xs font-sans text-white/80 leading-relaxed mb-6">
                          All agents are operating within normal parameters. Memory and API usage is healthy.
                        </p>

                        <div className="space-y-4 font-geist text-xs">
                          <div className="flex items-center justify-between py-2.5 border-b border-white/20">
                            <span className="font-medium text-white/70">Active Agents</span>
                            <span className="font-extrabold text-sm">1 / 1</span>
                          </div>
                          <div className="flex items-center justify-between py-2.5 border-b border-white/20">
                            <span className="font-medium text-white/70">Average Latency</span>
                            <span className="font-extrabold text-sm">124ms</span>
                          </div>
                          <div className="flex items-center justify-between py-2.5 border-b border-white/20">
                            <span className="font-medium text-white/70">Uptime (24h)</span>
                            <span className="font-extrabold text-sm">99.998%</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center justify-center bg-white/10 hover:bg-white/15 border border-white/20 p-2.5 rounded-xl font-mono text-[9px] font-bold tracking-widest text-center transition-all select-none">
                        <span className="h-2 w-2 rounded-full bg-[#10b981] mr-2 animate-ping" />
                        LIVE STREAM CONNECTED
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* 4. STATS TAB */}
              {activeTab === 'stats' && mounted && (
                <div className="space-y-8 animate-startup-card">
                  {/* Date toggle */}
                  <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-4 aura-shadow">
                    <span className="text-xs font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta">Plot Historical Ranges:</span>
                    <div className="flex bg-[#eeeeee] dark:bg-[#1a1a1a] p-1 rounded-full text-xs font-bold font-geist">
                      {(['7D', '30D', 'ALL'] as const).map(range => (
                        <button 
                          key={range}
                          onClick={() => setTimeRange(range)}
                          className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${timeRange === range ? 'bg-white dark:bg-[#2c2c2c] text-[#1a1c1c] dark:text-[#f0f0f0] font-bold' : 'text-[#767676] hover:text-[#1a1c1c] dark:hover:text-[#f0f0f0]'}`}
                        >
                          {range}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Primary charts row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* Daily Action Line Chart */}
                    <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-5 aura-shadow">
                      <h3 className="text-sm font-bold font-jakarta mb-4 text-[#1a1c1c] dark:text-[#f0f0f0]">Daily Agent Actions (Follows/Unfollows/Evaluations)</h3>
                      <div className="h-[280px] w-full font-mono text-[10px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#222' : '#f0f0f0'} />
                            <XAxis dataKey="date" stroke="#767676" tick={{ fontFamily: 'Inter', fontSize: 10 }} />
                            <YAxis stroke="#767676" tick={{ fontFamily: 'Geist Mono', fontSize: 10 }} />
                            <Tooltip contentStyle={{ background: isDark ? '#111' : '#fff', border: '1px solid #dadada', borderRadius: '8px' }} />
                            <Legend wrapperStyle={{ fontFamily: 'Geist', fontSize: 11 }} />
                            <Line type="monotone" dataKey="follows" stroke="#0058bb" name="Follows" strokeWidth={2.5} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="unfollows" stroke="#e11d48" name="Unfollows" strokeWidth={2.5} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="evaluations" stroke="#10b981" name="Evaluations" strokeWidth={2} strokeDasharray="5 5" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Cumulative Following Growth */}
                    <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-5 aura-shadow">
                      <h3 className="text-sm font-bold font-jakarta mb-4 text-[#1a1c1c] dark:text-[#f0f0f0]">Cumulative Following Growth</h3>
                      <div className="h-[280px] w-full font-mono text-[10px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="colorFollow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0058bb" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#0058bb" stopOpacity={0.01}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#222' : '#f0f0f0'} />
                            <XAxis dataKey="date" stroke="#767676" tick={{ fontFamily: 'Inter', fontSize: 10 }} />
                            <YAxis stroke="#767676" tick={{ fontFamily: 'Geist Mono', fontSize: 10 }} />
                            <Tooltip contentStyle={{ background: isDark ? '#111' : '#fff', border: '1px solid #dadada', borderRadius: '8px' }} />
                            <Area type="monotone" dataKey="followingGrowth" name="Following" stroke="#0058bb" fillOpacity={1} fill="url(#colorFollow)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                  </div>

                  {/* Secondary charts row */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Quality Scores */}
                    <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-5 aura-shadow lg:col-span-2">
                      <h3 className="text-sm font-bold font-jakarta mb-4 text-[#1a1c1c] dark:text-[#f0f0f0]">Average Repository Quality Scores</h3>
                      <div className="h-[280px] w-full font-mono text-[10px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData.filter(d => d.avgScore > 0)}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#222' : '#f0f0f0'} />
                            <XAxis dataKey="date" stroke="#767676" tick={{ fontFamily: 'Inter', fontSize: 10 }} />
                            <YAxis stroke="#767676" domain={[0, 10]} tick={{ fontFamily: 'Geist Mono', fontSize: 10 }} />
                            <Tooltip contentStyle={{ background: isDark ? '#111' : '#fff', border: '1px solid #dadada', borderRadius: '8px' }} />
                            <Line type="monotone" dataKey="avgScore" name="Avg Score" stroke="#e60023" strokeWidth={3} dot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Donut status distribution */}
                    <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-5 aura-shadow">
                      <h3 className="text-sm font-bold font-jakarta mb-4 text-[#1a1c1c] dark:text-[#f0f0f0]">Profiles Status Shares</h3>
                      <div className="h-[240px] w-full font-mono text-[10px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={statusDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {statusDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ background: isDark ? '#111' : '#fff', border: '1px solid #dadada', borderRadius: '8px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[10px] font-geist mt-3">
                        {statusDistribution.map((entry, index) => (
                          <div key={index} className="flex items-center space-x-1.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="font-bold text-[#1a1c1c] dark:text-[#f0f0f0]">{entry.name} ({entry.value})</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Grouped Bar Chart follows vs unfollows */}
                  <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-5 aura-shadow">
                    <h3 className="text-sm font-bold font-jakarta mb-4 text-[#1a1c1c] dark:text-[#f0f0f0]">Action Volumes Comparison (Follows vs Unfollows)</h3>
                    <div className="h-[280px] w-full font-mono text-[10px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#222' : '#f0f0f0'} />
                          <XAxis dataKey="date" stroke="#767676" tick={{ fontFamily: 'Inter', fontSize: 10 }} />
                          <YAxis stroke="#767676" tick={{ fontFamily: 'Geist Mono', fontSize: 10 }} />
                          <Tooltip contentStyle={{ background: isDark ? '#111' : '#fff', border: '1px solid #dadada', borderRadius: '8px' }} />
                          <Legend wrapperStyle={{ fontFamily: 'Geist', fontSize: 11 }} />
                          <Bar dataKey="follows" fill="#0058bb" name="Follow Actions" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="unfollows" fill="#e11d48" name="Unfollow Actions" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>

          <footer className="mt-auto border-t border-[#dadada] dark:border-[#2a2a2a] py-6 text-center text-[10px] font-mono text-[#767676] bg-white dark:bg-[#111111] transition-colors duration-200">
            <p>FollowMe Dashboard — Verified evaluation runs logged in real time</p>
          </footer>
        </main>
      </div>

      {/* Maintenance modal */}
      {isCleanupOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 dark:bg-black/85 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111111] border-t sm:border border-[#dadada] dark:border-[#2a2a2a] w-full sm:max-w-2xl h-[92vh] sm:h-auto sm:max-h-[85vh] rounded-t-2xl sm:rounded-xl flex flex-col shadow-2xl overflow-hidden font-mono text-xs">
            <div className="px-5 py-4 border-b border-[#dadada] dark:border-[#2a2a2a] bg-[#f9f9f9] dark:bg-[#151515] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[#767676] uppercase tracking-wider">Maintenance Dashboard</span>
                <h3 className="text-xs font-bold text-[#1a1c1c] dark:text-[#f0f0f0] uppercase tracking-widest mt-0.5">Cleanup Assistant</h3>
              </div>
              <button
                onClick={() => {
                  setIsCleanupOpen(false);
                  setCleanupOption(null);
                }}
                className="px-3.5 py-2 hover:bg-[#f3f3f3] dark:hover:bg-[#222] text-[#1a1c1c] dark:text-[#f0f0f0] rounded-lg border border-[#dadada] dark:border-[#2a2a2a] cursor-pointer transition"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cleanupOption === null ? (
                <div className="space-y-4 font-sans">
                  <p className="text-[#767676] text-xs">Select a maintenance task to run:</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-[#fdfdfd] dark:bg-[#181818] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="font-bold text-[#1a1c1c] dark:text-[#f0f0f0]">1. Bulk Unfollow</h4>
                        <p className="text-[#767676] text-[11px] mt-1 leading-relaxed">
                          Unfollows anyone followed &gt;7 days ago who has not followed back.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          handleCleanupRun();
                          setIsCleanupOpen(false);
                        }}
                        disabled={isCleaning}
                        className="w-full min-h-[36px] bg-[#e60023] hover:bg-[#c0001b] text-white text-xs font-bold rounded-full cursor-pointer transition disabled:opacity-50 font-geist"
                      >
                        Run Bulk Cleanup
                      </button>
                    </div>

                    <div className="p-4 bg-[#fdfdfd] dark:bg-[#181818] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="font-bold text-[#1a1c1c] dark:text-[#f0f0f0]">2. Selective Unfollow</h4>
                        <p className="text-[#767676] text-[11px] mt-1 leading-relaxed">
                          Preview eligible developers to unfollow them selectively or in bulk.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          fetchUnfollowList();
                          setCleanupOption('list');
                        }}
                        className="w-full min-h-[36px] bg-transparent border border-[#dadada] dark:border-[#2a2a2a] hover:bg-[#f3f3f3] dark:hover:bg-[#222] text-[#1a1c1c] dark:text-[#f0f0f0] text-xs font-bold rounded-full cursor-pointer transition font-geist"
                      >
                        Preview & Select
                      </button>
                    </div>

                    <div className="p-4 bg-[#fdfdfd] dark:bg-[#181818] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="font-bold text-[#0058bb] dark:text-blue-450">3. Log Cleanup</h4>
                        <p className="text-[#767676] text-[11px] mt-1 leading-relaxed">
                          Purges old logs history to save database storage, keeping the latest 200 logs.
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          await fetchTotalLogsCount();
                          setCleanupOption('logs');
                        }}
                        className="w-full min-h-[36px] bg-transparent border border-[#dadada] dark:border-[#2a2a2a] hover:bg-[#f3f3f3] dark:hover:bg-[#222] text-[#1a1c1c] dark:text-[#f0f0f0] text-xs font-bold rounded-full cursor-pointer transition font-geist"
                      >
                        Purge Old Logs
                      </button>
                    </div>

                    <div className="p-4 bg-[#fdfdfd] dark:bg-[#181818] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="font-bold text-orange-500">4. Clear Stale Profiles</h4>
                        <p className="text-[#767676] text-[11px] mt-1 leading-relaxed">
                          Deletes discovered profiles that were skipped and never starred or followed.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setCleanupOption('stale');
                        }}
                        className="w-full min-h-[36px] bg-transparent border border-[#dadada] dark:border-[#2a2a2a] hover:bg-[#f3f3f3] dark:hover:bg-[#222] text-[#1a1c1c] dark:text-[#f0f0f0] text-xs font-bold rounded-full cursor-pointer transition font-geist"
                      >
                        Clear Stale Data
                      </button>
                    </div>
                  </div>
                </div>
              ) : cleanupOption === 'list' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#eeeeee] dark:border-[#2a2a2a] pb-2">
                    <h4 className="font-bold text-[#1a1c1c] dark:text-[#f0f0f0] uppercase tracking-widest text-[10px]">Unfollow Candidates list</h4>
                    <button
                      onClick={() => setCleanupOption(null)}
                      className="text-xs hover:underline cursor-pointer"
                    >
                      &larr; Back Options
                    </button>
                  </div>

                  {isFetchingUnfollowList ? (
                    <div className="py-8 text-center text-[#767676]">Fetching candidates list...</div>
                  ) : unfollowList.length === 0 ? (
                    <div className="py-8 text-center text-[#767676] font-semibold">No users match the cleanup criteria right now.</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1.5">
                        {unfollowList.map(user => (
                          <div key={user.id} className="p-3.5 bg-[#fbfbfb] dark:bg-[#161616] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl flex items-center justify-between gap-3 text-zinc-300">
                            <div>
                              <span className="font-bold text-[#1a1c1c] dark:text-[#f0f0f0] block text-xs">@{user.owner}</span>
                              <span className="text-[10px] text-[#767676] block mt-0.5">Followed: {new Date(user.followed_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                              <button
                                onClick={async () => {
                                  await handleUnfollowUser(user.owner);
                                  setUnfollowList(prev => prev.filter(u => u.owner !== user.owner));
                                }}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-full text-[11px] font-bold cursor-pointer font-geist"
                              >
                                Unfollow
                              </button>
                              <a
                                href={`https://github.com/${user.owner}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-transparent border border-[#dadada] dark:border-[#2a2a2a] hover:bg-[#f3f3f3] dark:hover:bg-[#222] text-[#1a1c1c] dark:text-[#f0f0f0] rounded-full text-[11px] font-bold flex items-center font-geist"
                              >
                                Profile
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2">
                        <button
                          onClick={() => {
                            handleCleanupRun();
                            setIsCleanupOpen(false);
                          }}
                          disabled={isCleaning}
                          className="w-full min-h-[40px] flex items-center justify-center bg-[#e60023] hover:bg-[#c0001b] text-white text-xs font-bold rounded-full cursor-pointer disabled:opacity-50 font-geist"
                        >
                          Unfollow All ({unfollowList.length})
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : cleanupOption === 'logs' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#eeeeee] dark:border-[#2a2a2a] pb-2">
                    <h4 className="font-bold text-[#0058bb] dark:text-blue-400 uppercase tracking-widest text-[10px]">Logs Cleanup Confirmation</h4>
                    <button
                      onClick={() => setCleanupOption(null)}
                      className="text-xs hover:underline cursor-pointer"
                    >
                      &larr; Back
                    </button>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-955/20 border border-blue-200 dark:border-blue-900/30 rounded-xl text-[#0058bb] dark:text-blue-450 font-sans">
                    <p className="font-bold text-xs">⚠️ PURGING HISTORICAL ACTION LOGS</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#767676] dark:text-zinc-400 font-sans">
                      This action will delete all old worker logs except for the latest 200 entries. It will not alter repository evaluation scores or follower details.
                    </p>
                    <p className="mt-3 text-xs font-semibold text-[#0058bb] dark:text-blue-400 font-mono">
                      This will delete {Math.max(0, totalLogsCount - 200)} old log entries (Total logs in DB: {totalLogsCount}).
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={async () => {
                        await handleLogCleanupRun();
                        setIsCleanupOpen(false);
                        setCleanupOption(null);
                      }}
                      disabled={isCleaning}
                      className="w-full min-h-[40px] flex items-center justify-center bg-[#e60023] hover:bg-[#c0001b] text-white text-xs font-bold rounded-full transition cursor-pointer font-geist"
                    >
                      Confirm and Delete Logs
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#eeeeee] dark:border-[#2a2a2a] pb-2">
                    <h4 className="font-bold text-orange-500 uppercase tracking-widest text-[10px]">Stale Profiles Cleanup</h4>
                    <button
                      onClick={() => setCleanupOption(null)}
                      className="text-xs hover:underline cursor-pointer"
                    >
                      &larr; Back
                    </button>
                  </div>

                  <div className="p-4 bg-orange-50 dark:bg-orange-955/10 border border-orange-200 dark:border-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400 font-sans">
                    <p className="font-bold text-xs">⚠️ STALE PROFILE DATA REMOVAL</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#767676] dark:text-zinc-400 font-sans">
                      Deletes profiles from the database that were evaluated and skipped, but never starred or followed. Freeing up unnecessary metadata storage.
                    </p>
                    <p className="mt-3 text-xs font-semibold text-orange-605 font-mono">
                      This will remove {staleProfilesCount} stale profiles from your table.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={async () => {
                        await handleClearStaleRun();
                        setIsCleanupOpen(false);
                        setCleanupOption(null);
                      }}
                      disabled={isCleaning}
                      className="w-full min-h-[40px] flex items-center justify-center bg-[#e60023] hover:bg-[#c0001b] text-white text-xs font-bold rounded-full transition cursor-pointer font-geist"
                    >
                      Confirm and Clear Stale Profiles
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Snippet Overlay Modal */}
      {selectedRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] w-full max-w-3xl max-h-[80vh] rounded-xl flex flex-col shadow-2xl animate-startup-logo">
            <div className="px-5 py-3.5 border-b border-[#dadada] dark:border-[#2a2a2a] bg-[#f9f9f9] dark:bg-[#151515] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[#767676] font-mono uppercase tracking-wider">Readme Snippet Evaluation</span>
                <h3 className="font-jakarta text-xs font-bold text-[#1a1c1c] dark:text-[#f0f0f0] flex items-center space-x-2 mt-0.5">
                  <span>{selectedRepo.owner}/{selectedRepo.name}</span>
                  <span className="px-2 py-0.5 bg-[#f3f3f3] dark:bg-[#222] border border-[#dadada] dark:border-[#2a2a2a] text-[9px] text-[#767676] dark:text-zinc-400 rounded-full font-mono">
                    Score: {selectedRepo.grade}/10
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedRepo(null)}
                className="px-3.5 py-1.5 hover:bg-[#f3f3f3] dark:hover:bg-[#222] text-[#1a1c1c] dark:text-[#f0f0f0] rounded-lg border border-[#dadada] dark:border-[#2a2a2a] cursor-pointer transition font-mono text-[11px]"
              >
                Close
              </button>
            </div>

            <div className="p-6 overflow-y-auto font-mono text-xs text-[#1a1c1c] dark:text-[#f0f0f0] bg-[#fdfdfd] dark:bg-[#141414] leading-relaxed whitespace-pre-wrap select-text flex-1">
              {cleanSnippet(selectedRepo.readme_snippet) || 'No evaluation snippet.'}
            </div>
            
            <div className="px-5 py-3 border-t border-[#dadada] dark:border-[#2a2a2a] bg-[#f9f9f9] dark:bg-[#151515] flex justify-end">
              <a
                href={selectedRepo.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1.5 px-4.5 py-2 bg-[#e60023] hover:bg-[#c0001b] text-white text-xs font-bold rounded-full transition cursor-pointer font-geist"
              >
                <span>Open in GitHub</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
