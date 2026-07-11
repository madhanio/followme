'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import mainCharacter from '../../public/animations/main_character.json';
import { triggerWorker, triggerCleanup, getWorkerStatus, triggerStar, triggerUnstar, triggerFollow, triggerUnfollow, triggerLogCleanup, triggerClearStale, triggerDeleteProfile, triggerSyncMutuals, triggerSyncFollowing } from './actions';

// Simple in-memory cache for GitHub stats
const githubStatsCache = new Map<string, { followers: number; following: number }>();
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
  Trash2
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
  const isFollowed = status.followed && !status.follow_back;
  const isUnfollowed = status.unfollowed;
  const isSkipped = status.follow_skipped;
  const isMutual = status.follow_back;

  let badgeColor = "bg-zinc-900 border-zinc-800 text-zinc-400";
  let badgeLabel = "Pending";

  if (isFollowed) {
    badgeColor = "bg-teal-500/10 border-teal-500/25 text-teal-400";
    badgeLabel = "Followed";
  } else if (isMutual) {
    badgeColor = "bg-indigo-500/10 border-indigo-500/25 text-indigo-400 font-bold";
    badgeLabel = "Mutual Follow";
  } else if (isUnfollowed) {
    badgeColor = "bg-rose-500/10 border-rose-500/20 text-rose-400";
    badgeLabel = "Unfollowed";
  } else if (isSkipped) {
    badgeColor = "bg-amber-500/10 border-amber-500/20 text-amber-500";
    badgeLabel = "Skipped";
  }

  return (
    <div className="bg-[#0b0b0d] border border-zinc-900 hover:border-zinc-800 rounded-xl p-4 flex flex-col justify-between min-h-[160px] transition-all duration-300">
      <div>
        <div className="flex items-center space-x-3.5 mb-3">
          <img 
            src={`https://github.com/${profile.owner}.png`} 
            alt={profile.owner} 
            className="h-10 w-10 rounded-full border border-zinc-850 bg-zinc-900 object-cover" 
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://unavatar.io/github/${profile.owner}`;
            }}
          />
          <div className="truncate flex-1">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center space-x-1.5 truncate">
              <span>@{profile.owner}</span>
            </h3>
            <div className="flex items-center space-x-2 text-[10px] font-mono text-zinc-500 mt-0.5">
              {loading ? (
                <span className="animate-pulse">Loading stats...</span>
              ) : stats ? (
                <>
                  <span>{stats.followers} followers</span>
                  <span>•</span>
                  <span>{stats.following} following</span>
                </>
              ) : (
                <span className="text-zinc-650">stats rate-limited</span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-0.5 rounded text-[10px] border font-mono ${badgeColor}`}>
              {badgeLabel}
            </span>
            <button
              onClick={() => onDelete(profile.owner)}
              disabled={isActionLoading}
              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/45 text-rose-400 rounded-lg transition cursor-pointer disabled:opacity-40"
              title="Delete Profile from DB"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {isSkipped && profile.followStatus.reason && (
          <div className="text-[10px] font-mono text-zinc-500 leading-relaxed bg-[#070708] border border-zinc-900/60 p-2 py-1.5 rounded-lg mb-2">
            Reason: {profile.followStatus.reason}
          </div>
        )}
      </div>

      <div className="flex space-x-2 mt-2 pt-2.5 border-t border-zinc-900">
        {isMutual ? (
          <a
            href={`https://github.com/${profile.owner}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-h-[40px] flex items-center justify-center bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 text-xs font-bold rounded-lg cursor-pointer transition uppercase"
          >
            GitHub Profile
          </a>
        ) : isFollowed ? (
          <>
            <button
              onClick={() => onUnfollow(profile.owner)}
              disabled={isActionLoading}
              className="flex-1 min-h-[40px] flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 border border-rose-500/25 text-xs font-bold rounded-lg cursor-pointer transition uppercase disabled:opacity-40"
            >
              Unfollow
            </button>
            <a
              href={`https://github.com/${profile.owner}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 min-h-[40px] flex items-center justify-center bg-zinc-900 hover:bg-zinc-850 text-zinc-350 border border-zinc-800 text-xs font-bold rounded-lg cursor-pointer transition"
            >
              GitHub
            </a>
          </>
        ) : (
          <>
            <button
              onClick={() => onFollow(profile.owner)}
              disabled={isActionLoading}
              className="flex-1 min-h-[40px] flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 text-xs font-bold rounded-lg cursor-pointer transition uppercase disabled:opacity-40"
            >
              Follow
            </button>
            <a
              href={`https://github.com/${profile.owner}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 min-h-[40px] flex items-center justify-center bg-zinc-900 hover:bg-zinc-850 text-zinc-355 border border-zinc-800 text-xs font-bold rounded-lg cursor-pointer transition"
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

  // Local synced state for live queries
  const [repos, setRepos] = useState<Repo[]>(initialRepos);
  const [logs, setLogs] = useState<Log[]>(initialLogs);

  const followedRepos = useMemo(() => {
    return repos.filter(r => r.followed === true && r.unfollowed !== true);
  }, [repos]);

  // Sync state if initialProps change
  useEffect(() => {
    setRepos(initialRepos);
  }, [initialRepos]);

  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);
  
  // Interactive filters
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'followed' | 'starred' | 'skipped' | 'unfollowed' | 'mutual' | null>(null);
  const [activeTab, setActiveTab] = useState<'profiles' | 'repos' | 'logs'>('profiles');

  // Cleanup Assistant states
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);
  const [cleanupOption, setCleanupOption] = useState<'list' | 'logs' | 'stale' | null>(null);
  const [totalLogsCount, setTotalLogsCount] = useState<number>(0);
  const [staleProfilesCount, setStaleProfilesCount] = useState<number>(0);
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

  // Sync Mutuals State
  const [isSyncingMutuals, setIsSyncingMutuals] = useState(false);

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
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('repos')
      .select('id, owner, name, followed_at')
      .eq('followed', true)
      .eq('unfollowed', false)
      .eq('follow_back', false)
      .lte('followed_at', sevenDaysAgo);
    
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
    }
  };

  const fetchStaleProfilesCount = async () => {
    const { count, error } = await supabase
      .from('repos')
      .select('*', { count: 'exact', head: true })
      .eq('followed', false)
      .eq('starred', false)
      .eq('unfollowed', false);
    if (!error && count !== null) {
      setStaleProfilesCount(count);
    }
  };

  // Selected Repo Modal
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);

  useEffect(() => {
    fetchStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // End first mount phase after all startup animations complete (1.2 seconds)
    const timer = setTimeout(() => {
      setIsFirstMount(false);
    }, 1250);
    return () => clearTimeout(timer);
  }, []);

  // Statistics and owner profile resolution
  const allProfiles = useMemo(() => {
    const profilesMap = new Map<string, {
      owner: string;
      reposCount: number;
      avgGrade: number;
      totalGrade: number;
      repos: Repo[];
      followStatus: { followed: boolean; unfollowed: boolean; follow_skipped: boolean; follow_back: boolean; reason: string | null; followed_at: string | null };
    }>();

    // Sort ascending by graded_at so that later records correctly override earlier states
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
      if (status.followed && !status.follow_back) followed++;
      if (status.unfollowed) unfollowed++;
      if (status.follow_skipped) skipped++;
      if (status.follow_back) mutuals++;
    });

    const totalGrade = repos.reduce((acc, r) => acc + (r.grade || 0), 0);
    const avgGrade = total > 0 ? (totalGrade / total) : 0;

    return { total, starred, followed, unfollowed, skipped, avgGrade, mutuals };
  }, [repos, allProfiles]);

  // Apply filters and sorting
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

  // Apply filters to profiles
  const filteredProfiles = useMemo(() => {
    return allProfiles.filter(profile => {
      const matchesSearch = profile.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.repos.some(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()) || (r.topics && r.topics.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))));
      
      if (!matchesSearch) return false;

      if (activeFilter === 'followed') {
        return profile.followStatus.followed && !profile.followStatus.follow_back;
      }
      if (activeFilter === 'skipped') {
        return profile.followStatus.follow_skipped;
      }
      if (activeFilter === 'unfollowed') {
        return profile.followStatus.unfollowed;
      }
      if (activeFilter === 'mutual') {
        return profile.followStatus.follow_back;
      }
      return true;
    });
  }, [allProfiles, searchTerm, activeFilter]);

  const filteredLogs = useMemo(() => {
    return logs;
  }, [logs]);

  // Handle reload action with direct async fetches
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      // Sync follow_back state from GitHub before refreshing local data
      await triggerSyncMutuals();
      // Sync following lists to determine if any we followed were unfollowed
      await triggerSyncFollowing();
      const [reposRes, logsRes] = await Promise.all([
        supabase.from('repos').select('*'),
        supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(50)
      ]);
      if (reposRes.data) setRepos(reposRes.data);
      if (logsRes.data) setLogs(logsRes.data);
      router.refresh();
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle manual mutuals sync
  const handleSyncMutuals = async () => {
    if (isSyncingMutuals) return;
    setIsSyncingMutuals(true);
    try {
      await triggerSyncMutuals();
      // Reload repos so follow_back changes are reflected immediately
      const reposRes = await supabase.from('repos').select('*');
      if (reposRes.data) setRepos(reposRes.data);
      router.refresh();
    } catch (err) {
      console.error('Mutuals sync failed:', err);
    } finally {
      setIsSyncingMutuals(false);
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
      fetchStatus();
    }
  };

  // Handle cleanup standalone run
  const handleCleanupRun = async () => {
    if (isCleaning) return;
    setIsCleaning(true);
    setCleanupStatus(null);

    const result = await triggerCleanup();

    setIsCleaning(false);
    setCleanupStatus({ success: result.success, message: result.success ? result.message : result.error });

    if (result.success) {
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
        console.error("Post-cleanup refresh failed:", err);
      } finally {
        setIsRefreshing(false);
      }
      fetchStatus();
    }
  };

  // Handle logs cleanup run
  const handleLogCleanupRun = async () => {
    if (isCleaning) return;
    setIsCleaning(true);
    setCleanupStatus(null);

    const result = await triggerLogCleanup();

    setIsCleaning(false);
    setCleanupStatus({ success: result.success, message: result.success ? result.message : result.error });

    if (result.success) {
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
        console.error("Post-log cleanup refresh failed:", err);
      } finally {
        setIsRefreshing(false);
      }
      fetchStatus();
    }
  };

  // Handle clearing stale profiles run
  const handleClearStaleRun = async () => {
    if (isCleaning) return;
    setIsCleaning(true);
    setCleanupStatus(null);

    const result = await triggerClearStale();

    setIsCleaning(false);
    setCleanupStatus({ success: result.success, message: result.success ? result.message : result.error });

    if (result.success) {
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
        console.error("Post-stale cleanup refresh failed:", err);
      } finally {
        setIsRefreshing(false);
      }
      fetchStatus();
    }
  };
  // Handle manual unstar
  const handleUnstar = async (owner: string, name: string) => {
    const previousRepos = [...repos];
    setRepos(prev => prev.map(r => r.owner === owner && r.name === name ? { ...r, starred: false } : r));
    
    try {
      const res = await triggerUnstar(owner, name);
      if (res.success) {
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(50);
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

  // Handle manual unfollow
  const handleUnfollowUser = async (username: string) => {
    const previousRepos = [...repos];
    setRepos(prev => prev.map(r => r.owner.toLowerCase() === username.toLowerCase() ? { ...r, followed: false, unfollowed: true } : r));
    
    try {
      const res = await triggerUnfollow(username);
      if (res.success) {
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(50);
        if (logsRes.data) setLogs(logsRes.data);
      } else {
        setRepos(previousRepos);
        alert(`Failed to unfollow: ${res.error}`);
      }
    } catch (err: any) {
      setRepos(previousRepos);
      alert(`Failed to unfollow: ${err.message || err}`);
    }
  };

  // Handle manual follow
  const handleFollowUser = async (username: string) => {
    const previousRepos = [...repos];
    setRepos(prev => prev.map(r => r.owner.toLowerCase() === username.toLowerCase() ? { ...r, followed: true, unfollowed: false, followed_at: new Date().toISOString() } : r));
    
    try {
      const res = await triggerFollow(username);
      if (res.success) {
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(50);
        if (logsRes.data) setLogs(logsRes.data);
      } else {
        setRepos(previousRepos);
        alert(`Failed to follow: ${res.error}`);
      }
    } catch (err: any) {
      setRepos(previousRepos);
      alert(`Failed to follow: ${err.message || err}`);
    }
  };

  // Handle manual star
  const handleStar = async (owner: string, name: string) => {
    const previousRepos = [...repos];
    setRepos(prev => prev.map(r => r.owner === owner && r.name === name ? { ...r, starred: true } : r));
    
    try {
      const res = await triggerStar(owner, name);
      if (res.success) {
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(50);
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

  // Handle manual profile deletion from DB
  const handleDeleteProfile = async (username: string) => {
    if (!confirm(`Are you sure you want to permanently delete @${username} and all of their repositories from the database?`)) {
      return;
    }
    const previousRepos = [...repos];
    setRepos(prev => prev.filter(r => r.owner.toLowerCase() !== username.toLowerCase()));
    
    try {
      const res = await triggerDeleteProfile(username);
      if (res.success) {
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(50);
        if (logsRes.data) setLogs(logsRes.data);
      } else {
        setRepos(previousRepos);
        alert(`Failed to delete profile: ${res.error}`);
      }
    } catch (err: any) {
      setRepos(previousRepos);
      alert(`Failed to delete profile: ${err.message || err}`);
    }
  };

  const [isActionLoading, setIsActionLoading] = useState(false);
  // Grade color ramp (green -> sky -> yellow -> red) with blurred pill refinements
  const getGradeColor = (grade: number) => {
    if (grade >= 8) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm font-bold text-[10px] font-mono tracking-wider';
    if (grade >= 6) return 'bg-sky-500/10 text-sky-400 border border-sky-500/25 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm font-bold text-[10px] font-mono tracking-wider';
    if (grade >= 4) return 'bg-amber-500/10 text-amber-500 border border-amber-500/25 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm font-bold text-[10px] font-mono tracking-wider';
    return 'bg-rose-500/10 text-rose-500 border border-rose-500/25 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm font-bold text-[10px] font-mono tracking-wider';
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
      `}</style>      {/* Top Banner Details */}
      <header className="border-b border-zinc-900 bg-[#0c0c0e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className={`flex items-center space-x-3 ${isFirstMount ? 'animate-startup-logo' : ''}`}>
            <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-zinc-805 flex items-center justify-center shadow-inner">
              <GithubIcon className="h-5 w-5 text-zinc-300" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                FollowMe <span className="text-[10px] tracking-widest uppercase font-mono px-2 py-0.5 border border-zinc-700 bg-zinc-800/40 text-zinc-550 rounded font-normal">Beta</span>
              </h1>
              <p className="text-xs text-zinc-500 font-mono">Automated discovery & active peer evaluation</p>
              
              {/* Worker Status strip */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] text-zinc-400 mt-2.5">
                {(() => {
                  const getLiveIndicator = () => {
                    if (!workerStatus) return { label: 'Unknown', color: 'bg-zinc-500 text-zinc-450' };
                    if (workerStatus.isJobRunning) return { label: 'Running', color: 'bg-amber-500 text-amber-450 animate-pulse' };
                    if (workerStatus.consecutiveFailures > 0) return { label: 'Failed', color: 'bg-rose-500 text-rose-455 font-bold' };
                    return { label: 'Idle', color: 'bg-emerald-500 text-emerald-400' };
                  };
                  const ind = getLiveIndicator();
                  return (
                    <span className="flex items-center space-x-1.5 mr-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${ind.color.split(' ')[0]}`} />
                      <span className={`font-bold uppercase tracking-wider ${ind.color.split(' ')[1]}`}>{ind.label}</span>
                    </span>
                  );
                })()}
                
                <span className="text-zinc-800">•</span>
                <span>
                  Last: {(() => {
                    const lastSuccessLog = logs.find(l => l.action === 'SYSTEM' && l.status === 'SUCCESS' && l.message?.includes('finished'));
                    if (!lastSuccessLog) return 'Never';
                    
                    const ms = Date.now() - new Date(lastSuccessLog.timestamp).getTime();
                    const minutes = Math.floor(ms / (1000 * 60));
                    const hours = Math.floor(minutes / 60);
                    const days = Math.floor(hours / 24);
                    
                    if (days > 0) return `${days}d ago`;
                    if (hours > 0) return `${hours}h ago`;
                    if (minutes > 0) return `${minutes}m ago`;
                    return 'Just now';
                  })()}
                </span>

                <span className="text-zinc-800">•</span>
                <span>
                  Next: {(() => {
                    if (!workerStatus?.lastRun) return '~6h interval';
                    const nextRun = new Date(new Date(workerStatus.lastRun).getTime() + 6 * 60 * 60 * 1000);
                    const diffMs = nextRun.getTime() - Date.now();
                    if (diffMs <= 0) return 'soon';
                    const diffMins = Math.floor(diffMs / (1000 * 60));
                    const h = Math.floor(diffMins / 60);
                    const m = diffMins % 60;
                    return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
                  })()}
                </span>
              </div>
            </div>
          </div>
 
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={handleSyncMutuals}
              disabled={isSyncingMutuals || workerStatus?.isJobRunning}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-mono font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition flex items-center justify-center min-h-[44px]"
            >
              {isSyncingMutuals ? (
                <><RotateCw className="h-3 w-3 animate-spin mr-1" />Syncing...</>
              ) : (
                <>🔁 Sync Mutuals</>
              )}
            </button>
            <button
              onClick={() => setIsCleanupOpen(true)}
              disabled={workerStatus?.isJobRunning}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-mono font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition flex items-center justify-center min-h-[44px]"
            >
              🧹 Run Cleanup
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isSyncingMutuals}
              className="p-2 text-zinc-400 hover:text-white rounded-lg border border-zinc-800 bg-[#0f0f11] hover:bg-zinc-900 transition-all cursor-pointer flex items-center justify-center disabled:opacity-50"
              title="Refresh Dashboard Data (also syncs mutuals)"
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
 
      <section className="bg-[#0b0b0d] border-b border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            
            {/* Stat Card 1 */}
            <div 
              onClick={() => {
                setActiveTab('repos');
                setActiveFilter(null);
                const mainEl = document.querySelector('main');
                if (mainEl) mainEl.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/10 rounded-xl p-4 cursor-pointer select-none transition flex flex-col justify-between min-h-[90px] ${isFirstMount ? 'animate-startup-stat' : ''}`}
              style={isFirstMount ? { animationDelay: '150ms' } : {}}
            >
              <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-550 block">Total Graded</span>
              <span className="text-3xl font-extrabold text-white tracking-tight mt-1">
                {isRefreshing ? (
                  <span className="h-6 w-10 bg-zinc-850 rounded animate-pulse inline-block mt-1"></span>
                ) : (
                  <AnimatedCounter value={stats.total} active={isFirstMount} />
                )}
              </span>
            </div>
 
            {/* Stat Card 2 */}
            <div 
              className={`bg-zinc-950/40 border border-zinc-900 rounded-xl p-4 select-none flex flex-col justify-between min-h-[90px] ${isFirstMount ? 'animate-startup-stat' : ''}`}
              style={isFirstMount ? { animationDelay: '210ms' } : {}}
            >
              <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-550 block">Avg Quality</span>
              <span className="text-2xl font-bold text-white tracking-tight mt-1 flex items-baseline">
                {isRefreshing ? (
                  <span className="h-6 w-12 bg-zinc-850 rounded animate-pulse inline-block mt-1"></span>
                ) : (
                  <>
                    <AnimatedDecimalCounter value={stats.avgGrade} active={isFirstMount} />
                    <span className="text-xs text-zinc-650 ml-1">/10</span>
                  </>
                )}
              </span>
            </div>
 
            {/* Stat Card 3 */}
            <div 
              onClick={() => {
                setActiveTab('repos');
                setActiveFilter('starred');
                const mainEl = document.querySelector('main');
                if (mainEl) mainEl.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/10 rounded-xl p-4 cursor-pointer select-none transition flex flex-col justify-between min-h-[90px] ${isFirstMount ? 'animate-startup-stat' : ''}`}
              style={isFirstMount ? { animationDelay: '270ms' } : {}}
            >
              <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-550 block">Starred</span>
              <span className="text-2xl font-bold text-emerald-400 mt-1 flex items-center justify-between">
                {isRefreshing ? (
                  <span className="h-6 w-8 bg-zinc-850 rounded animate-pulse inline-block mt-1"></span>
                ) : (
                  <>
                    <AnimatedCounter value={stats.starred} active={isFirstMount} />
                    <Star className="h-4 w-4 fill-emerald-400/20 text-emerald-400" />
                  </>
                )}
              </span>
            </div>
 
            {/* Stat Card 4 */}
            <div 
              onClick={() => {
                setActiveTab('profiles');
                setActiveFilter('followed');
                const mainEl = document.querySelector('main');
                if (mainEl) mainEl.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/10 rounded-xl p-4 cursor-pointer select-none transition flex flex-col justify-between min-h-[90px] ${isFirstMount ? 'animate-startup-stat' : ''}`}
              style={isFirstMount ? { animationDelay: '330ms' } : {}}
            >
              <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-550 block">Followed</span>
              <span className="text-2xl font-bold text-emerald-400 mt-1 flex items-center justify-between">
                {isRefreshing ? (
                  <span className="h-6 w-8 bg-zinc-850 rounded animate-pulse inline-block mt-1"></span>
                ) : (
                  <>
                    <AnimatedCounter value={stats.followed} active={isFirstMount} />
                    <UserPlus className="h-4 w-4 text-emerald-400" />
                  </>
                )}
              </span>
            </div>
 
            {/* Stat Card 5 */}
            <div 
              onClick={() => {
                setActiveTab('profiles');
                setActiveFilter('mutual');
                const mainEl = document.querySelector('main');
                if (mainEl) mainEl.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/10 rounded-xl p-4 cursor-pointer select-none transition flex flex-col justify-between min-h-[90px] ${isFirstMount ? 'animate-startup-stat' : ''}`}
              style={isFirstMount ? { animationDelay: '390ms' } : {}}
            >
              <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-550 block">Mutuals</span>
              <span className="text-2xl font-bold text-zinc-400 mt-1 flex items-center justify-between">
                {isRefreshing ? (
                  <span className="h-6 w-8 bg-zinc-850 rounded animate-pulse inline-block mt-1"></span>
                ) : (
                  <>
                    <AnimatedCounter value={stats.mutuals} active={isFirstMount} />
                    <CheckCircle className="h-4 w-4 text-zinc-500" />
                  </>
                )}
              </span>
            </div>
 
            {/* Stat Card 6 */}
            <div 
              onClick={() => {
                setActiveTab('profiles');
                setActiveFilter('unfollowed');
                const mainEl = document.querySelector('main');
                if (mainEl) mainEl.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/10 rounded-xl p-4 cursor-pointer select-none transition flex flex-col justify-between min-h-[90px] ${isFirstMount ? 'animate-startup-stat' : ''}`}
              style={isFirstMount ? { animationDelay: '450ms' } : {}}
            >
              <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-550 block">Unfollowed</span>
              <span className="text-2xl font-bold text-zinc-500 mt-1 flex items-center justify-between">
                {isRefreshing ? (
                  <span className="h-6 w-8 bg-zinc-850 rounded animate-pulse inline-block mt-1"></span>
                ) : (
                  <>
                    <AnimatedCounter value={stats.unfollowed} active={isFirstMount} />
                    <UserMinus className="h-4 w-4 text-zinc-650" />
                  </>
                )}
              </span>
            </div>
 
            {/* Stat Card 7 */}
            <div 
              onClick={() => {
                setActiveTab('profiles');
                setActiveFilter('skipped');
                const mainEl = document.querySelector('main');
                if (mainEl) mainEl.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/10 rounded-xl p-4 cursor-pointer select-none transition flex flex-col justify-between min-h-[90px] ${isFirstMount ? 'animate-startup-stat' : ''}`}
              style={isFirstMount ? { animationDelay: '510ms' } : {}}
            >
              <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-550 block">Skipped</span>
              <span className="text-2xl font-bold text-amber-500 mt-1 flex items-center justify-between">
                {isRefreshing ? (
                  <span className="h-6 w-8 bg-zinc-850 rounded animate-pulse inline-block mt-1"></span>
                ) : (
                  <>
                    <AnimatedCounter value={stats.skipped} active={isFirstMount} />
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
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
            onClick={() => {
              setActiveTab('profiles');
              setActiveFilter(null);
            }}
            className={`px-5 py-3 font-mono text-xs uppercase tracking-wider transition-all border-b-2 flex items-center space-x-2 cursor-pointer ${
              activeTab === 'profiles' 
                ? 'border-teal-500 text-white font-bold' 
                : 'border-transparent text-zinc-500 hover:text-zinc-200'
            }`}
          >
            <span>Profiles ({filteredProfiles.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('repos');
              setActiveFilter(null);
            }}
            className={`px-5 py-3 font-mono text-xs uppercase tracking-wider transition-all border-b-2 flex items-center space-x-2 cursor-pointer ${
              activeTab === 'repos' 
                ? 'border-teal-500 text-white font-bold' 
                : 'border-transparent text-zinc-500 hover:text-zinc-200'
            }`}
          >
            <span>Repos ({filteredRepos.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-5 py-3 font-mono text-xs uppercase tracking-wider transition-all border-b-2 flex items-center space-x-2 cursor-pointer ${
              activeTab === 'logs' 
                ? 'border-teal-500 text-white font-bold' 
                : 'border-transparent text-zinc-500 hover:text-zinc-200'
            }`}
          >
            <span>Logs ({logs.length})</span>
          </button>
        </div>

        {/* Simplified Search Bar (Only shown for profiles & repos tabs) */}
        {activeTab !== 'logs' && (
          <div className="space-y-4">
            <div className="bg-[#0b0b0d] border border-zinc-900 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3.5 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search profiles or repos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full min-h-[44px] bg-[#070708] border border-zinc-800 focus:border-indigo-500/80 rounded-lg py-2.5 pl-10 pr-4 text-xs font-mono text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                />
              </div>

              {(searchTerm || activeFilter) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setActiveFilter(null);
                  }}
                  className="min-h-[44px] flex items-center justify-center px-4 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs uppercase font-bold font-mono transition cursor-pointer"
                >
                  Clear Filter
                </button>
              )}
            </div>

            {/* Active filter pill display */}
            {activeFilter && (
              <div className="flex items-center space-x-2 animate-fade-in-up">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Active Filter:</span>
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-full text-[11px] font-mono font-semibold">
                  <span className="capitalize">{activeFilter === 'mutual' ? 'Mutual Follows' : activeFilter}</span>
                  <button 
                    onClick={() => setActiveFilter(null)}
                    className="text-teal-400 hover:text-white font-bold cursor-pointer text-xs leading-none"
                  >
                    ×
                  </button>
                </span>
              </div>
            )}
          </div>
        )}

        {/* PROFILES Tab Content */}
        {activeTab === 'profiles' && (
          <div className="space-y-6">
            {isRefreshing ? (
              <div className="grid grid-cols-1 gap-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="bg-[#0b0b0d] border border-zinc-900 rounded-xl p-5 h-[200px] animate-pulse"></div>
                ))}
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 w-full bg-[#0b0b0d] border border-zinc-900 rounded-xl">
                <div className="w-48 h-48 flex items-center justify-center">
                  <Lottie animationData={mainCharacter} loop={true} className="w-48 h-48" />
                </div>
                <p className="text-zinc-555 font-mono text-sm tracking-wider">No profiles match this query or filter</p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setActiveFilter(null);
                  }}
                  className="px-4 py-2 mt-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all font-mono text-xs cursor-pointer bg-transparent min-h-[44px]"
                >
                  Clear Filter
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {filteredProfiles.map((profile) => (
                  <ProfileCard
                    key={profile.owner}
                    profile={profile}
                    onFollow={handleFollowUser}
                    onUnfollow={handleUnfollowUser}
                    onDelete={handleDeleteProfile}
                    isActionLoading={isActionLoading}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* REPOS Tab Content */}
        {activeTab === 'repos' && (
          <div className="space-y-6">
            {isRefreshing ? (
              <div className="grid grid-cols-1 gap-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="bg-[#0b0b0d] border border-zinc-900 rounded-xl p-5 h-[180px] animate-pulse"></div>
                ))}
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 w-full bg-[#0b0b0d] border border-zinc-900 rounded-xl">
                <div className="w-48 h-48 flex items-center justify-center">
                  <Lottie animationData={mainCharacter} loop={true} className="w-48 h-48" />
                </div>
                <p className="text-zinc-555 font-mono text-sm tracking-wider">No repositories match this query or filter</p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setActiveFilter(null);
                  }}
                  className="px-4 py-2 mt-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all font-mono text-xs cursor-pointer bg-transparent min-h-[44px]"
                >
                  Clear Filter
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {filteredRepos.map((repo) => (
                  <div 
                    key={repo.id} 
                    className="bg-[#0b0b0d] border border-zinc-900 hover:border-zinc-800 rounded-xl p-5 flex flex-col justify-between transition-all duration-300 min-h-[180px]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="truncate flex-1">
                          <h3 className="text-base font-bold text-zinc-100 flex items-center space-x-1.5 truncate">
                            <span>{repo.name}</span>
                          </h3>
                          <span className="text-xs text-zinc-500 font-mono block mt-0.5">@{repo.owner}</span>
                        </div>
                        <span className={getGradeColor(repo.grade)}>
                          Grade: {repo.grade.toFixed(1)}/10
                        </span>
                      </div>

                      {repo.readme_snippet && (
                        <div className="text-xs text-zinc-400 bg-[#070708] border border-zinc-900/60 p-2.5 rounded-lg font-mono line-clamp-2 leading-relaxed mb-4">
                          {cleanSnippet(repo.readme_snippet).split('\n').filter(line => line.trim() !== '')[0] || 'No readme description.'}
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-2 mt-4 pt-3.5 border-t border-zinc-900">
                      {repo.starred ? (
                        <button
                          onClick={() => handleUnstar(repo.owner, repo.name)}
                          disabled={isActionLoading}
                          className="flex-1 min-h-[44px] flex items-center justify-center bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 text-xs font-bold rounded-lg cursor-pointer transition uppercase disabled:opacity-40"
                        >
                          ★ Unstar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStar(repo.owner, repo.name)}
                          disabled={isActionLoading}
                          className="flex-1 min-h-[44px] flex items-center justify-center bg-[#072517] hover:bg-[#0d3b25] text-emerald-400 border border-emerald-900 text-xs font-bold rounded-lg cursor-pointer transition uppercase disabled:opacity-40"
                        >
                          ☆ Star
                        </button>
                      )}
                      
                      {repo.readme_snippet && (
                        <button
                          onClick={() => setSelectedRepo(repo)}
                          className="px-3 min-h-[44px] flex items-center justify-center bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 text-xs font-mono font-bold rounded-lg cursor-pointer transition uppercase"
                        >
                          Readme
                        </button>
                      )}

                      <a
                        href={repo.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 min-h-[44px] flex items-center justify-center bg-zinc-900 hover:bg-zinc-850 text-zinc-350 border border-zinc-800 text-xs font-bold rounded-lg cursor-pointer transition uppercase"
                      >
                        GitHub
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
          {activeTab === 'logs' && (
          /* Mono activity logs */
          <div className="bg-[#0b0b0d] border border-zinc-900 rounded-xl overflow-hidden animate-fade-in-up">
            <div className="px-5 py-4 border-b border-zinc-900 bg-[#0c0c0e]">
              <h3 className="font-mono text-xs font-semibold text-zinc-300 uppercase tracking-wider">Historical Logs</h3>
              <span className="text-[10px] font-mono text-zinc-550">Last 50 entries</span>
            </div>

            <div className="p-4 space-y-3 bg-[#070708]/80 min-h-[400px]">
              {isRefreshing ? (
                [1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="p-4 bg-zinc-950/20 border border-zinc-900/60 rounded-xl animate-pulse flex flex-col space-y-2">
                    <div className="h-4 bg-zinc-850 rounded w-1/4"></div>
                    <div className="h-3 bg-zinc-900 rounded w-3/4"></div>
                  </div>
                ))
              ) : filteredLogs.length === 0 ? (
                <div className="py-12 text-center text-zinc-650 font-mono text-xs">
                  No operations logged.
                </div>
              ) : (
                [...filteredLogs]
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map((log) => {
                    const getLogContextualLabel = () => {
                      if (log.action === 'SYSTEM') {
                        if (log.status === 'ERROR') {
                          const getExplanation = (message: string) => {
                            const msg = message.toLowerCase();
                            if (msg.includes('rate limit') || msg.includes('403') || msg.includes('429')) return 'GitHub API rate limit hit';
                            if (msg.includes('timeout') || msg.includes('nim') || msg.includes('openai') || msg.includes('timed out')) return 'NVIDIA NIM API timed out';
                            if (msg.includes('supabase') || msg.includes('database') || msg.includes('connection')) return 'Database connection failed';
                            return 'Unexpected failure';
                          };
                          return <span className="text-rose-500 font-bold">✗ Failed: {getExplanation(log.message || '')}</span>;
                        }
                        if (log.status === 'WARN') {
                          return <span className="text-amber-500 font-bold">⚠ Retrying: Recoverable error</span>;
                        }
                        
                        const msg = log.message || '';
                        const containsRun = msg.includes('Automation job') || msg.includes('finished') || msg.includes('Graded');
                        const containsCleanup = msg.includes('Cleanup');
                        
                        if (containsRun && containsCleanup) {
                          return <span className="text-emerald-500 font-bold">✓ Run + Cleanup Success</span>;
                        }
                        if (containsRun) {
                          return <span className="text-emerald-500 font-bold">✓ Run Success</span>;
                        }
                        if (containsCleanup) {
                          return <span className="text-emerald-500 font-bold">✓ Cleanup Success</span>;
                        }
                      }
                      
                      if (log.status === 'SUCCESS') {
                        return <span className="text-emerald-500 font-bold">✓ SUCCESS</span>;
                      }
                      return <span className="text-rose-500 font-bold">✗ FAILED</span>;
                    };

                    return (
                      <div key={log.id} className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl flex flex-col space-y-2 text-zinc-300 font-mono text-xs">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] border font-bold ${
                            log.action === 'SYSTEM' ? 'bg-zinc-900 border-zinc-800 text-zinc-400' :
                            log.action === 'GRADE' ? 'bg-indigo-950/40 border-indigo-900/30 text-indigo-400' :
                            log.action === 'STAR' ? 'bg-amber-950/40 border-amber-900/30 text-amber-400' :
                            log.action === 'FOLLOW' ? 'bg-teal-950/40 border-teal-900/30 text-teal-400' :
                            log.action === 'SKIP_FOLLOW' ? 'bg-amber-950/20 border-amber-900/30 text-amber-550' :
                            log.action === 'UNSTAR' ? 'bg-rose-950/20 border-rose-900/30 text-rose-455' :
                            log.action === 'UNFOLLOW' ? 'bg-rose-950/20 border-rose-900/30 text-rose-455' :
                            'bg-zinc-900/40 border-zinc-850 text-zinc-450'
                          }`}>
                            {log.action}
                          </span>
                          <span className="text-zinc-600 text-[10px]">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-col space-y-1 mt-1">
                          <div className="font-semibold text-zinc-200">
                            {getLogContextualLabel()}
                          </div>
                          <div className="text-zinc-400 leading-relaxed break-all">
                            {log.message}
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}
      </main>

      {/* Global Error Banner Panel (If latest SYSTEM log has status = ERROR) */}
      {(() => {
        const latestSystemLog = logs.find(l => l.action === 'SYSTEM');
        const isError = latestSystemLog && latestSystemLog.status === 'ERROR';
        if (!isError) return null;

        const getErrorExplanation = (message: string) => {
          const msg = message.toLowerCase();
          if (msg.includes('rate limit') || msg.includes('403') || msg.includes('429')) {
            return 'GitHub API rate limit hit, wait 1 hour';
          }
          if (msg.includes('timeout') || msg.includes('nim') || msg.includes('llama') || msg.includes('openai') || msg.includes('timed out')) {
            return 'NVIDIA NIM API timed out, will retry next run';
          }
          if (msg.includes('supabase') || msg.includes('database') || msg.includes('postgres') || msg.includes('connection')) {
            return 'Database connection failed, check Supabase status';
          }
          return 'An unexpected error occurred during execution';
        };

        const explanation = getErrorExplanation(latestSystemLog.message || '');

        return (
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 mb-6 animate-fade-in-up">
            <div className="bg-rose-955/15 border border-rose-900/35 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 font-mono">
                <div className="flex items-center space-x-2 text-rose-455">
                  <ShieldAlert className="h-4 w-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    System Failure Alert
                  </h4>
                </div>
                <p className="text-[11px] text-zinc-400 mt-2">
                  <strong>Raw Log:</strong> {latestSystemLog.message}
                </p>
                <p className="text-[11px] text-rose-400 mt-1 font-bold">
                  <strong>Root Cause:</strong> {explanation}
                </p>
              </div>
              <div>
                <button
                  onClick={handleTrigger}
                  disabled={isTriggering || (workerStatus?.isJobRunning)}
                  className="px-4 py-2 bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800 disabled:opacity-50 text-xs font-mono font-semibold rounded transition cursor-pointer whitespace-nowrap"
                >
                  Retry Now
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Simple Footer */}
      <footer className="mt-auto border-t border-zinc-950 bg-[#060607] py-6 text-center text-[10px] font-mono text-zinc-650">
        <p>FollowMe Dashboard — Verified evaluation runs logged in real time</p>
      </footer>



      {/* Cleanup assistant modal */}
      {isCleanupOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0b0b0d] border-t sm:border border-zinc-800 w-full sm:max-w-2xl h-[92vh] sm:h-auto sm:max-h-[85vh] rounded-t-2xl sm:rounded-xl flex flex-col shadow-2xl animate-startup-logo overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-900 bg-[#0c0c0e] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-550 font-mono uppercase tracking-wider">Maintenance</span>
                <h3 className="font-mono text-xs font-bold text-zinc-100 uppercase tracking-widest mt-0.5">
                  Cleanup Assistant
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsCleanupOpen(false);
                  setCleanupOption(null);
                }}
                className="text-zinc-550 hover:text-white font-mono text-xs px-3.5 py-2 hover:bg-zinc-900 rounded-lg border border-zinc-850 cursor-pointer transition min-h-[44px] flex items-center"
              >
                Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
              {cleanupOption === null ? (
                <div className="space-y-4">
                  <p className="text-zinc-400 font-sans text-xs">Select a maintenance task:</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Option 1: Regular Cleanup */}
                    <div className="p-4 bg-[#0c0c0e] border border-zinc-900 rounded-xl hover:border-zinc-800 transition flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="font-bold text-zinc-100 text-xs">1. Bulk Unfollow</h4>
                        <p className="text-zinc-500 text-[11px] mt-1 font-sans leading-relaxed">
                          Unfollows anyone followed &gt;7 days ago who has not followed back.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          handleCleanupRun();
                          setIsCleanupOpen(false);
                        }}
                        disabled={isCleaning}
                        className="w-full min-h-[40px] flex items-center justify-center bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border border-zinc-800 text-xs font-bold rounded-lg transition cursor-pointer disabled:opacity-50"
                      >
                        Run Bulk Cleanup
                      </button>
                    </div>

                    {/* Option 2: Preview & Unfollow List */}
                    <div className="p-4 bg-[#0c0c0e] border border-zinc-900 rounded-xl hover:border-zinc-800 transition flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="font-bold text-zinc-100 text-xs">2. Selective Unfollow</h4>
                        <p className="text-zinc-500 text-[11px] mt-1 font-sans leading-relaxed">
                          Preview eligible developers to unfollow them selectively or in bulk.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          fetchUnfollowList();
                          setCleanupOption('list');
                        }}
                        className="w-full min-h-[40px] flex items-center justify-center bg-zinc-900 hover:bg-zinc-850 text-zinc-205 border border-zinc-800 text-xs font-bold rounded-lg transition cursor-pointer"
                      >
                        Preview & Select
                      </button>
                    </div>

                    {/* Option 3: Log Cleanup */}
                    <div className="p-4 bg-[#0c0c0e] border border-zinc-900 rounded-xl hover:border-zinc-800 transition flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="font-bold text-teal-400 text-xs">3. Log Cleanup</h4>
                        <p className="text-zinc-500 text-[11px] mt-1 font-sans leading-relaxed">
                          Purges old logs history to save database storage, keeping the top 200 logs.
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          await fetchTotalLogsCount();
                          setCleanupOption('logs');
                        }}
                        className="w-full min-h-[40px] flex items-center justify-center bg-teal-950/20 hover:bg-teal-905/30 text-teal-400 border border-teal-900/40 text-xs font-bold rounded-lg transition cursor-pointer"
                      >
                        Configure Logs
                      </button>
                    </div>

                    {/* Option 4: Clear Stale Profiles */}
                    <div className="p-4 bg-[#0c0c0e] border border-zinc-900 rounded-xl hover:border-zinc-800 transition flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="font-bold text-amber-400 text-xs">4. Clear Stale Profiles</h4>
                        <p className="text-zinc-500 text-[11px] mt-1 font-sans leading-relaxed">
                          Deletes discovered profiles that were skipped and never starred or followed.
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          await fetchStaleProfilesCount();
                          setCleanupOption('stale');
                        }}
                        className="w-full min-h-[40px] flex items-center justify-center bg-amber-955/20 hover:bg-amber-900/30 text-amber-300 border border-amber-900/40 text-xs font-bold rounded-lg transition cursor-pointer"
                      >
                        Clear Stale Data
                      </button>
                    </div>
                  </div>
                </div>
              ) : cleanupOption === 'list' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-zinc-200 uppercase tracking-widest text-[10px]">
                      Users eligible for cleanup
                    </h4>
                    <button
                      onClick={() => setCleanupOption(null)}
                      className="text-zinc-550 hover:text-zinc-300 text-[10px] min-h-[44px] flex items-center px-3 bg-zinc-900 border border-zinc-800 rounded-lg"
                    >
                      &larr; Back
                    </button>
                  </div>

                  {isFetchingUnfollowList ? (
                    <div className="py-8 text-center text-zinc-550">Fetching candidates list...</div>
                  ) : unfollowList.length === 0 ? (
                    <div className="py-8 text-center text-zinc-650 font-semibold">No users match the cleanup criteria right now.</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                        {unfollowList.map(user => (
                          <div key={user.id} className="p-3.5 bg-[#0c0c0e] border border-zinc-900 rounded-xl flex items-center justify-between gap-3 text-zinc-300">
                            <div>
                              <span className="font-bold text-zinc-200 block text-xs">{user.owner}</span>
                              <span className="text-[10px] text-zinc-550 block mt-0.5">Followed: {new Date(user.followed_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={async () => {
                                  await handleUnfollowUser(user.owner);
                                  setUnfollowList(prev => prev.filter(u => u.owner !== user.owner));
                                }}
                                className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-bold min-h-[44px] cursor-pointer"
                              >
                                Unfollow
                              </button>
                              <a
                                href={`https://github.com/${user.owner}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-350 border border-zinc-800 rounded-lg text-xs font-bold min-h-[44px] flex items-center"
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
                          className="w-full min-h-[44px] flex items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-250 hover:bg-zinc-850 hover:text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
                        >
                          Unfollow All ({unfollowList.length})
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : cleanupOption === 'logs' ? (
                <div className="space-y-4 font-mono">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-teal-400 uppercase tracking-widest text-[10px]">
                      Logs Cleanup Confirmation
                    </h4>
                    <button
                      onClick={() => setCleanupOption(null)}
                      className="text-zinc-550 hover:text-zinc-300 text-[10px] min-h-[44px] flex items-center px-3 bg-zinc-900 border border-zinc-800 rounded-lg"
                    >
                      &larr; Back
                    </button>
                  </div>

                  <div className="p-4 bg-teal-955/10 border border-teal-900/40 rounded-xl text-teal-300">
                    <p className="font-bold text-xs">ℹ️ LOGS TABLE CLEANUP</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-400 font-sans">
                      This action will delete all old worker logs except for the latest 200 entries. It will not alter repository evaluation scores or follower details.
                    </p>
                    <p className="mt-3 text-xs font-semibold text-teal-400 font-mono">
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
                      className="w-full min-h-[44px] flex items-center justify-center bg-teal-950 hover:bg-teal-900 text-teal-200 border border-teal-900 text-xs font-bold rounded-lg transition cursor-pointer"
                    >
                      Confirm and Delete Logs
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 font-mono">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-amber-400 uppercase tracking-widest text-[10px]">
                      Stale Profiles Cleanup
                    </h4>
                    <button
                      onClick={() => setCleanupOption(null)}
                      className="text-zinc-550 hover:text-zinc-300 text-[10px] min-h-[44px] flex items-center px-3 bg-zinc-900 border border-zinc-800 rounded-lg"
                    >
                      &larr; Back
                    </button>
                  </div>

                  <div className="p-4 bg-amber-955/10 border border-amber-900/40 rounded-xl text-amber-300">
                    <p className="font-bold text-xs">ℹ️ STALE PROFILE DATA REMOVAL</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-400 font-sans">
                      Deletes profiles from the database that were evaluated and skipped, but never starred or followed. Freeing up unnecessary metadata storage.
                    </p>
                    <p className="mt-3 text-xs font-semibold text-amber-405 font-mono">
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
                      className="w-full min-h-[44px] flex items-center justify-center bg-amber-950 hover:bg-amber-900 text-amber-200 border border-amber-900 text-xs font-bold rounded-lg transition cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b0b0d] border border-zinc-800 w-full max-w-3xl max-h-[80vh] rounded-xl flex flex-col shadow-2xl animate-startup-logo">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-zinc-900 bg-[#0c0c0e] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-550 font-mono uppercase tracking-wider">Readme snippet evaluation</span>
                <h3 className="font-mono text-xs font-bold text-zinc-100 flex items-center space-x-2 mt-0.5">
                  <span>{selectedRepo.owner}/{selectedRepo.name}</span>
                  <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-850 text-[9px] text-zinc-400 rounded">
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
