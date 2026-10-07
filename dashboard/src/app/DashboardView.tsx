'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, fetchAllRows } from '@/lib/supabase';
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
  triggerSyncFollowing,
  saveSystemSettings,
  getGitHubRateLimit,
  sendTestAlertEmail,
  checkSystemHealth
} from './actions';
import type { 
  Repo, 
  Log, 
  RunSummary, 
  UserProfile, 
  ProfileItem, 
  GitHubRateLimitData, 
  SystemHealthState 
} from '@/lib/types';

import { 
  Search, 
  RotateCw, 
  CheckCircle, 
  XCircle,
  ExternalLink,
  Code,
  ShieldAlert,
  Trash2,
  Settings,
  Layers,
  TrendingUp,
  Sun,
  Moon,
  Menu,
  X,
  Compass,
  Star,
  Terminal,
  Key,
  Lock
} from 'lucide-react';

import { RunnerStatus } from '@/components/RunnerStatus';
import { HomeTab } from '@/components/HomeTab';
import { ProfilesGrid } from '@/components/ProfilesGrid';
import { ReposGrid } from '@/components/ReposGrid';
import { LogsTable } from '@/components/LogsTable';
import { StatsTab } from '@/components/StatsTab';
import { SettingsModal } from '@/components/SettingsModal';
import { UnfollowModal } from '@/components/UnfollowModal';
import Header from '@/components/Header';

let globalRateLimitCache: { data: GitHubRateLimitData; timestamp: number } | null = null;

const cleanSnippet = (text: string) => {
  if (!text) return '';
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/`{3,}[\s\S]*?`{3,}/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~#>-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export interface DashboardViewProps {
  initialRepos: Repo[];
  initialLogs: Log[];
  initialRunSummary?: RunSummary[];
  initialUserProfile?: UserProfile | null;
  initialSettings?: Record<string, any>;
  initialTab?: 'home' | 'profiles' | 'repos' | 'logs' | 'stats';
  initialRateLimitData?: GitHubRateLimitData;
  initialHealthState?: SystemHealthState;
}

export default function DashboardView({ 
  initialRepos, 
  initialLogs, 
  initialRunSummary = [], 
  initialUserProfile = null, 
  initialSettings,
  initialTab = 'home',
  initialRateLimitData,
  initialHealthState,
}: DashboardViewProps) {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [healthState, setHealthState] = useState<SystemHealthState | null>(initialHealthState || null);
  const [repos, setRepos] = useState<Repo[]>(initialRepos);
  const [logs, setLogs] = useState<Log[]>(initialLogs);
  const [runSummary, setRunSummary] = useState<RunSummary[]>(initialRunSummary);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(initialUserProfile);
  const [isDark, setIsDark] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Per-card and per-repo loading tracking via Set in useRef
  const loadingIds = useRef<Set<string>>(new Set());
  const [, setTick] = useState(0);
  const triggerLoadingUpdate = () => setTick(t => t + 1);

  // Search & Active Tabs
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'followed' | 'starred' | 'skipped' | 'unfollowed' | 'mutual' | 'grace_period' | 'grace_ended' | 'inbound' | 'unstarred' | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'profiles' | 'repos' | 'logs' | 'stats'>(initialTab);
  const [timeRange, setTimeRange] = useState<'TODAY' | '7D' | '30D' | 'ALL'>('7D');
  const [showOnboardingTest, setShowOnboardingTest] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  const [rateLimitData, setRateLimitData] = useState<GitHubRateLimitData | null>(globalRateLimitCache?.data || initialRateLimitData || null);
  const [rateLimitLoading, setRateLimitLoading] = useState(false);

  // Settings State: Saved Master vs Temp Draft
  const defaultSettings = useMemo(() => ({
    cronFrequency: '6',
    maxProfilesPerRun: 50,
    activeWorkingHours: '00:00 - 24:00',
    dailyFollowLimit: 30,
    unfollowGracePeriod: 7,
    autoUnfollowNonMutuals: true,
    excludeOrgAccounts: true,
    llmModel: 'llama-3.3-70b-versatile',
    systemPrompt: 'Focus heavily on README quality, code architecture, commit frequency, and active open-source contribution patterns.',
    enableEmailDigest: false,
    recipientEmail: userProfile?.email || (userProfile?.login ? `${userProfile.login}@example.com` : 'user@example.com'),
    digestSummary: {
      runSummary: true,
      followedProfiles: true,
      unfollowedProfiles: true,
      mutualFollows: true
    },
    digestDeliveryTime: '09:00 AM',
    webhookUrl: process.env.NEXT_PUBLIC_DEFAULT_WEBHOOK_URL ?? '',
    webhookSecret: crypto.randomUUID(),
    resendApiKey: '',
    githubToken: '',
    senderName: 'FollowMe System',
  }), [userProfile]);

  const [savedSettings, setSavedSettings] = useState<Record<string, any>>(() => ({
    ...defaultSettings,
    ...(initialSettings || {})
  }));
  const [tempSettings, setTempSettings] = useState<Record<string, any>>(() => ({
    ...defaultSettings,
    ...(initialSettings || {})
  }));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Security Key Modal States
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [currentSecKey, setCurrentSecKey] = useState('');
  const [newSecKey, setNewSecKey] = useState('');
  const [confirmSecKey, setConfirmSecKey] = useState('');
  const [secKeyError, setSecKeyError] = useState<string | null>(null);
  const [secKeySuccess, setSecKeySuccess] = useState<string | null>(null);
  const [isSecKeySubmitting, setIsSecKeySubmitting] = useState(false);

  // Email test & Webhook integration states
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookTestStatus, setWebhookTestStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isTriggeringAgent, setIsTriggeringAgent] = useState(false);
  const [agentTriggerStatus, setAgentTriggerStatus] = useState<{ success: boolean; message: string } | null>(null);

  // UI Overlays & Navigation
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [exportPreview, setExportPreview] = useState<{ filename: string; mimeType: string; content: string } | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const mobileProfileMenuRef = useRef<HTMLDivElement>(null);
  const [isTabTransitioning, setIsTabTransitioning] = useState(false);
  const [visibleProfilesCount, setVisibleProfilesCount] = useState(24);
  const [visibleReposCount, setVisibleReposCount] = useState(24);

  // Cleanup Assistant states
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);
  const [cleanupOption, setCleanupOption] = useState<'list' | 'logs' | 'stale' | null>(null);
  const [totalLogsCount, setTotalLogsCount] = useState<number>(0);
  const staleProfilesCount = useMemo(() => {
    return repos.filter(r => !r.followed && !r.starred && !r.unfollowed && r.follow_skipped).length;
  }, [repos]);
  const [unfollowList, setUnfollowList] = useState<{ id: number; owner: string; name: string; followed_at: string }[]>([]);
  const [isFetchingUnfollowList, setIsFetchingUnfollowList] = useState(false);

  // Execution & Trigger States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerStatus, setTriggerStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);

  const [workerStatus, setWorkerStatus] = useState<{
    nextRun: string | null;
    lastRun: string | null;
    isJobRunning: boolean;
    consecutiveFailures: number;
  } | null>(null);

  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [isPaused, setIsPaused] = useState(false);
  const handlePause = () => { setIsPaused(true); setRunStatus('paused'); };
  const handleUnpause = () => { setIsPaused(false); setRunStatus('idle'); };

  const terminalEndRef = useRef<HTMLDivElement>(null);

  const fetchRateLimits = async (force: boolean = false) => {
    const now = Date.now();
    if (!force && globalRateLimitCache && (now - globalRateLimitCache.timestamp < 60000)) {
      setRateLimitData(globalRateLimitCache.data);
      return;
    }
    setRateLimitLoading(true);
    try {
      const res = await getGitHubRateLimit();
      if (res.success && res.data) {
        globalRateLimitCache = { data: res.data, timestamp: now };
        setRateLimitData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch GitHub rate limits:', err);
    } finally {
      setRateLimitLoading(false);
    }
  };

  const fetchStatus = async () => {
    const res = await getWorkerStatus();
    if (res.success && res.data) {
      setWorkerStatus(res.data);
    }
  };

  const fetchUnfollowList = async () => {
    setIsFetchingUnfollowList(true);
    try {
      const data = await fetchAllRows(
        supabase,
        'repos',
        '*',
        q => q
          .eq('follow_back', false)
          .eq('unfollowed', false)
          .lt('followed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      );
      setUnfollowList(data || []);
    } catch (error) {
      console.error('Error fetching unfollow list:', error);
    }
    setIsFetchingUnfollowList(false);
  };

  const fetchTotalLogsCount = async () => {
    const { count, error } = await supabase.from('logs').select('*', { count: 'exact', head: true });
    if (!error && count !== null) {
      setTotalLogsCount(count);
    }
  };

  useEffect(() => {
    fetchStatus();
    setMounted(true);
    const darkActive = document.documentElement.classList.contains('dark');
    setIsDark(darkActive);

    const localSaved = localStorage.getItem('savedSettings');
    if (localSaved && !initialSettings) {
      try {
        setSavedSettings(JSON.parse(localSaved));
      } catch (e) {}
    }
  }, [initialSettings]);

  useEffect(() => {
    if (activeTab === 'home') {
      fetchRateLimits();
      const interval = setInterval(() => fetchRateLimits(true), 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  useEffect(() => {
    setRepos(initialRepos);
  }, [initialRepos]);
  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);
  useEffect(() => {
    setRunSummary(initialRunSummary);
  }, [initialRunSummary]);

  // Prevent background scrolling when any modal overlay is active
  useEffect(() => {
    const isAnyModalOpen = isSettingsOpen || isSecurityModalOpen || isCleanupOpen || isSidebarOpen || Boolean(exportPreview);
    document.body.style.overflow = isAnyModalOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSettingsOpen, isSecurityModalOpen, isCleanupOpen, isSidebarOpen, exportPreview]);

  // Click outside to close profile menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const inDesktop = profileMenuRef.current && profileMenuRef.current.contains(event.target as Node);
      const inMobile = mobileProfileMenuRef.current && mobileProfileMenuRef.current.contains(event.target as Node);
      if (!inDesktop && !inMobile) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDarkMode = () => {
    const isCurrentlyDark = document.documentElement.classList.contains('dark');
    const nextDark = !isCurrentlyDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      localStorage.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      localStorage.theme = 'light';
    }
  };

  const handleTabChange = (newTab: 'home' | 'profiles' | 'repos' | 'logs' | 'stats', filter: any = null) => {
    setIsTabTransitioning(true);
    setActiveTab(newTab);
    setActiveFilter(filter);
    setTimeout(() => {
      setIsTabTransitioning(false);
    }, 150);

    const basePath = newTab === 'home' ? '/' : newTab === 'profiles' ? '/profiles' : newTab === 'repos' ? '/repositories' : newTab === 'logs' ? '/logs' : '/?tab=stats';
    const fullPath = filter ? `${basePath}?filter=${filter}` : basePath;
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', fullPath);
    }
    router.push(fullPath);
  };

  const [isOAuthConnecting, setIsOAuthConnecting] = useState(false);
  const handleGitHubOAuth = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsOAuthConnecting(true);
    const width = 600;
    const height = 700;
    const left = typeof window !== 'undefined' ? window.screenX + (window.outerWidth - width) / 2 : 100;
    const top = typeof window !== 'undefined' ? window.screenY + (window.outerHeight - height) / 2 : 100;

    const popup = window.open('/api/auth/github', 'github_oauth_popup', `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=no,resizable=yes`);
    if (!popup) {
      window.location.href = '/api/auth/github';
      return;
    }

    const checkTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkTimer);
        setIsOAuthConnecting(false);
      }
    }, 500);

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_OAUTH_SUCCESS') {
        clearInterval(checkTimer);
        window.removeEventListener('message', onMessage);
        setIsOAuthConnecting(false);
        router.refresh();
      } else if (event.data?.type === 'GITHUB_OAUTH_ERROR') {
        clearInterval(checkTimer);
        window.removeEventListener('message', onMessage);
        setIsOAuthConnecting(false);
      }
    };
    window.addEventListener('message', onMessage);
  };

  const getRelativeTime = (pastDateStr: string | null | undefined) => {
    if (!pastDateStr) return 'never';
    const diffMs = Date.now() - new Date(pastDateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getFutureRelativeTime = (futureDateStr: string | null | undefined) => {
    if (!futureDateStr) return 'soon';
    const diffMs = new Date(futureDateStr).getTime() - Date.now();
    if (diffMs <= 0) return 'soon';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `in ${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    const minsLeft = diffMins % 60;
    return `in ${diffHours}h ${minsLeft}m`;
  };

  // Compute Profiles Map
  const allProfiles = useMemo<ProfileItem[]>(() => {
    const profilesMap = new Map<string, ProfileItem>();
    const sorted = [...repos].sort((a, b) => (b.grade || 0) - (a.grade || 0) || new Date(b.graded_at || 0).getTime() - new Date(a.graded_at || 0).getTime());

    sorted.forEach(repo => {
      const ownerLower = repo.owner.toLowerCase();
      const existing = profilesMap.get(ownerLower);
      const ownerStatus = {
        followed: !!repo.followed,
        unfollowed: !!repo.unfollowed,
        follow_skipped: !!repo.follow_skipped,
        follow_back: !!repo.follow_back,
        reason: repo.follow_skip_reason || undefined,
        followed_at: repo.followed_at || undefined,
      };

      if (!existing) {
        profilesMap.set(ownerLower, {
          owner: repo.owner,
          reposCount: 1,
          totalGrade: (repo.grade || 0),
          avgGrade: (repo.grade || 0),
          repos: [repo],
          reason: repo.reason || repo.follow_skip_reason || null,
          bio: repo.bio || null,
          followStatus: ownerStatus,
        });
      } else {
        existing.reposCount += 1;
        existing.repos.push(repo);
        existing.repos.sort((a, b) => (b.grade || 0) - (a.grade || 0) || (b.stars || 0) - (a.stars || 0));

        if (!existing.reason && (repo.reason || repo.follow_skip_reason)) {
          existing.reason = repo.reason || repo.follow_skip_reason || null;
        }
        if (!existing.bio && repo.bio) {
          existing.bio = repo.bio || null;
        }

        const realGradedRepos = existing.repos.filter(r => (r.grade || 0) > 0 && !r.follow_skipped && r.language !== 'Profile');
        if (realGradedRepos.length > 0) {
          existing.avgGrade = Number((realGradedRepos.reduce((acc, r) => acc + (r.grade || 0), 0) / realGradedRepos.length).toFixed(1));
          existing.totalGrade = realGradedRepos.reduce((acc, r) => acc + (r.grade || 0), 0);
        } else {
          existing.avgGrade = existing.repos[0]?.grade || 0;
          existing.totalGrade = existing.avgGrade;
        }

        const isFollowed = existing.followStatus.followed || ownerStatus.followed;
        const isFollowBack = existing.followStatus.follow_back || ownerStatus.follow_back;
        const isUnfollowed = !isFollowed && (existing.followStatus.unfollowed || ownerStatus.unfollowed);
        const isSkipped = !isFollowed && !isUnfollowed && (existing.followStatus.follow_skipped || ownerStatus.follow_skipped);

        existing.followStatus = {
          followed: isFollowed,
          unfollowed: isUnfollowed,
          follow_skipped: isSkipped,
          follow_back: isFollowBack,
          reason: ownerStatus.reason || existing.followStatus.reason,
          followed_at: ownerStatus.followed_at || existing.followStatus.followed_at,
        };
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
    let inbound = 0;

    allProfiles.forEach((profile) => {
      const status = profile.followStatus;
      if (status.followed && !status.unfollowed && !status.follow_back) followed++;
      if (status.unfollowed) unfollowed++;
      if (status.follow_skipped) skipped++;
      if (status.followed && !status.unfollowed && status.follow_back) mutuals++;
      if (!status.followed && status.follow_back) inbound++;
    });

    const totalGrade = repos.reduce((acc, r) => acc + (r.grade || 0), 0);
    const avgGrade = total > 0 ? (totalGrade / total) : 0;

    return { total, starred, followed, unfollowed, skipped, avgGrade, mutuals, inbound, totalProfiles: allProfiles.length };
  }, [repos, allProfiles]);

  const relationshipMatrix = useMemo(() => {
    const mutuals: ProfileItem[] = [];
    const gracePeriod: ProfileItem[] = [];
    const graceEnded: ProfileItem[] = [];
    const inbound: ProfileItem[] = [];
    const unfollowed: ProfileItem[] = [];

    const graceDays = savedSettings.unfollowGracePeriod && savedSettings.unfollowGracePeriod > 0 ? savedSettings.unfollowGracePeriod : 7;
    const cutoffMs = graceDays * 24 * 60 * 60 * 1000;

    allProfiles.forEach((profile) => {
      const status = profile.followStatus;
      if (status.followed && !status.unfollowed && status.follow_back) {
        mutuals.push(profile);
      } else if (status.followed && !status.unfollowed && !status.follow_back) {
        if (status.followed_at) {
          const elapsed = Date.now() - new Date(status.followed_at).getTime();
          if (elapsed >= cutoffMs) {
            graceEnded.push(profile);
          } else {
            gracePeriod.push(profile);
          }
        } else {
          graceEnded.push(profile);
        }
      } else if (!status.followed && status.follow_back) {
        inbound.push(profile);
      } else if (status.unfollowed) {
        unfollowed.push(profile);
      }
    });

    return { mutuals, gracePeriod, graceEnded, inbound, unfollowed };
  }, [allProfiles, savedSettings.unfollowGracePeriod]);

  const lastRunTask = useMemo(() => {
    return runSummary.find(r => r.run_type !== 'sync_following' && r.run_type !== 'cleanup') || null;
  }, [runSummary]);

  const lastRunLabel = useMemo(() => {
    const iso = workerStatus?.lastRun || lastRunTask?.ran_at;
    if (!iso) return null;
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    return diff < 60 ? `Last run ${diff}m ago` : `Last run ${Math.floor(diff / 60)}h ago`;
  }, [workerStatus?.lastRun, lastRunTask?.ran_at]);

  const filteredProfiles = useMemo(() => {
    return allProfiles.filter(profile => {
      const matchesSearch = profile.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.repos.some(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()) || (r.topics && r.topics.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))));
      
      if (!matchesSearch) return false;

      const isStarred = profile.repos.some(r => r.starred);
      const isFollowed = profile.followStatus.followed && !profile.followStatus.unfollowed;
      const isSkipped = profile.followStatus.follow_skipped;

      if (isSkipped && !isFollowed && !isStarred && activeFilter !== 'skipped' && activeFilter !== null) {
        return false;
      }
      if (activeFilter === 'starred') return isStarred;
      if (activeFilter === 'followed') return profile.followStatus.followed && !profile.followStatus.unfollowed && !profile.followStatus.follow_back;
      if (activeFilter === 'grace_period') {
        if (!profile.followStatus.followed || profile.followStatus.unfollowed || profile.followStatus.follow_back) return false;
        if (!profile.followStatus.followed_at) return false;
        const elapsed = Date.now() - new Date(profile.followStatus.followed_at).getTime();
        const graceDays = savedSettings.unfollowGracePeriod && savedSettings.unfollowGracePeriod > 0 ? savedSettings.unfollowGracePeriod : 7;
        return elapsed < graceDays * 24 * 60 * 60 * 1000;
      }
      if (activeFilter === 'grace_ended') {
        if (!profile.followStatus.followed || profile.followStatus.unfollowed || profile.followStatus.follow_back) return false;
        if (!profile.followStatus.followed_at) return true;
        const elapsed = Date.now() - new Date(profile.followStatus.followed_at).getTime();
        const graceDays = savedSettings.unfollowGracePeriod && savedSettings.unfollowGracePeriod > 0 ? savedSettings.unfollowGracePeriod : 7;
        return elapsed >= graceDays * 24 * 60 * 60 * 1000;
      }
      if (activeFilter === 'skipped') return profile.followStatus.follow_skipped;
      if (activeFilter === 'unfollowed') return profile.followStatus.unfollowed;
      if (activeFilter === 'mutual') return profile.followStatus.followed && !profile.followStatus.unfollowed && profile.followStatus.follow_back;
      if (activeFilter === 'inbound') return !profile.followStatus.followed && profile.followStatus.follow_back;
      return true;
    });
  }, [allProfiles, searchTerm, activeFilter, savedSettings.unfollowGracePeriod]);

  const filteredRepos = useMemo(() => {
    return repos
      .filter(repo => {
        const matchesSearch = 
          `${repo.owner}/${repo.name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (repo.topics && repo.topics.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));
        if (!matchesSearch) return false;
        if (activeFilter === 'starred') return repo.starred;
        if (activeFilter === 'unstarred') return !repo.starred;
        return true;
      })
      .sort((a, b) => new Date(b.graded_at || 0).getTime() - new Date(a.graded_at || 0).getTime());
  }, [repos, searchTerm, activeFilter]);

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

  // Historical chart data for Recharts
  const chartData = useMemo(() => {
    const dailyMap = new Map<string, { date: string; dateObj: Date; follows: number; unfollows: number; evaluations: number; mutuals: number; totalGrade: number; gradeCount: number }>();
    const now = new Date();
    const formatLocalDateKey = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    let cutoffDate = new Date();
    if (timeRange === 'TODAY') {
      cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timeRange === '7D') {
      cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    } else if (timeRange === '30D') {
      cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    } else {
      cutoffDate = new Date(0);
    }

    runSummary.forEach(run => {
      const runDate = new Date(run.ran_at);
      if (runDate >= cutoffDate) {
        const dateKey = formatLocalDateKey(runDate);
        const existing = dailyMap.get(dateKey) || { date: dateKey, dateObj: runDate, follows: 0, unfollows: 0, evaluations: 0, mutuals: 0, totalGrade: 0, gradeCount: 0 };
        existing.follows += (run.profiles_followed || 0);
        existing.unfollows += (run.profiles_unfollowed || 0);
        existing.evaluations += (run.profiles_evaluated || 0);
        dailyMap.set(dateKey, existing);
      }
    });

    const sortedList = Array.from(dailyMap.values())
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
      .map(item => ({
        ...item,
        avgGrade: item.gradeCount > 0 ? Number((item.totalGrade / item.gradeCount).toFixed(1)) : 8.5,
        followingGrowth: 0
      }));

    let runningTotal = 0;
    return sortedList.map(item => {
      runningTotal += (item.follows - item.unfollows);
      return { ...item, followingGrowth: runningTotal };
    });
  }, [runSummary, timeRange]);

  const filteredSummary = useMemo(() => {
    let evaluated = 0, followed = 0, unfollowed = 0, mutuals = 0;
    if (timeRange === 'ALL') {
      runSummary.forEach(run => {
        evaluated += (run.profiles_evaluated || 0);
        followed += (run.profiles_followed || 0);
        unfollowed += (run.profiles_unfollowed || 0);
      });
      if (evaluated === 0 && (stats.totalProfiles || allProfiles.length) > 0) {
        evaluated = stats.totalProfiles || allProfiles.length;
        followed = stats.followed + stats.mutuals;
        unfollowed = stats.unfollowed;
      }
      mutuals = stats.mutuals;
      return { evaluated, followed, unfollowed, mutuals };
    }

    chartData.forEach(item => {
      evaluated += item.evaluations;
      followed += item.follows;
      unfollowed += item.unfollows;
      mutuals += (item.mutuals || 0);
    });
    return { evaluated, followed, unfollowed, mutuals };
  }, [chartData, runSummary, stats, timeRange, allProfiles.length]);

  const statusDistribution = useMemo(() => {
    const acc = '#e60023';
    return [
      { name: 'Mutuals', value: stats.mutuals, color: acc },
      { name: 'Grace Period', value: stats.followed, color: `color-mix(in srgb, ${acc} 80%, black)` },
      { name: 'Inbound', value: stats.inbound, color: '#3b82f6' },
      { name: 'Unfollowed', value: stats.unfollowed, color: `color-mix(in srgb, ${acc} 50%, white)` },
      { name: 'Skipped', value: stats.skipped, color: `color-mix(in srgb, ${acc} 25%, white)` }
    ].filter(item => item.value > 0);
  }, [stats]);

  // Actions
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const syncRes = await triggerSyncFollowing();
      const freshRepos = await fetchAllRows(supabase, 'repos', '*');
      if (freshRepos) setRepos(freshRepos);
      const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
      if (logsRes.data) setLogs(logsRes.data);
      const summaryRes = await supabase.from('run_summary').select('*').order('ran_at', { ascending: false });
      if (summaryRes.data) setRunSummary(summaryRes.data);
      await fetchStatus();
      await fetchRateLimits(true);

      if (syncRes.success && syncRes.data) {
        const d = syncRes.data;
        setTriggerStatus({
          success: true,
          message: `Live Sync Successful: ${d.liveFollowingCount ?? '350+'} Following, ${d.liveFollowersCount ?? '140+'} Followers synced with GitHub.`
        });
      }
    } catch (err: any) {
      console.error('Error refreshing data and syncing with GitHub:', err);
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
    if (healthState?.isGitHubValid === false) {
      alert('Action disabled: GitHub Personal Access Token is expired or invalid. Please update your token in Settings.');
      return;
    }
    const targetId = `profile-${username}`;
    loadingIds.current.add(targetId);
    triggerLoadingUpdate();

    setRepos(prev => prev.map(r => r.owner.toLowerCase() === username.toLowerCase() ? { ...r, followed: true, unfollowed: false, followed_at: new Date().toISOString() } : r));
    try {
      const res = await triggerFollow(username);
      if (res.success) {
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
        if (logsRes.data) setLogs(logsRes.data);
      } else {
        setRepos(prev => prev.map(r => r.owner.toLowerCase() === username.toLowerCase() ? { ...r, followed: false } : r));
        alert(`Failed to follow: ${res.error}`);
      }
    } catch (err: any) {
      setRepos(prev => prev.map(r => r.owner.toLowerCase() === username.toLowerCase() ? { ...r, followed: false } : r));
      alert(`Failed to follow: ${err.message || err}`);
    } finally {
      loadingIds.current.delete(targetId);
      triggerLoadingUpdate();
    }
  };

  const handleUnfollowUser = async (username: string) => {
    if (healthState?.isGitHubValid === false) {
      alert('Action disabled: GitHub Personal Access Token is expired or invalid. Please update your token in Settings.');
      return;
    }
    const targetId = `profile-${username}`;
    loadingIds.current.add(targetId);
    triggerLoadingUpdate();

    setRepos(prev => prev.map(r => r.owner.toLowerCase() === username.toLowerCase() ? { ...r, followed: false, unfollowed: true } : r));
    try {
      const res = await triggerUnfollow(username);
      if (res.success) {
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
        if (logsRes.data) setLogs(logsRes.data);
      } else {
        setRepos(prev => prev.map(r => r.owner.toLowerCase() === username.toLowerCase() ? { ...r, followed: true, unfollowed: false } : r));
        alert(`Failed to unfollow: ${res.error}`);
      }
    } catch (err: any) {
      setRepos(prev => prev.map(r => r.owner.toLowerCase() === username.toLowerCase() ? { ...r, followed: true, unfollowed: false } : r));
      alert(`Failed to unfollow: ${err.message || err}`);
    } finally {
      loadingIds.current.delete(targetId);
      triggerLoadingUpdate();
    }
  };

  const handleStar = async (owner: string, name: string) => {
    if (healthState?.isGitHubValid === false) {
      alert('Action disabled: GitHub Personal Access Token is expired or invalid. Please update your token in Settings.');
      return;
    }
    const targetId = `repo-${owner}-${name}`;
    loadingIds.current.add(targetId);
    triggerLoadingUpdate();

    setRepos(prev => prev.map(r => (r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === name.toLowerCase()) ? { ...r, starred: true } : r));
    try {
      const res = await triggerStar(owner, name);
      if (res.success) {
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
        if (logsRes.data) setLogs(logsRes.data);
      } else {
        setRepos(prev => prev.map(r => (r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === name.toLowerCase()) ? { ...r, starred: false } : r));
        alert(`Failed to star: ${res.error}`);
      }
    } catch (err: any) {
      setRepos(prev => prev.map(r => (r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === name.toLowerCase()) ? { ...r, starred: false } : r));
      alert(`Failed to star: ${err.message || err}`);
    } finally {
      loadingIds.current.delete(targetId);
      triggerLoadingUpdate();
    }
  };

  const handleUnstar = async (owner: string, name: string) => {
    const targetId = `repo-${owner}-${name}`;
    loadingIds.current.add(targetId);
    triggerLoadingUpdate();

    setRepos(prev => prev.map(r => (r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === name.toLowerCase()) ? { ...r, starred: false } : r));
    try {
      const res = await triggerUnstar(owner, name);
      if (res.success) {
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
        if (logsRes.data) setLogs(logsRes.data);
      } else {
        setRepos(prev => prev.map(r => (r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === name.toLowerCase()) ? { ...r, starred: true } : r));
        alert(`Failed to unstar: ${res.error}`);
      }
    } catch (err: any) {
      setRepos(prev => prev.map(r => (r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === name.toLowerCase()) ? { ...r, starred: true } : r));
      alert(`Failed to unstar: ${err.message || err}`);
    } finally {
      loadingIds.current.delete(targetId);
      triggerLoadingUpdate();
    }
  };

  const handleDeleteProfile = async (username: string) => {
    if (!confirm(`Are you sure you want to permanently delete @${username} and all of their repositories from the database?`)) {
      return;
    }
    const targetId = `profile-${username}`;
    loadingIds.current.add(targetId);
    triggerLoadingUpdate();

    setRepos(prev => prev.filter(r => r.owner.toLowerCase() !== username.toLowerCase()));
    try {
      const res = await triggerDeleteProfile(username);
      if (res.success) {
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
        if (logsRes.data) setLogs(logsRes.data);
      } else {
        const freshRepos = await fetchAllRows(supabase, 'repos', '*');
        if (freshRepos) setRepos(freshRepos);
        alert(`Failed to delete profile: ${res.error}`);
      }
    } catch (err: any) {
      const freshRepos = await fetchAllRows(supabase, 'repos', '*');
      if (freshRepos) setRepos(freshRepos);
      alert(`Failed to delete profile: ${err.message || err}`);
    } finally {
      loadingIds.current.delete(targetId);
      triggerLoadingUpdate();
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } catch (e) {}
    router.push('/login');
    router.refresh();
  };

  const handleExportCSV = () => {
    const headers = ['Owner', 'ReposCount', 'AvgGrade', 'FollowStatus'];
    const rows = allProfiles.map(p => {
      let statusLabel = 'Pending';
      if (p.followStatus.followed && p.followStatus.follow_back) statusLabel = 'Mutual';
      else if (p.followStatus.followed && !p.followStatus.unfollowed) statusLabel = 'Followed';
      else if (!p.followStatus.followed && p.followStatus.follow_back) statusLabel = 'Inbound';
      else if (p.followStatus.unfollowed) statusLabel = 'Unfollowed';
      else if (p.followStatus.follow_skipped) statusLabel = 'Skipped';
      return [`"${p.owner}"`, p.reposCount, p.avgGrade.toFixed(1), `"${statusLabel}"`];
    });
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    setExportPreview({
      filename: `followme_profiles_${new Date().toISOString().split('T')[0]}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: csvContent
    });
  };

  const handleExportJSON = () => {
    const exportData = allProfiles.map(p => ({
      owner: p.owner,
      reposCount: p.reposCount,
      avgGrade: p.avgGrade,
      followStatus: p.followStatus,
      repos: p.repos.map(r => ({
        name: r.name,
        stars: r.stars,
        grade: r.grade,
        language: r.language,
        github_url: r.github_url,
      }))
    }));
    setExportPreview({
      filename: `followme_profiles_${new Date().toISOString().split('T')[0]}.json`,
      mimeType: 'application/json;charset=utf-8',
      content: JSON.stringify(exportData, null, 2)
    });
  };

  const handleUpdateSecurityKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecKeyError(null);
    setSecKeySuccess(null);
    if (!currentSecKey || !newSecKey || !confirmSecKey) {
      setSecKeyError('Please fill in all security key fields.');
      return;
    }
    if (newSecKey !== confirmSecKey) {
      setSecKeyError('New security key and confirmation do not match.');
      return;
    }
    if (newSecKey.length < 4) {
      setSecKeyError('New security key must be at least 4 characters long.');
      return;
    }
    setIsSecKeySubmitting(true);
    try {
      const res = await fetch('/api/auth/update-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentKey: currentSecKey, newKey: newSecKey })
      });
      const data = await res.json();
      if (res.ok) {
        setSecKeySuccess('Security Key updated successfully!');
        setCurrentSecKey('');
        setNewSecKey('');
        setConfirmSecKey('');
        setTimeout(() => {
          setSecKeySuccess(null);
          setIsSecurityModalOpen(false);
        }, 1500);
      } else {
        setSecKeyError(data.error || 'Current key verification failed.');
      }
    } catch (err: any) {
      setSecKeyError('Failed to update security key. Check connection.');
    } finally {
      setIsSecKeySubmitting(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavedSettings(tempSettings);
    localStorage.setItem('savedSettings', JSON.stringify(tempSettings));
    setIsSettingsOpen(false);

    const { githubToken, resendApiKey, _githubTokenDirty, _resendApiKeyDirty, ...restSettings } = tempSettings;
    const savePayload: Record<string, any> = {
      ...restSettings,
      ...(_githubTokenDirty && { githubToken }),
      ...(_resendApiKeyDirty && { resendApiKey }),
    };

    await saveSystemSettings(savePayload);
    try {
      const freshHealth = await checkSystemHealth();
      setHealthState(freshHealth);
    } catch (_) {}
    router.refresh();
  };

  const handleSendTestEmail = async () => {
    setIsSendingTestEmail(true);
    setTestEmailStatus(null);
    try {
      const res = await sendTestAlertEmail(tempSettings.recipientEmail, tempSettings.resendApiKey);
      if (res.success) {
        setTestEmailStatus({ success: true, message: `Test dispatch succeeded! Delivered to ${tempSettings.recipientEmail}` });
      } else {
        setTestEmailStatus({ success: false, message: res.error || 'Email dispatch failed. Verify your Resend API Key.' });
      }
    } catch (err: any) {
      setTestEmailStatus({ success: false, message: 'Network error sending test alert: ' + (err.message || err) });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleTestWebhook = async () => {
    setIsTestingWebhook(true);
    setWebhookTestStatus(null);
    try {
      const response = await fetch('/api/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: tempSettings.webhookUrl, secret: tempSettings.webhookSecret }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setWebhookTestStatus({ success: true, message: 'Webhook test ping dispatched successfully! Status: 200 OK' });
      } else {
        setWebhookTestStatus({ success: false, message: data.message || 'Webhook ping failed. Please verify the endpoint URL.' });
      }
    } catch (err: any) {
      setWebhookTestStatus({ success: false, message: 'Network error: ' + (err.message || 'Failed to reach backend proxy.') });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleTriggerAgent = async () => {
    setIsTriggeringAgent(true);
    setAgentTriggerStatus(null);
    try {
      const response = await fetch('/api/trigger-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setAgentTriggerStatus({ success: true, message: 'GitAuto Agent execution triggered successfully!' });
      } else {
        setAgentTriggerStatus({ success: false, message: data.message || 'Failed to trigger agent workflow.' });
      }
    } catch (err: any) {
      setAgentTriggerStatus({ success: false, message: 'Network error: ' + (err.message || 'Failed to initiate agent process.') });
    } finally {
      setIsTriggeringAgent(false);
    }
  };

  const handleCleanupRun = async () => {
    setIsCleaning(true);
    setIsRefreshing(true);
    try {
      const res = await triggerCleanup();
      if (res.success) {
        const freshRepos = await fetchAllRows(supabase, 'repos', '*');
        if (freshRepos) setRepos(freshRepos);
        const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
        if (logsRes.data) setLogs(logsRes.data);
        fetchStatus();
      } else {
        alert(`Cleanup error: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Cleanup error: ${err.message || err}`);
    } finally {
      setIsCleaning(false);
      setIsRefreshing(false);
    }
  };

  const handleLogCleanupRun = async () => {
    setIsCleaning(true);
    setIsRefreshing(true);
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
      setIsRefreshing(false);
    }
  };

  const handleClearStaleRun = async () => {
    setIsCleaning(true);
    setIsRefreshing(true);
    try {
      const res = await triggerClearStale();
      if (res.success) {
        const freshRepos = await fetchAllRows(supabase, 'repos', '*');
        if (freshRepos) setRepos(freshRepos);
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
      setIsRefreshing(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--ink)' }}>

      <Header
        status={runStatus}
        lastRunLabel={lastRunLabel}
        onRunNow={handleTrigger}
        onPause={handlePause}
        onUnpause={handleUnpause}
        onUnfollowOpen={() => setIsCleanupOpen(true)}
        onSettingsOpen={() => setIsSettingsOpen(true)}
      />

      <main style={{ maxWidth:1200, margin:'0 auto', padding:'24px 16px', display:'flex', flexDirection:'column', gap:24 }}>

        {/* ── STAT STRIP (Part B placeholder) ── */}
        <div id="stat-strip" style={{ height:88, background:'var(--surface)', borderRadius:'var(--r)', border:'1px solid var(--line)' }} />

        {/* ── CHARTS ROW (Part C placeholder) ── */}
        <div id="charts-row" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={{ height:220, background:'var(--surface)', borderRadius:'var(--r)', border:'1px solid var(--line)' }} />
          <div style={{ height:220, background:'var(--surface)', borderRadius:'var(--r)', border:'1px solid var(--line)' }} />
        </div>

        {/* ── PROFILES LIST (Part D placeholder) ── */}
        <div id="profiles-section" style={{ background:'var(--surface)', borderRadius:'var(--r)', border:'1px solid var(--line)', minHeight:400 }} />

        {/* ── ACTIVITY FEED (Part F placeholder) ── */}
        <div id="activity-feed" style={{ background:'var(--surface)', borderRadius:'var(--r)', border:'1px solid var(--line)', minHeight:120 }} />

      </main>

      {/* Extracted Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        tempSettings={tempSettings}
        savedSettings={savedSettings}
        defaultSettings={defaultSettings}
        userProfile={userProfile}
        healthState={healthState}
        isOAuthConnecting={isOAuthConnecting}
        isSendingTestEmail={isSendingTestEmail}
        testEmailStatus={testEmailStatus}
        isTriggeringAgent={isTriggeringAgent}
        agentTriggerStatus={agentTriggerStatus}
        onClose={() => setIsSettingsOpen(false)}
        setTempSettings={setTempSettings}
        onSaveSettings={handleSaveSettings}
        onSendTestEmail={handleSendTestEmail}
        onTestWebhook={handleTestWebhook}
        isTestingWebhook={isTestingWebhook}
        webhookTestStatus={webhookTestStatus}
        onTriggerAgent={handleTriggerAgent}
        onGitHubOAuth={handleGitHubOAuth}
      />

      {/* Extracted Unfollow / Cleanup Modal */}
      <UnfollowModal
        isOpen={isCleanupOpen}
        cleanupOption={cleanupOption}
        isCleaning={isCleaning}
        isFetchingUnfollowList={isFetchingUnfollowList}
        unfollowList={unfollowList}
        totalLogsCount={totalLogsCount}
        staleProfilesCount={staleProfilesCount}
        onClose={() => {
          setIsCleanupOpen(false);
          setCleanupOption(null);
        }}
        setCleanupOption={setCleanupOption}
        onFetchUnfollowList={fetchUnfollowList}
        onFetchTotalLogsCount={fetchTotalLogsCount}
        onUnfollowUser={handleUnfollowUser}
        onRemoveFromUnfollowList={(username) => setUnfollowList(prev => prev.filter(item => item.owner !== username))}
        onRunBulkCleanup={handleCleanupRun}
        onRunLogCleanup={handleLogCleanupRun}
        onRunClearStale={handleClearStaleRun}
      />

      {/* Password Security Modal */}
      {isSecurityModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in"
          onClick={() => setIsSecurityModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-[#121215] border border-[#dadada] dark:border-[#2a2a2a] w-full max-w-md rounded-3xl p-6 flex flex-col shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#eeeeee] dark:border-[#2a2a2a] pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#e60023]/10 border border-[#e60023]/30 flex items-center justify-center text-[#e60023]">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-jakarta text-base font-bold text-[#1a1c1c] dark:text-[#f0f0f0]">Password & Security</h3>
                  <span className="text-[10px] font-mono text-zinc-400">Update Dashboard Access Password</span>
                </div>
              </div>
              <button
                onClick={() => setIsSecurityModalOpen(false)}
                className="h-8 w-8 rounded-full border border-[#dadada] dark:border-[#2a2a2a] hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSecurityKey} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentSecKey}
                  onChange={(e) => setCurrentSecKey(e.target.value)}
                  placeholder="Enter current password..."
                  className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">New Password</label>
                <input
                  type="password"
                  value={newSecKey}
                  onChange={(e) => setNewSecKey(e.target.value)}
                  placeholder="Enter new password (min. 4 chars)..."
                  className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmSecKey}
                  onChange={(e) => setConfirmSecKey(e.target.value)}
                  placeholder="Confirm new password..."
                  className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                  required
                />
              </div>

              {secKeyError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 font-mono text-[11px] animate-shake">
                  ⚠️ {secKeyError}
                </div>
              )}

              {secKeySuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-500 font-mono text-[11px] font-bold animate-pulse">
                  ✓ {secKeySuccess}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSecurityModalOpen(false)}
                  className="px-4 py-2 border border-[#dadada] dark:border-[#2a2a2a] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-bold rounded-full transition cursor-pointer font-geist"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSecKeySubmitting}
                  className="px-5 py-2 bg-[#e60023] hover:bg-[#c0001b] text-white text-xs font-bold rounded-full transition cursor-pointer font-geist shadow-sm disabled:opacity-50"
                >
                  {isSecKeySubmitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Repo Readme Snippet Modal */}
      {selectedRepo && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in"
          onClick={() => setSelectedRepo(null)}
        >
          <div 
            className="bg-white dark:bg-[#121215] border border-[#dadada] dark:border-[#2a2a2a] w-full max-w-2xl rounded-3xl p-6 flex flex-col shadow-2xl space-y-4 max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#eeeeee] dark:border-[#2a2a2a] pb-3">
              <div className="flex items-center space-x-3">
                <div className="h-9 w-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-[#e60023]">
                  <Code className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-jakarta text-base font-bold text-[#1a1c1c] dark:text-[#f0f0f0] truncate max-w-sm">
                    {selectedRepo.owner} / {selectedRepo.name}
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-400">README Architecture & Graded Analysis</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedRepo(null)}
                className="h-8 w-8 rounded-full border border-[#dadada] dark:border-[#2a2a2a] hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div className="bg-[#f8f9fa] dark:bg-[#151518] p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs font-sans leading-relaxed text-zinc-700 dark:text-zinc-300">
                <p className="font-mono text-[10px] uppercase font-bold text-zinc-400 mb-2">Cleaned README Content</p>
                {cleanSnippet(selectedRepo.readme_snippet) || 'No README documentation preview available for this repository.'}
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-[#eeeeee] dark:border-[#2a2a2a]">
              <a
                href={selectedRepo.github_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 text-xs text-[#e60023] hover:underline font-mono"
              >
                <span>View on GitHub</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => setSelectedRepo(null)}
                className="px-5 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-full transition cursor-pointer font-geist"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Export Preview Modal */}
      {exportPreview && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/85 backdrop-blur-md animate-in fade-in"
          onClick={() => setExportPreview(null)}
        >
          <div 
            className="bg-white dark:bg-[#121215] border border-[#dadada] dark:border-[#2a2a2a] w-full max-w-xl rounded-3xl p-6 flex flex-col shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#eeeeee] dark:border-[#2a2a2a] pb-3">
              <div>
                <h3 className="font-jakarta text-base font-bold text-[#1a1c1c] dark:text-[#f0f0f0]">Data Export Preview</h3>
                <span className="text-[10px] font-mono text-zinc-400">File: {exportPreview.filename}</span>
              </div>
              <button
                onClick={() => setExportPreview(null)}
                className="h-8 w-8 rounded-full border border-[#dadada] dark:border-[#2a2a2a] hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 cursor-pointer transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold text-zinc-500 block">Raw Export Payload Preview:</span>
              <pre className="w-full bg-[#f8f9fa] dark:bg-[#09090b] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-4 text-[10px] font-mono text-[#1a1c1c] dark:text-[#f0f0f0] overflow-auto h-[240px] leading-relaxed no-scrollbar">
                {exportPreview.content}
              </pre>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#eeeeee] dark:border-[#2a2a2a]">
              <button
                onClick={() => setExportPreview(null)}
                className="px-4 py-2 border border-[#dadada] dark:border-[#2a2a2a] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-bold rounded-full transition cursor-pointer font-geist"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const encodedUri = "data:" + exportPreview.mimeType + "," + encodeURIComponent(exportPreview.content);
                  const link = document.createElement('a');
                  link.setAttribute('href', encodedUri);
                  link.setAttribute('download', exportPreview.filename);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  setExportPreview(null);
                }}
                className="px-5 py-2 bg-[#e60023] hover:bg-[#c0001b] text-white text-xs font-bold rounded-full transition cursor-pointer font-geist shadow-sm"
              >
                Download File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
