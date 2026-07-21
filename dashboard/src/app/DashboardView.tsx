'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Compass,
  Sliders,
  Key,
  Download,
  Clock,
  ShieldCheck,
  Cpu,
  Mail,
  Palette,
  Lock,
  Send
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
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // Strip images: ![alt](url)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Strip links keeping text: [text](url)
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/`{3,}[\s\S]*?`{3,}/g, '') // Strip code blocks
    .replace(/`([^`]+)`/g, '$1') // Strip inline code backticks
    .replace(/[*_~#>-]/g, '') // Strip markdown formatting chars
    .replace(/\s+/g, ' ') // Collapse whitespaces
    .trim();
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
  isActionLoading,
  setActiveTab,
  setSearchTerm
}: { 
  profile: any; 
  onFollow: (username: string) => Promise<void>; 
  onUnfollow: (username: string) => Promise<void>;
  onDelete: (username: string) => Promise<void>;
  isActionLoading: boolean;
  setActiveTab: (tab: any) => void;
  setSearchTerm: (term: string) => void;
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
    badgeClass = "bg-blue-50 text-[#0058bb] border-blue-200 dark:bg-blue-950/20 dark:text-blue-400";
    badgeLabel = "Followed";
  } else if (isMutual) {
    badgeClass = "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 font-bold";
    badgeLabel = "Mutual Follow";
  } else if (isUnfollowed) {
    badgeClass = "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400";
    badgeLabel = "Unfollowed";
  } else if (isSkipped) {
    badgeClass = "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400";
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
    <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] hover:shadow-lg dark:hover:shadow-black/40 rounded-[32px] transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
      {/* Top Header (Unified redesign - visual flow is perfect) */}
      <div className="h-14 bg-slate-100 dark:bg-[#1c1c1e] border-b border-[#dadada] dark:border-[#2a2a2a] flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center space-x-2.5 min-w-0">
          <img 
            src={`https://github.com/${profile.owner}.png`} 
            alt={profile.owner} 
            className="h-8 w-8 rounded-full border border-white dark:border-[#111111] bg-zinc-100 dark:bg-[#1a1a1a] object-cover aura-shadow shrink-0" 
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://unavatar.io/github/${profile.owner}`;
            }}
          />
          <div className="truncate">
            <h3 className="text-xs font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta truncate leading-none">
              @{profile.owner}
            </h3>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('repos');
                setSearchTerm(profile.repos[0]?.name || '');
              }}
              className="text-[8px] font-mono text-zinc-450 hover:text-[#e60023] transition-colors mt-1 text-left block truncate max-w-[120px] leading-none"
              title={`Graded on: ${profile.repos[0]?.name || 'Unknown'}`}
            >
              Graded on: {profile.repos[0]?.name || 'Unknown'}
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-1.5 shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-[9px] border font-mono font-bold shrink-0 ${badgeClass}`}>
            {badgeLabel}
          </span>
          <button
            onClick={() => onDelete(profile.owner)}
            disabled={isActionLoading}
            className="p-1 bg-rose-50 dark:bg-rose-955/20 hover:bg-rose-100 dark:hover:bg-rose-950/35 border border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg transition-all cursor-pointer disabled:opacity-40 shrink-0"
            title="Delete Profile from DB"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      
      {/* Card Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>

        {/* Compact numeric quality grade block */}
        <div className="bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] py-2 px-3 rounded-xl text-center my-3 relative overflow-hidden flex items-center justify-between">
          <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#767676]">Average Quality Score</span>
          <span className={`text-sm font-extrabold font-mono leading-none ${
            profile.avgGrade >= 9.0 ? 'text-emerald-600 dark:text-emerald-400' :
            profile.avgGrade >= 7.0 ? 'text-[#e60023]' : 'text-orange-500'
          }`}>
            {profile.avgGrade.toFixed(1)}/10
          </span>
        </div>

        {profile.repos[0]?.readme_snippet && (
          <p className="text-[11px] font-sans text-[#767676] dark:text-zinc-400 line-clamp-2 leading-relaxed my-2 px-1">
            {cleanSnippet(profile.repos[0].readme_snippet)}
          </p>
        )}

        {isSkipped && profile.followStatus.reason && (
          <div className="text-[10px] font-mono text-[#767676] leading-relaxed bg-[#f3f3f3] dark:bg-[#1a1a1a] border border-[#dadada] dark:border-[#2a2a2a] p-2 py-1.5 rounded-lg mb-2">
            Reason: {profile.followStatus.reason}
          </div>
        )}
        </div>
      </div>

      <div className="flex space-x-2 px-4 pb-4 pt-2 border-t border-[#eeeeee] dark:border-[#2a2a2a]">
        {isMutual ? (
          <>
            <button
              onClick={() => onUnfollow(profile.owner)}
              disabled={isActionLoading}
              className="flex-1 min-h-[34px] flex items-center justify-center bg-transparent border border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/10 text-xs font-bold rounded-full cursor-pointer transition-all font-geist disabled:opacity-40"
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
        ) : isFollowed ? (
          <>
            <button
              onClick={() => onUnfollow(profile.owner)}
              disabled={isActionLoading}
              className="flex-1 min-h-[34px] flex items-center justify-center bg-transparent border border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/10 text-xs font-bold rounded-full cursor-pointer transition-all font-geist disabled:opacity-40"
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

interface RunSummary {
  id: string;
  ran_at: string;
  profiles_followed: number;
  profiles_unfollowed: number;
  repos_starred: number;
  mutuals_found: number;
  profiles_skipped: number;
  profiles_evaluated: number;
  run_type: string;
}

interface DashboardViewProps {
  initialRepos: Repo[];
  initialLogs: Log[];
  initialRunSummary?: RunSummary[];
}

export default function DashboardView({ initialRepos, initialLogs, initialRunSummary = [] }: DashboardViewProps) {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [repos, setRepos] = useState<Repo[]>(initialRepos);
  const [logs, setLogs] = useState<Log[]>(initialLogs);
  const [runSummary, setRunSummary] = useState<RunSummary[]>(initialRunSummary);
  const [isDark, setIsDark] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [insightIndex, setInsightIndex] = useState(0);

  // Sync state if initialProps change
  useEffect(() => {
    setRepos(initialRepos);
  }, [initialRepos]);

  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  useEffect(() => {
    setRunSummary(initialRunSummary);
  }, [initialRunSummary]);



  useEffect(() => {
    setMounted(true);
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      const nextDark = storedTheme === 'dark';
      setIsDark(nextDark);
      if (nextDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      const darkActive = document.documentElement.classList.contains('dark');
      setIsDark(darkActive);
    }

    const saved = localStorage.getItem('savedSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedSettings(parsed);
      } catch (e) {}
    }
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
  const [activeFilter, setActiveFilter] = useState<'followed' | 'starred' | 'skipped' | 'unfollowed' | 'mutual' | 'unstarred' | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'profiles' | 'repos' | 'logs' | 'stats'>('home');
  const [timeRange, setTimeRange] = useState<'TODAY' | '7D' | '30D' | 'ALL'>('7D');


  // Master Settings Default Values
  const defaultSettings = useMemo(() => ({
    cronFrequency: '6',
    maxProfilesPerRun: 50,
    activeWorkingHours: '09:00 - 22:00',
    dailyFollowLimit: 30,
    unfollowGracePeriod: 7,
    autoUnfollowNonMutuals: true,
    excludeOrgAccounts: true,
    llmModel: 'Gemini 2.5 Flash',
    systemPrompt: 'Focus heavily on README quality, code architecture, commit frequency, and active open-source contribution patterns.',
    accentColor: '#e60023',
    enableEmailDigest: false,
    recipientEmail: 'madhan@example.com',
    digestSummary: {
      runSummary: true,
      followedProfiles: true,
      unfollowedProfiles: true,
      mutualFollows: true
    },
    digestDeliveryTime: '09:00 AM',
    webhookUrl: 'https://api.followme.io/v1/webhook',
    webhookSecret: 'fm_secret_key_prod_abc123'
  }), []);

  // Settings State: Saved Master vs Temp Draft
  const [savedSettings, setSavedSettings] = useState(defaultSettings);
  const [tempSettings, setTempSettings] = useState(defaultSettings);
  const [settingsTab, setSettingsTab] = useState<'automation' | 'safety' | 'ai' | 'notifications'>('automation');

  // Security Key Modal States
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [currentSecKey, setCurrentSecKey] = useState('');
  const [newSecKey, setNewSecKey] = useState('');
  const [confirmSecKey, setConfirmSecKey] = useState('');
  const [secKeyError, setSecKeyError] = useState<string | null>(null);
  const [secKeySuccess, setSecKeySuccess] = useState<string | null>(null);
  const [isSecKeySubmitting, setIsSecKeySubmitting] = useState(false);

  // Webhook integration & trigger states
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookTestStatus, setWebhookTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isTriggeringAgent, setIsTriggeringAgent] = useState(false);
  const [agentTriggerStatus, setAgentTriggerStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // UI Overlay & Shuffle/Export States
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [exportPreview, setExportPreview] = useState<{ filename: string; mimeType: string; content: string } | null>(null);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const mobileProfileMenuRef = useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTabTransitioning, setIsTabTransitioning] = useState(false);
  const [visibleProfilesCount, setVisibleProfilesCount] = useState(24);
  const [visibleReposCount, setVisibleReposCount] = useState(24);

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

  const handleTestWebhook = async () => {
    setIsTestingWebhook(true);
    setWebhookTestStatus(null);
    try {
      const response = await fetch('/api/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: tempSettings.webhookUrl,
          secret: tempSettings.webhookSecret,
        }),
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

  // Mouse Drag state for top repos carousel
  const repoCarouselRef = useRef<HTMLDivElement>(null);
  const [isDraggingRepo, setIsDraggingRepo] = useState(false);
  const [startXRepo, setStartXRepo] = useState(0);
  const [scrollLeftRepo, setScrollLeftRepo] = useState(0);

  // Mouse Drag state for nav bar
  const navContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingNav, setIsDraggingNav] = useState(false);
  const [startXNav, setStartXNav] = useState(0);
  const [scrollLeftNav, setScrollLeftNav] = useState(0);


  const handleTabChange = (newTab: 'home' | 'profiles' | 'repos' | 'logs' | 'stats') => {
    if (newTab === activeTab) return;
    setIsTabTransitioning(true);
    setActiveTab(newTab);
    setActiveFilter(null);
    setTimeout(() => {
      setIsTabTransitioning(false);
    }, 150);
  };

  useEffect(() => {
    if (activeTab === 'home') {
      setShuffleSeed(prev => prev + 1);
    }
  }, [activeTab]);

  const handleRepoMouseDown = (e: React.MouseEvent) => {
    if (!repoCarouselRef.current) return;
    setIsDraggingRepo(true);
    setStartXRepo(e.pageX - repoCarouselRef.current.offsetLeft);
    setScrollLeftRepo(repoCarouselRef.current.scrollLeft);
  };
  const handleRepoMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRepo || !repoCarouselRef.current) return;
    e.preventDefault();
    const x = e.pageX - repoCarouselRef.current.offsetLeft;
    const walk = (x - startXRepo) * 1.5;
    repoCarouselRef.current.scrollLeft = scrollLeftRepo - walk;
  };
  const handleRepoMouseUpOrLeave = () => {
    setIsDraggingRepo(false);
  };

  const handleNavMouseDown = (e: React.MouseEvent) => {
    if (!navContainerRef.current) return;
    setIsDraggingNav(true);
    setStartXNav(e.pageX - navContainerRef.current.offsetLeft);
    setScrollLeftNav(navContainerRef.current.scrollLeft);
  };
  const handleNavMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingNav || !navContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - navContainerRef.current.offsetLeft;
    const walk = (x - startXNav) * 1.5;
    navContainerRef.current.scrollLeft = scrollLeftNav - walk;
  };
  const handleNavMouseUpOrLeave = () => {
    setIsDraggingNav(false);
  };

  const [logTypeFilter, setLogTypeFilter] = useState<'ALL' | 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO'>('ALL');
  const [relativeTick, setRelativeTick] = useState(0);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [hoveredDonut, setHoveredDonut] = useState<{ name: string; value: number } | null>(null);


  // Auto-update relative times every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRelativeTick(t => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll terminal to bottom on tab load or new logs
  useEffect(() => {
    if (activeTab === 'logs' && !isTabTransitioning) {
      setTimeout(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [activeTab, logs, logTypeFilter, isTabTransitioning]);

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

  const sumSummary = useMemo(() => {
    let evaluated = 0;
    let followed = 0;
    let unfollowed = 0;
    let mutuals = 0;
    runSummary.forEach(r => {
      evaluated += (r.profiles_evaluated || 0);
      followed += (r.profiles_followed || 0);
      unfollowed += (r.profiles_unfollowed || 0);
      mutuals += (r.mutuals_found || 0);
    });
    return { evaluated, followed, unfollowed, mutuals };
  }, [runSummary]);

  const narration = useMemo(() => {
    let lastRunTimeStr = "Never";
    let timeAgoStr = "some time ago";
    let evaluatedCount = 0;
    let followedCount = 0;
    let unfollowedCount = 0;

    const latestRun = runSummary[0]; // Since it is sorted descending by ran_at
    if (latestRun) {
      const dt = new Date(latestRun.ran_at);
      lastRunTimeStr = dt.toLocaleTimeString();
      const minutesAgo = Math.floor((Date.now() - dt.getTime()) / 60000);
      if (minutesAgo < 60) {
        timeAgoStr = `${minutesAgo}m ago`;
      } else {
        const hoursAgo = Math.floor(minutesAgo / 60);
        timeAgoStr = `${hoursAgo}h ago`;
      }

      if (latestRun.run_type === 'cleanup') {
        unfollowedCount = latestRun.profiles_unfollowed;
        const lastEvalRun = runSummary.find(r => r.run_type === 'evaluation');
        if (lastEvalRun) {
          evaluatedCount = lastEvalRun.profiles_evaluated;
          followedCount = lastEvalRun.profiles_followed;
        }
      } else {
        evaluatedCount = latestRun.profiles_evaluated;
        followedCount = latestRun.profiles_followed;
        const lastCleanupRun = runSummary.find(r => r.run_type === 'cleanup');
        if (lastCleanupRun) {
          unfollowedCount = lastCleanupRun.profiles_unfollowed;
        }
      }
    } else {
      // Fallback
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
    }

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
  }, [runSummary, logs, workerStatus, stats]);

  const lastRunTask = useMemo(() => {
    return runSummary.find(r => r.run_type !== 'sync_following' && r.run_type !== 'cleanup') || null;
  }, [runSummary]);

  const lastRunTaskFormattedTime = useMemo(() => {
    if (!lastRunTask) return 'Never';
    return new Date(lastRunTask.ran_at).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }, [lastRunTask]);

  const top5Profiles = useMemo(() => {
    if (allProfiles.length === 0) return [];
    // Randomize profiles
    const shuffled = [...allProfiles].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 5);
  }, [allProfiles, shuffleSeed]);

  const top3Repos = useMemo(() => {
    if (repos.length === 0) return [];
    // Randomize repos (take up to 8 so scroll works beautifully)
    const shuffled = [...repos].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 8);
  }, [repos, shuffleSeed]);

  const last3Insights = useMemo(() => {
    const lastRunFollowed = lastRunTask?.profiles_followed || 0;
    const lastRunUnfollowed = lastRunTask?.profiles_unfollowed || 0;

    const msg1 = `Evaluated ${stats.total} total developer profiles, with ${stats.followed} high-graded developers targeted and followed.`;
    const msg2 = `In the last run, followed ${lastRunFollowed} new developers and unfollowed ${lastRunUnfollowed} inactive profiles.`;
    const msg3 = `System health status is ${workerStatus?.isJobRunning ? 'Active (Running Job)' : 'Healthy & Operational'}. Next run scheduled ${getFutureRelativeTime(workerStatus?.nextRun)}.`;

    return [msg1, msg2, msg3];
  }, [lastRunTask, stats.total, stats.followed, workerStatus]);


  // Auto-rotate Top Profile Spotlight every 4 seconds
  useEffect(() => {
    if (top5Profiles.length <= 1) return;
    const interval = setInterval(() => {
      setSpotlightIndex(prev => (prev + 1) % top5Profiles.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [top5Profiles]);

  // Auto-rotate AI Insights every 6 seconds
  useEffect(() => {
    if (last3Insights.length <= 1) return;
    const interval = setInterval(() => {
      setInsightIndex(prev => (prev + 1) % last3Insights.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [last3Insights]);

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
        if (activeFilter === 'unstarred') {
          return !repo.starred;
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
    setIsRefreshing(true);
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
      setIsRefreshing(false);
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
    const rows = allProfiles.map(p => [
      `"${p.owner}"`,
      p.reposCount,
      p.avgGrade.toFixed(1),
      `"${p.followStatus.followed ? (p.followStatus.follow_back ? 'Mutual' : 'Followed') : (p.followStatus.unfollowed ? 'Unfollowed' : 'Pending')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    setExportPreview({
      filename: `followme_profiles_${new Date().toISOString().split('T')[0]}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: csvContent
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



  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const reposRes = await supabase.from('repos').select('*');
      if (reposRes.data) setRepos(reposRes.data);
      const logsRes = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
      if (logsRes.data) setLogs(logsRes.data);
      const summaryRes = await supabase.from('run_summary').select('*').order('ran_at', { ascending: false });
      if (summaryRes.data) setRunSummary(summaryRes.data);
      await fetchStatus();
      setShuffleSeed(prev => prev + 1);
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
    if (grade >= 9.0) return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30';
    if (grade >= 7.0) return 'bg-rose-50 text-[#e60023] border border-rose-200 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold dark:bg-rose-950/20 dark:text-rose-455 dark:border-rose-900/30';
    return 'bg-orange-50 text-orange-600 border border-orange-200 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30';
  };

  // Process historical data for Recharts based on timeRange (TODAY / 7D / 30D / ALL)
  const chartData = useMemo(() => {
    const dailyMap = new Map<string, { date: string; dateObj: Date; follows: number; unfollows: number; evaluations: number; totalGrade: number; gradeCount: number }>();

    const now = new Date();
    const formatLocalDateKey = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const todayStr = formatLocalDateKey(now);
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

    if (timeRange === 'TODAY') {
      const label = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap.set(todayStr, { date: label, dateObj: now, follows: 0, unfollows: 0, evaluations: 0, totalGrade: 0, gradeCount: 0 });
    } else if (timeRange !== 'ALL') {
      const daysToInclude = timeRange === '7D' ? 7 : 30;
      for (let i = daysToInclude - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = formatLocalDateKey(d);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dailyMap.set(key, { date: label, dateObj: d, follows: 0, unfollows: 0, evaluations: 0, totalGrade: 0, gradeCount: 0 });
      }
    }

    runSummary.forEach(run => {
      if (!run.ran_at) return;
      const runDateObj = new Date(run.ran_at);
      const runDateStr = formatLocalDateKey(runDateObj);
      
      if (timeRange === 'TODAY' && runDateStr !== todayStr) return;
      if (timeRange !== 'TODAY' && timeRange !== 'ALL' && runDateObj.getTime() < cutoffDate.getTime()) return;

      if (!dailyMap.has(runDateStr)) {
        const label = runDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dailyMap.set(runDateStr, { date: label, dateObj: runDateObj, follows: 0, unfollows: 0, evaluations: 0, totalGrade: 0, gradeCount: 0 });
      }
      const dayData = dailyMap.get(runDateStr)!;
      dayData.follows += (run.profiles_followed || 0);
      dayData.unfollows += (run.profiles_unfollowed || 0);
      dayData.evaluations += (run.profiles_evaluated || 0);
    });

    repos.forEach(repo => {
      if (repo.graded_at) {
        const gradeDateObj = new Date(repo.graded_at);
        const gradeDateStr = formatLocalDateKey(gradeDateObj);
        if (dailyMap.has(gradeDateStr)) {
          const dayData = dailyMap.get(gradeDateStr)!;
          dayData.totalGrade += (repo.grade || 0);
          dayData.gradeCount++;
        }
      }
    });

    const sortedList = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, dayData]) => {
        const avgScore = dayData.gradeCount > 0 ? Number((dayData.totalGrade / dayData.gradeCount).toFixed(1)) : 0;
        return {
          key,
          date: dayData.date,
          follows: dayData.follows,
          unfollows: dayData.unfollows,
          evaluations: dayData.evaluations,
          avgScore,
          followingGrowth: 0
        };
      });

    let runningTotal = 0;
    const finalResult = sortedList.map(item => {
      runningTotal += (item.follows - item.unfollows);
      return {
        ...item,
        followingGrowth: Math.max(0, runningTotal)
      };
    });

    return finalResult;
  }, [runSummary, repos, timeRange]);

  // Compute filtered totals for the Metrics tab cards in perfect sync with Donut graph & Line chart
  const filteredSummary = useMemo(() => {
    if (timeRange === 'ALL') {
      return {
        evaluated: stats.total,
        followed: stats.followed,
        unfollowed: stats.unfollowed,
        mutuals: stats.mutuals
      };
    }
    let evaluated = 0;
    let followed = 0;
    let unfollowed = 0;
    let mutuals = 0;
    chartData.forEach(item => {
      evaluated += item.evaluations;
      followed += item.follows;
      unfollowed += item.unfollows;
    });
    const chartKeys = new Set(chartData.map(c => c.key));
    runSummary.forEach(r => {
      if (r.ran_at) {
        const localKey = `${new Date(r.ran_at).getFullYear()}-${String(new Date(r.ran_at).getMonth()+1).padStart(2,'0')}-${String(new Date(r.ran_at).getDate()).padStart(2,'0')}`;
        if (chartKeys.has(localKey)) {
          mutuals += (r.mutuals_found || 0);
        }
      }
    });
    if (mutuals === 0 && stats.mutuals > 0) mutuals = stats.mutuals;
    return { evaluated, followed, unfollowed, mutuals };
  }, [chartData, runSummary, stats, timeRange]);



  const statusDistribution = useMemo(() => {
    const acc = savedSettings.accentColor || '#e60023';
    return [
      { name: 'Followed', value: stats.followed, color: `color-mix(in srgb, ${acc} 80%, black)` },
      { name: 'Mutuals', value: stats.mutuals, color: acc },
      { name: 'Unfollowed', value: stats.unfollowed, color: `color-mix(in srgb, ${acc} 50%, white)` },
      { name: 'Skipped', value: stats.skipped, color: `color-mix(in srgb, ${acc} 25%, white)` },
      { name: 'Starred', value: stats.starred, color: `color-mix(in srgb, ${acc} 60%, black)` }
    ].filter(item => item.value > 0);
  }, [stats, savedSettings.accentColor]);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#f9f9f9] text-[#1a1c1c] dark:bg-[#0d0d0d] dark:text-[#f0f0f0] font-sans transition-colors duration-200 selection:bg-zinc-200 dark:selection:bg-zinc-800 antialiased">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&family=Geist:wght@100..900&family=Inter:ital,wght@0,100..900;1,100..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap');
        
        :root {
          --accent-color: ${savedSettings.accentColor || '#e60023'};
          --accent-hover: ${savedSettings.accentColor === '#8b5cf6' ? '#7c3aed' : savedSettings.accentColor === '#10b981' ? '#059669' : savedSettings.accentColor === '#18181b' ? '#09090b' : '#c0001b'};
        }
        
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

        /* Accent overrides "everywhere - no mercy" */
        .text-\\[\\#e60023\\] { color: var(--accent-color) !important; }
        .bg-\\[\\#e60023\\] { background-color: var(--accent-color) !important; }
        .border-\\[\\#e60023\\] { border-color: var(--accent-color) !important; }
        .hover\\:bg-\\[\\#c0001b\\]:hover { background-color: var(--accent-hover) !important; }
        .text-red-500 { color: var(--accent-color) !important; }
        .text-red-600 { color: var(--accent-color) !important; }
        .bg-red-500 { background-color: var(--accent-color) !important; }
        .bg-red-650 { background-color: var(--accent-color) !important; }
        .bg-red-600 { background-color: var(--accent-color) !important; }
        .border-red-500 { border-color: var(--accent-color) !important; }
        .border-red-600 { border-color: var(--accent-color) !important; }
        .text-rose-700 { color: var(--accent-color) !important; }
        .bg-rose-50 { background-color: color-mix(in srgb, var(--accent-color) 8%, transparent) !important; }
        .bg-red-500\\/10 { background-color: color-mix(in srgb, var(--accent-color) 10%, transparent) !important; }
        .border-red-500\\/20 { border-color: color-mix(in srgb, var(--accent-color) 20%, transparent) !important; }
        .border-\\[\\#e60023\\]\\/30 { border-color: color-mix(in srgb, var(--accent-color) 30%, transparent) !important; }
        .focus\\:border-\\[\\#e60023\\]:focus { border-color: var(--accent-color) !important; }
        .focus\\:ring-\\[\\#e60023\\]:focus { --tw-ring-color: var(--accent-color) !important; }
        ::selection {
          background-color: var(--accent-color) !important;
          color: white !important;
        }
      ` }} />

      <div className="flex flex-1 flex-col md:flex-row relative">
        
        {/* HAMBURGER TOP BAR FOR MOBILE */}
        <div className="h-14 bg-white dark:bg-[#111111] border-b border-[#dadada] dark:border-[#2a2a2a] md:hidden flex items-center justify-between px-4 z-30 shrink-0">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 border border-[#dadada] dark:border-[#2a2a2a] bg-white dark:bg-[#111111] text-[#1a1c1c] dark:text-[#f0f0f0] rounded-lg transition-all cursor-pointer"
          >
            {isSidebarOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>

          <div 
            onClick={() => setActiveTab('home')}
            className="flex items-center space-x-2.5 cursor-pointer hover:opacity-90 absolute left-1/2 -translate-x-1/2"
          >
            <div className="h-7 w-7 rounded-lg bg-[#e60023] flex items-center justify-center text-white font-bold text-sm font-jakarta">F</div>
            <span className="font-bold tracking-tight font-jakarta text-[#1a1c1c] dark:text-[#f0f0f0] text-sm">FollowMe</span>
          </div>

          <div className="relative" ref={mobileProfileMenuRef}>
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="h-9 w-9 rounded-full border-2 border-red-500/60 p-0.5 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-sm relative overflow-hidden bg-zinc-100 dark:bg-zinc-800"
              title="Profile Menu"
            >
              <img
                src="https://github.com/madhanio.png"
                alt="Madhan"
                className="h-full w-full rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://github.com/github.png";
                }}
              />
            </button>

            {isProfileMenuOpen && (
              <div 
                className="absolute right-0 mt-3 w-60 bg-white dark:bg-[#121215] border border-[#dadada] dark:border-[#2a2a2a] rounded-2xl shadow-2xl p-4 z-50 space-y-3 font-sans animate-in fade-in zoom-in-95"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center space-x-3 pb-3 border-b border-[#eeeeee] dark:border-[#2a2a2a]">
                  <img
                    src="https://github.com/madhanio.png"
                    alt="Madhan Profile"
                    className="h-10 w-10 rounded-full border border-red-500/40 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://github.com/github.png";
                    }}
                  />
                  <div>
                    <h4 className="font-bold font-jakarta text-xs text-[#1a1c1c] dark:text-[#f0f0f0]">Madhan</h4>
                    <span className="text-[10px] font-mono text-zinc-400">@madhanio</span>
                  </div>
                </div>

                {/* Body options */}
                <div className="space-y-1 font-geist text-xs">
                  <button 
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setIsSettingsOpen(true);
                      setTempSettings(savedSettings);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-[#f3f3f3] dark:hover:bg-[#1c1c1f] hover:text-[#1a1c1c] dark:hover:text-[#f0f0f0] cursor-pointer transition text-left font-bold"
                  >
                    <Settings className="h-4.5 w-4.5 text-zinc-450" />
                    <span>Dashboard Settings</span>
                  </button>
                  <button 
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setIsSecurityModalOpen(true);
                      setCurrentSecKey('');
                      setNewSecKey('');
                      setConfirmSecKey('');
                      setSecKeyError(null);
                      setSecKeySuccess(null);
                    }}
                    className="w-full flex flex-row items-center space-x-2.5 px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-[#f3f3f3] dark:hover:bg-[#1c1c1f] hover:text-[#1a1c1c] dark:hover:text-[#f0f0f0] cursor-pointer transition text-left font-bold"
                  >
                    <Lock className="h-4.5 w-4.5 text-zinc-450" />
                    <span>Security & Access Key</span>
                  </button>
                  <button 
                    onClick={toggleDarkMode}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-[#f3f3f3] dark:hover:bg-[#1c1c1f] hover:text-[#1a1c1c] dark:hover:text-[#f0f0f0] cursor-pointer transition text-left font-bold"
                  >
                    <div className="flex items-center space-x-2.5">
                      {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-400" />}
                      <span>Theme Mode</span>
                    </div>
                  </button>
                </div>

                {/* Footer sign out */}
                <div className="pt-2.5 border-t border-[#eeeeee] dark:border-[#2a2a2a] flex justify-end">
                  <button 
                    onClick={async () => {
                      setIsProfileMenuOpen(false);
                      document.cookie = "auth_key=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                      router.push('/login');
                    }}
                    className="px-4 py-1.5 bg-[#e60023] hover:bg-[#c0001b] text-white text-[10px] font-bold rounded-full transition cursor-pointer font-geist active:scale-95 shadow-xs"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
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
                <span className="text-[9px] uppercase font-mono font-semibold tracking-wider text-slate-400 dark:text-zinc-500 mt-1 block">AI Agent Control</span>
              </div>
            </div>

            {/* Menu Links */}
            <nav className="space-y-1 font-geist">
              {[
                { tab: 'home', label: 'Explore', count: null, icon: Compass },
                { tab: 'profiles', label: 'Profiles', count: filteredProfiles.length, icon: Layers },
                { tab: 'repos', label: 'Repos', count: filteredRepos.length, icon: Star },
                { tab: 'logs', label: 'Logs', count: logs.length, icon: Terminal },
                { tab: 'stats', label: 'Metrics', count: null, icon: TrendingUp }
              ].map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.tab;
                return (
                  <button 
                    key={item.tab}
                    onClick={() => {
                      handleTabChange(item.tab as any);
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
                      <span className="px-2 py-0.5 rounded-full bg-[#f3f3f3] dark:bg-[#2a2a2a] text-xs font-mono font-bold text-[#767676] dark:text-zinc-400">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

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
        <main className={`flex-1 flex flex-col min-w-0 h-screen ${
          isSettingsOpen || isSecurityModalOpen || isCleanupOpen || isSidebarOpen || exportPreview 
            ? 'overflow-hidden' 
            : 'overflow-y-auto'
        }`}>
          
          {/* TOP APP BAR */}
          <header className="h-16 bg-white dark:bg-[#111111] border-b border-[#dadada] dark:border-[#2a2a2a] flex items-center justify-center md:justify-end px-4 md:px-6 shrink-0 z-20 gap-4">
            {activeTab !== 'stats' && activeTab !== 'home' && (
              <div className="flex items-center space-x-4 flex-1 max-w-md md:block hidden mr-auto">
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
              </div>
            )}

            <div className="flex items-center justify-center space-x-3 font-geist relative w-full md:w-auto flex-wrap">
              <button 
                onClick={handleSync}
                disabled={isSyncing || workerStatus?.isJobRunning}
                className="min-h-[36px] px-3.5 flex items-center space-x-1.5 bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] hover:bg-[#f3f3f3] dark:hover:bg-[#1a1a1a] text-[#1a1c1c] dark:text-[#f0f0f0] text-xs font-bold rounded-full cursor-pointer transition-all disabled:opacity-40 aura-shadow active:scale-95"
                title="Sync Repos"
              >
                {isSyncing ? <RotateCw className="h-3.5 w-3.5 animate-spin text-[#e60023] shrink-0" /> : <RotateCw className="h-3.5 w-3.5 text-[#e60023] shrink-0" />}
                <span>Sync</span>
              </button>

              {/* Icon-only Cleanup Cache */}
              <button 
                onClick={() => setIsCleanupOpen(true)}
                disabled={workerStatus?.isJobRunning}
                className="h-9 w-9 flex items-center justify-center bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] hover:bg-[#f3f3f3] dark:hover:bg-[#1a1a1a] text-[#1a1c1c] dark:text-[#f0f0f0] rounded-full cursor-pointer transition-all disabled:opacity-40 aura-shadow active:scale-95 shrink-0"
                title="Cleanup Cache"
              >
                <Trash2 className="h-4 w-4 text-blue-500 shrink-0" />
              </button>

              {/* Icon-only Refresh Data */}
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing || isSyncing}
                className="h-9 w-9 flex items-center justify-center bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] hover:bg-[#f3f3f3] dark:hover:bg-[#1a1a1a] text-[#1a1c1c] dark:text-[#f0f0f0] rounded-full cursor-pointer transition-all disabled:opacity-40 aura-shadow active:scale-95 shrink-0"
                title="Refresh Data"
              >
                <RotateCw className={`h-4 w-4 text-zinc-500 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>

              <button 
                onClick={handleTrigger}
                disabled={isTriggering || workerStatus?.isJobRunning}
                className="min-h-[36px] px-4 flex items-center space-x-1.5 bg-[#e60023] hover:bg-[#c0001b] disabled:bg-slate-350 text-white text-xs font-bold rounded-full transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5 fill-current shrink-0" />
                <span>{isTriggering ? 'Running...' : 'Run Task'}</span>
              </button>

              {/* Top-Right Profile Icon Avatar & Dropdown - Hidden on Mobile */}
              <div className="relative ml-2 md:block hidden" ref={profileMenuRef}>

                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="h-9 w-9 rounded-full border-2 border-red-500/60 p-0.5 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-sm relative overflow-hidden bg-zinc-100 dark:bg-zinc-800"
                  title="Profile Menu"
                >
                  <img
                    src="https://github.com/madhanio.png"
                    alt="Madhan"
                    className="h-full w-full rounded-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://github.com/github.png";
                    }}
                  />
                </button>

                {/* Profile Popup Dropdown */}
                {isProfileMenuOpen && (
                  <div 
                    className="absolute right-0 mt-3 w-64 bg-white dark:bg-[#121215] border border-[#dadada] dark:border-[#2a2a2a] rounded-2xl shadow-2xl p-4 z-50 space-y-3 font-sans animate-in fade-in zoom-in-95"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="flex items-center space-x-3 pb-3 border-b border-[#eeeeee] dark:border-[#2a2a2a]">
                      <img
                        src="https://github.com/madhanio.png"
                        alt="Madhan Profile"
                        className="h-10 w-10 rounded-full border border-red-500/40 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://github.com/github.png";
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta truncate">Madhan</h4>
                        <span className="text-[10px] font-mono text-zinc-400 block truncate">@madhanio</span>
                      </div>
                    </div>

                    {/* Agent Worker Status */}
                    <div className="bg-[#f8f9fa] dark:bg-[#1a1a1e] rounded-xl p-2.5 text-[10px] font-mono space-y-1">
                      <div className="flex items-center justify-between font-bold text-zinc-500">
                        <span>Worker Status</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${workerStatus?.isJobRunning ? 'bg-amber-500/20 text-amber-500 animate-pulse' : 'bg-emerald-500/20 text-emerald-500'}`}>
                          {workerStatus?.isJobRunning ? 'RUNNING' : 'ACTIVE'}
                        </span>
                      </div>
                      <div className="text-[9px] text-zinc-400 truncate">
                        Schedule: Every 6 hours • Worker Online
                      </div>
                    </div>

                    {/* Menu Actions */}
                    <div className="space-y-1 text-xs font-medium pt-1">
                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          setIsSettingsOpen(true);
                          setTempSettings(savedSettings);
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-[#1a1c1c] dark:text-[#f0f0f0] hover:bg-[#f3f3f3] dark:hover:bg-[#1e1e24] transition-all cursor-pointer"
                      >
                        <Settings className="h-4 w-4 text-blue-500" />
                        <span>Settings</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          setIsSecurityModalOpen(true);
                          setCurrentSecKey('');
                          setNewSecKey('');
                          setConfirmSecKey('');
                          setSecKeyError(null);
                          setSecKeySuccess(null);
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-[#1a1c1c] dark:text-[#f0f0f0] hover:bg-[#f3f3f3] dark:hover:bg-[#1e1e24] transition-all cursor-pointer"
                      >
                        <Lock className="h-4 w-4 text-emerald-500" />
                        <span>Security Key</span>
                      </button>

                      <button
                        onClick={toggleDarkMode}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[#1a1c1c] dark:text-[#f0f0f0] hover:bg-[#f3f3f3] dark:hover:bg-[#1e1e24] transition-all cursor-pointer"
                      >
                        <div className="flex items-center space-x-2.5">
                          {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-400" />}
                          <span>Mode: {isDark ? 'Dark' : 'Light'}</span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">Toggle</span>
                      </button>

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer font-bold"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Logout</span>
                      </button>

                    </div>
                  </div>
                )}
              </div>
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
                            {/* TAB OPTIONS HEADER */}
              <div className="pb-4 border-b border-[#dadada] dark:border-[#2a2a2a] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold font-jakarta text-[#1a1c1c] dark:text-[#f0f0f0] leading-tight">
                    {activeTab === 'home' && "Welcome back, Madhan!"}
                    {activeTab === 'profiles' && "Developer Profiles"}
                    {activeTab === 'repos' && "Repository Pins"}
                    {activeTab === 'logs' && "Activity Logs"}
                    {activeTab === 'stats' && "Evaluation Metrics"}
                  </h2>
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">
                    {activeTab === 'home' && "AI Automated Follow & Graded Repositories Control Center"}
                    {activeTab === 'profiles' && "Evaluated developers & status classifications"}
                    {activeTab === 'repos' && "Discovered and graded software repositories"}
                    {activeTab === 'logs' && "Real-time execution log console"}
                    {activeTab === 'stats' && "Historical analytics and performance stats"}
                  </p>
                </div>

                {/* Filter Pills for Profiles Tab */}
                {activeTab === 'profiles' && (
                  <div className="flex flex-wrap items-center gap-2 font-geist">
                    {[
                      { id: null, label: 'All' },
                      { id: 'followed', label: 'Followed' },
                      { id: 'unfollowed', label: 'Unfollowed' },
                      { id: 'mutual', label: 'Mutuals' }
                    ].map(pill => {
                      const isSelected = activeFilter === pill.id;
                      return (
                        <button
                          key={pill.label}
                          onClick={() => setActiveFilter(pill.id as any)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-[#e60023] text-white border-[#e60023] shadow-sm'
                              : 'bg-transparent text-[#767676] border-[#dadada] dark:border-[#2a2a2a] hover:text-[#1a1c1c] dark:hover:text-[#f0f0f0]'
                          }`}
                        >
                          {pill.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Filter Pills for Repos Tab */}
                {activeTab === 'repos' && (
                  <div className="flex flex-wrap items-center gap-2 font-geist">
                    {[
                      { id: null, label: 'All' },
                      { id: 'starred', label: 'Starred' },
                      { id: 'unstarred', label: 'Unstarred' }
                    ].map(pill => {
                      const isSelected = activeFilter === pill.id || (pill.id === 'unstarred' && activeFilter === 'unstarred');
                      return (
                        <button
                          key={pill.label}
                          onClick={() => setActiveFilter(pill.id as any)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-[#e60023] text-white border-[#e60023] shadow-sm'
                              : 'bg-transparent text-[#767676] border-[#dadada] dark:border-[#2a2a2a] hover:text-[#1a1c1c] dark:hover:text-[#f0f0f0]'
                          }`}
                        >
                          {pill.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tab Switching Skeleton Transition Loader */}
              {(isTabTransitioning || isRefreshing) && (
                <div className="space-y-6 animate-pulse py-4">
                  <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-1/3" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="h-44 bg-zinc-200 dark:bg-zinc-800 rounded-3xl" />
                    <div className="h-44 bg-zinc-200 dark:bg-zinc-800 rounded-3xl" />
                    <div className="h-44 bg-zinc-200 dark:bg-zinc-800 rounded-3xl" />
                  </div>
                  <div className="h-60 bg-zinc-200 dark:bg-zinc-800 rounded-3xl" />
                </div>
              )}

              {/* 0. HOMEPAGE TAB */}
              {!isTabTransitioning && !isRefreshing && activeTab === 'home' && (
                <div className="masonry-grid">
                               {/* Card 1: Top Profile Card -> Rotating Spotlight */}
                  {top5Profiles.length > 0 && (() => {
                    const profile = top5Profiles[spotlightIndex];
                    if (!profile) return null;
                    const status = profile.followStatus;
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
                      badgeClass = "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/20 dark:text-rose-455";
                      badgeLabel = "Unfollowed";
                    } else if (isSkipped) {
                      badgeClass = "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-955/20 dark:text-orange-400";
                      badgeLabel = "Skipped";
                    }

                    return (
                      <div 
                        onClick={() => setActiveTab('profiles')}
                        className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-[32px] aura-shadow hover:shadow-lg dark:hover:shadow-black/40 aura-shadow-hover transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[245px]"
                      >
                        {/* Redesigned Spotlight Top Header Row (Unified Layout) */}
                        <div className="h-14 bg-slate-100 dark:bg-[#1c1c1e] border-b border-[#dadada] dark:border-[#2a2a2a] flex items-center justify-between px-4 shrink-0">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <img 
                              src={`https://github.com/${profile.owner}.png`} 
                              alt={profile.owner} 
                              className="h-8 w-8 rounded-full border border-white dark:border-[#111111] bg-zinc-100 dark:bg-[#1a1a1a] object-cover aura-shadow shrink-0" 
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://unavatar.io/github/${profile.owner}`;
                              }}
                            />
                            <div className="truncate">
                              <div className="flex items-center gap-1 leading-none mb-1">
                                <span className="h-1 w-1 rounded-full bg-[#e60023] animate-pulse" />
                                <span className="text-[8px] uppercase font-bold text-[#e60023] font-jakarta tracking-wider">Spotlight</span>
                              </div>
                              <h3 className="text-xs font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta truncate leading-none">
                                @{profile.owner}
                              </h3>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] border font-mono font-bold shrink-0 ${badgeClass}`}>
                              {badgeLabel}
                            </span>
                          </div>
                        </div>

                        {/* Card Content */}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>

                          {/* Visual center grade block */}
                          <div className="bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] py-2 px-3 rounded-lg text-center my-3 relative overflow-hidden flex items-center justify-between">
                            <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#767676]">Average Quality Score</span>
                            <span className="text-sm font-extrabold text-[#e60023] font-mono leading-none">{(profile.avgGrade).toFixed(1)}/10</span>
                          </div>

                          {profile.repos[0]?.readme_snippet && (
                            <p className="text-xs font-sans text-[#767676] dark:text-zinc-400 line-clamp-2 leading-relaxed mt-1">
                              {cleanSnippet(profile.repos[0].readme_snippet)}
                            </p>
                          )}
                        </div>
                        </div>

                        <div className="flex items-center justify-between px-5 pb-4 pt-2 border-t border-[#eeeeee] dark:border-[#2a2a2a]">
                          <div className="flex items-center space-x-3 font-mono text-[10px] text-[#767676]">
                            <span>{profile.repos[0]?.language || 'Unknown'}</span>
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-current text-amber-500" />
                              {profile.repos.reduce((acc: number, r: any) => acc + r.stars, 0)} Stars
                            </span>
                          </div>
                          
                          {/* Navigation dots */}
                          <div className="flex space-x-1">
                            {top5Profiles.map((_: any, idx: number) => (
                              <button
                                key={idx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSpotlightIndex(idx);
                                }}
                                className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${spotlightIndex === idx ? 'bg-[#e60023] w-3' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Card 2: Featured Repository -> Horizontal Scroll Strip */}
                  {top3Repos.length > 0 && (
                    <div className="masonry-item space-y-3 bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-[32px] p-5 aura-shadow">
                      <div className="flex items-center justify-between px-1 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#e60023] font-jakarta">Top Graded Repositories</span>
                        <span className="text-[9px] font-mono text-zinc-400 select-none">Swipe &larr;</span>
                      </div>
                      
                      <div 
                        ref={repoCarouselRef}
                        onMouseDown={handleRepoMouseDown}
                        onMouseMove={handleRepoMouseMove}
                        onMouseUp={handleRepoMouseUpOrLeave}
                        onMouseLeave={handleRepoMouseUpOrLeave}
                        className="flex overflow-x-auto space-x-4 pb-2 scrollbar-none [scrollbar-width:none] [&-::-webkit-scrollbar]:hidden select-none cursor-grab active:cursor-grabbing scroll-smooth"
                      >
                        {top3Repos.map((repo: Repo) => (
                          <div 
                            key={repo.id}
                            onClick={() => handleTabChange('repos')}
                            className="flex-shrink-0 w-[270px] bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] rounded-[24px] p-4 hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing flex flex-col justify-between min-h-[160px]"
                          >
                            <div className="flex items-start justify-between">
                              <div className="min-w-0 pr-2">
                                <span className="text-[9px] font-bold text-[#767676] block">@{repo.owner}</span>
                                <h4 className="text-sm font-extrabold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta leading-tight truncate mt-0.5">{repo.name}</h4>
                              </div>
                              <span className={getGradeColor(repo.grade)}>
                                {repo.grade.toFixed(1)}/10
                              </span>
                            </div>

                            {repo.readme_snippet && (
                              <p className="text-[11px] font-sans text-[#767676] dark:text-zinc-400 line-clamp-2 leading-relaxed my-2">
                                {cleanSnippet(repo.readme_snippet)}
                              </p>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t border-[#eeeeee] dark:border-[#2a2a2a]">
                              <span className="flex items-center gap-1.5 font-mono text-[9px] text-[#767676]">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#e60023]" />
                                {repo.language || 'Unknown'}
                              </span>
                              <span className="flex items-center gap-1 font-mono text-[9px] text-amber-500">
                                <Star className="h-3 w-3 fill-current" /> {repo.stars}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Card 3: Recent Logs Card */}
                  <div 
                    onClick={() => handleTabChange('logs')}
                    className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-[32px] aura-shadow hover:shadow-lg dark:hover:shadow-black/40 aura-shadow-hover transition-all duration-200 cursor-pointer p-5 flex flex-col space-y-4"
                  >
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-sm font-bold font-jakarta text-[#1a1c1c] dark:text-[#f0f0f0]">Recent Logs</h3>
                      <span className="text-zinc-400 font-bold tracking-widest text-[10px]">...</span>
                    </div>

                    <div className="space-y-3 font-sans text-xs">
                      {logs.slice(0, 3).map(log => {
                        let dotColor = "bg-blue-400";
                        if (log.status === 'SUCCESS') dotColor = "bg-[#10b981]";
                        else if (log.status === 'FAILED' || log.status === 'ERROR') dotColor = "bg-rose-500";
                        else if (log.status === 'WARN') dotColor = "bg-orange-500";
                        
                        return (
                          <div key={log.id} className="p-3 bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] rounded-[20px] flex items-start space-x-3 transition-all hover:bg-slate-50 dark:hover:bg-[#202022]">
                            <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
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

                    <div className="pt-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTabChange('logs');
                        }}
                        className="w-full min-h-[38px] bg-[#e60023] hover:bg-[#c0001b] text-white text-xs font-bold rounded-full transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center space-x-1.5"
                      >
                        <span>View System Console</span>
                      </button>
                    </div>
                  </div>
                  {/* Card 4: Stats Snapshot Card -> Clickable Redirect to Metrics Tab */}
                  <div 
                    onClick={() => handleTabChange('stats')}
                    className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] hover:border-[#e60023]/50 rounded-[32px] aura-shadow p-5 flex flex-col space-y-4 cursor-pointer transition-all hover:shadow-lg select-none"
                    title="Click to view full Evaluation Metrics"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#e60023] font-jakarta">Activity Snapshot</span>
                      <ChevronRight className="h-4 w-4 text-[#e60023]" />
                    </div>

                    
                    <div className="grid grid-cols-2 gap-3.5">
                      {/* GRADED */}
                      <div className="bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] p-4 rounded-[20px] text-center flex flex-col justify-center">
                        <span className="text-3xl font-extrabold text-[#e60023] font-mono leading-none">{stats.total}</span>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-[#767676] mt-2 block">Graded</span>
                      </div>
                      {/* FOLLOWED */}
                      <div className="bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] p-4 rounded-[20px] text-center flex flex-col justify-center">
                        <span className="text-3xl font-extrabold text-[#e60023] font-mono leading-none">{stats.followed}</span>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-[#767676] mt-2 block">Followed</span>
                      </div>
                      {/* MUTUALS */}
                      <div className="bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] p-4 rounded-[20px] text-center flex flex-col justify-center">
                        <span className="text-3xl font-extrabold text-[#e60023] font-mono leading-none">{stats.mutuals}</span>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-[#767676] mt-2 block">Mutuals</span>
                      </div>
                      {/* SKIPPED */}
                      <div className="bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] p-4 rounded-[20px] text-center flex flex-col justify-center">
                        <span className="text-3xl font-extrabold text-[#e60023] font-mono leading-none">{stats.skipped}</span>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-[#767676] mt-2 block">Skipped</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 5: AI Narrator Card */}
                  <div className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-[32px] aura-shadow p-5 flex flex-col space-y-4 cursor-default">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-[#e60023]">
                        <Zap className="h-4 w-4 fill-current" />
                        <span className="text-[10px] font-bold uppercase tracking-wider font-jakarta">Agent Insight</span>
                      </div>
                      <span className="text-[9px] font-mono text-zinc-400 flex items-center gap-1.5 select-none">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#e60023] animate-pulse" />
                        {lastRunTaskFormattedTime}
                      </span>
                    </div>

                    {/* Speech-bubble block styling */}
                    <div className="relative p-4 rounded-[20px] bg-rose-50 border border-rose-100 dark:bg-rose-950/15 dark:border-rose-900/30 text-rose-700 dark:text-rose-455 font-sans text-xs leading-relaxed transition-all duration-500">
                      <div className="absolute top-[-6px] left-6 w-3 h-3 bg-rose-50 border-t border-l border-rose-100 dark:bg-[#281116] dark:border-rose-900/30 transform rotate-45" />
                      "{last3Insights[insightIndex]}"
                    </div>

                    <div className="flex items-center space-x-2 text-[10px] font-mono text-[#767676]">
                      <span className="h-2 w-2 rounded-full bg-[#e60023] animate-pulse" />
                      <span>GitAuto Agent Alpha</span>
                    </div>
                  </div>

                </div>
              )}
              {/* 1. PROFILES TAB */}
              {!isTabTransitioning && !isRefreshing && activeTab === 'profiles' && (
                <div className="space-y-6">
                  <div className="masonry-grid">
                    {isRefreshing ? (
                      [1, 2, 3].map(n => <div key={n} className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-5 h-[160px] animate-pulse" />)
                    ) : filteredProfiles.length === 0 ? (
                      <div className="col-span-full py-16 flex flex-col items-center justify-center bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl text-center text-xs font-mono text-[#767676] space-y-3">
                        <Lottie animationData={mainCharacter} loop={true} className="w-32 h-32 opacity-80" />
                        <p>No profiles found matching search query/filters.</p>
                      </div>
                    ) : (
                      filteredProfiles.slice(0, visibleProfilesCount).map(profile => (
                        <div key={profile.owner} className="masonry-item">
                          <ProfileCard
                            profile={profile}
                            onFollow={handleFollowUser}
                            onUnfollow={handleUnfollowUser}
                            onDelete={handleDeleteProfile}
                            isActionLoading={isActionLoading}
                            setActiveTab={setActiveTab}
                            setSearchTerm={setSearchTerm}
                          />
                        </div>
                      ))
                    )}
                  </div>
                  {filteredProfiles.length > visibleProfilesCount && (
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={() => setVisibleProfilesCount(prev => prev + 24)}
                        className="px-6 py-2.5 bg-white dark:bg-[#111111] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-[#dadada] dark:border-[#2a2a2a] text-[#1a1c1c] dark:text-[#f0f0f0] text-xs font-bold rounded-full transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        Load More Profiles
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 2. REPOS TAB */}
              {!isTabTransitioning && !isRefreshing && activeTab === 'repos' && (
                <div className="space-y-6">
                  <div className="masonry-grid">
                    {isRefreshing ? (
                      [1, 2, 3].map(n => <div key={n} className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-5 h-[160px] animate-pulse" />)
                    ) : filteredRepos.length === 0 ? (
                      <div className="col-span-full py-16 flex flex-col items-center justify-center bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl text-center text-xs font-mono text-[#767676] space-y-3">
                        <Lottie animationData={mainCharacter} loop={true} className="w-32 h-32 opacity-80" />
                        <p>No repositories found matching search query/filters.</p>
                      </div>
                    ) : (
                      filteredRepos.slice(0, visibleReposCount).map(repo => (
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
                                <h3 className="text-xl font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta leading-tight truncate">{repo.name}</h3>
                              </div>
                            </div>
                            <span className={getGradeColor(repo.grade)}>
                              {repo.grade.toFixed(1)}/10
                            </span>
                          </div>

                          {repo.readme_snippet && (
                            <p className="text-xs font-sans text-[#767676] dark:text-zinc-400 line-clamp-3 leading-relaxed">
                              {cleanSnippet(repo.readme_snippet) || 'No readme description.'}
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
                              {repo.starred && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400">Starred</span>}
                              {repo.followed && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#0058bb] border border-blue-200 dark:bg-blue-950/20 dark:text-blue-400">Followed</span>}
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            {repo.starred ? (
                              <button 
                                onClick={() => handleUnstar(repo.owner, repo.name)}
                                className="flex-1 min-h-[34px] flex items-center justify-center bg-transparent border border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/10 text-xs font-bold rounded-full cursor-pointer transition-all font-geist"
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
                  {filteredRepos.length > visibleReposCount && (
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={() => setVisibleReposCount(prev => prev + 24)}
                        className="px-6 py-2.5 bg-white dark:bg-[#111111] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-[#dadada] dark:border-[#2a2a2a] text-[#1a1c1c] dark:text-[#f0f0f0] text-xs font-bold rounded-full transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        Load More Repositories
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 3. LOGS TAB */}
              {!isTabTransitioning && !isRefreshing && activeTab === 'logs' && (
                <div className="space-y-4">
                  {/* Type Filter pills */}
                  <div className="flex flex-wrap gap-2">
                    {(['ALL', 'SUCCESS', 'ERROR', 'WARN', 'INFO'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setLogTypeFilter(type)}
                        className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-all cursor-pointer select-none active:scale-95 ${
                          logTypeFilter === type
                            ? 'bg-[#e60023] border-[#e60023] text-white shadow-sm'
                            : 'bg-white border-[#dadada] text-[#767676] hover:bg-zinc-50 hover:text-[#1a1c1c] dark:bg-[#111] dark:border-[#2a2a2a] dark:text-zinc-400 dark:hover:bg-[#1a1a1a] dark:hover:text-[#f0f0f0]'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Viewport: macOS Terminal Window */}
                    <div className="lg:col-span-2 flex flex-col">
                      {/* Header Bar */}
                      <div className="bg-[#18181b] border border-zinc-800 px-4 py-3 flex items-center justify-between text-zinc-400 font-mono text-xs rounded-t-2xl">
                        <div className="flex items-center space-x-2 shrink-0 select-none">
                          <span className="h-3 w-3 rounded-full bg-[#ef4444] border border-[#d63d3d]" />
                          <span className="h-3 w-3 rounded-full bg-[#f59e0b] border border-[#dc8f0a]" />
                          <span className="h-3 w-3 rounded-full bg-[#10b981] border border-[#0ea26b]" />
                        </div>
                        <span className="font-bold text-zinc-350 tracking-tight">SYSTEM_MONITOR_V4.2.LOG</span>
                        <span className="text-[10px] opacity-60">UTC -05:00</span>
                      </div>

                      {/* Terminal Body */}
                      <div className="bg-[#09090b] text-zinc-300 font-mono text-xs p-5 overflow-y-auto no-scrollbar h-[480px] space-y-3.5 rounded-b-2xl border border-zinc-800 border-t-0 select-text">
                        {isRefreshing ? (
                          [1, 2, 3].map(n => <div key={n} className="h-8 bg-zinc-900 rounded animate-pulse" />)
                        ) : (() => {
                          const displayedLogs = [...filteredLogs]
                            .filter(log => {
                              if (logTypeFilter === 'ALL') return true;
                              if (logTypeFilter === 'SUCCESS') return log.status === 'SUCCESS';
                              if (logTypeFilter === 'ERROR') return log.status === 'ERROR' || log.status === 'FAILED';
                              if (logTypeFilter === 'WARN') return log.status === 'WARN';
                              if (logTypeFilter === 'INFO') return log.status === 'INFO' || log.status === 'SYSTEM';
                              return true;
                            })
                            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                          if (displayedLogs.length === 0) {
                            return <div className="py-12 text-center text-zinc-500">No active logs matching search filters.</div>;
                          }

                          return (
                            <>
                              {displayedLogs.map(log => {
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
                                  <div key={log.id} className="flex items-start space-x-2 leading-relaxed tracking-normal animate-fade-in-line">
                                    <span className="text-zinc-600 shrink-0 select-none">
                                      {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                    <span className={`shrink-0 ${prefixColor}`}>{prefixLabel}</span>
                                    <span className="text-zinc-400 font-bold shrink-0">@{log.action}:</span>
                                    <span className="text-zinc-200 select-all">{log.message}</span>
                                  </div>
                                );
                              })}
                              <div ref={terminalEndRef} />
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Right Viewport: Agent Status Panel */}
                    <div className="lg:col-span-1">
                      <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-[32px] p-6 flex flex-col justify-between min-h-[480px] shadow-lg relative overflow-hidden aura-shadow">
                        <div>
                          <div className="flex items-center justify-between mb-4 border-b border-[#eeeeee] dark:border-[#2a2a2a] pb-3">
                            <h3 className="text-base font-extrabold font-jakarta tracking-tight text-[#1a1c1c] dark:text-[#f0f0f0]">Agent Status Panel</h3>
                            
                            <div className="flex items-center space-x-2 select-none">
                              <span className={`h-2.5 w-2.5 rounded-full ${workerStatus?.isJobRunning ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                              <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-[#767676]">
                                {workerStatus?.isJobRunning ? 'RUNNING' : 'IDLE'}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-4 font-sans text-xs mb-6">
                            <div className="flex items-center justify-between py-2 border-b border-[#eeeeee] dark:border-[#2a2a2a]">
                              <span className="font-medium text-[#767676]">Last Execution</span>
                              <span className="font-extrabold text-[#1a1c1c] dark:text-[#f0f0f0] font-mono">
                                {lastRunTask ? getRelativeTime(lastRunTask.ran_at) : 'Never'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-[#eeeeee] dark:border-[#2a2a2a]">
                              <span className="font-medium text-[#767676]">Next Scheduled Run</span>
                              <span className="font-extrabold text-[#1a1c1c] dark:text-[#f0f0f0] font-mono">
                                {getFutureRelativeTime(workerStatus?.nextRun)}
                              </span>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#e60023]">Last Run Statistics</h4>
                              <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-mono font-bold">
                                from last run
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
                              <div className="bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] p-2.5 rounded-xl">
                                <span className="text-base font-bold text-[#e60023] block leading-none">{lastRunTask?.profiles_evaluated || 0}</span>
                                <span className="text-[8px] uppercase tracking-wider text-[#767676] mt-1.5 block">Evaluated</span>
                              </div>
                              <div className="bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] p-2.5 rounded-xl">
                                <span className="text-base font-bold text-[#e60023] block leading-none">{lastRunTask?.profiles_followed || 0}</span>
                                <span className="text-[8px] uppercase tracking-wider text-[#767676] mt-1.5 block">Followed</span>
                              </div>
                              <div className="bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] p-2.5 rounded-xl">
                                <span className="text-base font-bold text-[#e60023] block leading-none">{lastRunTask?.profiles_unfollowed || 0}</span>
                                <span className="text-[8px] uppercase tracking-wider text-[#767676] mt-1.5 block">Unfollowed</span>
                              </div>
                              <div className="bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] p-2.5 rounded-xl">
                                <span className="text-base font-bold text-[#e60023] block leading-none">{lastRunTask?.mutuals_found || 0}</span>
                                <span className="text-[8px] uppercase tracking-wider text-[#767676] mt-1.5 block">Mutuals</span>
                              </div>
                            </div>
                          </div>
                        </div>


                        <div className="mt-6 flex items-center justify-center bg-rose-50 dark:bg-rose-950/15 border border-rose-100 dark:border-rose-900/30 p-2.5 rounded-xl font-mono text-[9px] font-bold tracking-widest text-[#e60023] text-center select-none">
                          <span className="h-2 w-2 rounded-full bg-[#e60023] mr-2 animate-ping" />
                          LIVE STREAM ACTIVE
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!isTabTransitioning && !isRefreshing && activeTab === 'stats' && mounted && (
                <div className="space-y-8 animate-startup-card">
                  {/* Date toggle & Data Export toolbar */}
                  <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-4 aura-shadow">
                    <div className="flex items-center space-x-3 flex-wrap gap-2">
                      <span className="text-xs font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta">Plot Historical Ranges:</span>
                      <div className="flex bg-[#eeeeee] dark:bg-[#1a1a1a] p-1 rounded-full text-xs font-bold font-geist">
                        {(['TODAY', '7D', '30D', 'ALL'] as const).map(range => (
                          <button 
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                              timeRange === range 
                                ? 'bg-[#e60023] text-white font-bold shadow-xs' 
                                : 'text-[#767676] hover:text-[#1a1c1c] dark:hover:text-[#f0f0f0]'
                            }`}
                          >
                            {range === 'TODAY' ? 'Today' : range}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Data Export & Backup Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportCSV}
                        className="px-3.5 py-1.5 border border-[#dadada] dark:border-[#2a2a2a] bg-[#f9f9f9] dark:bg-[#1a1a1a] hover:bg-zinc-200 dark:hover:bg-zinc-800 text-[#1a1c1c] dark:text-[#f0f0f0] rounded-full text-xs font-bold font-geist transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Export CSV Report"
                      >
                        <Download className="h-3.5 w-3.5 text-[#e60023]" />
                        <span>Export CSV</span>
                      </button>
                       <button
                        onClick={() => {
                          const jsonContent = JSON.stringify(allProfiles, null, 2);
                          setExportPreview({
                            filename: `followme_backup_${new Date().toISOString().split('T')[0]}.json`,
                            mimeType: 'application/json;charset=utf-8',
                            content: jsonContent
                          });
                        }}
                        className="px-3.5 py-1.5 border border-[#dadada] dark:border-[#2a2a2a] bg-[#f9f9f9] dark:bg-[#1a1a1a] hover:bg-zinc-200 dark:hover:bg-zinc-800 text-[#1a1c1c] dark:text-[#f0f0f0] rounded-full text-xs font-bold font-geist transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Export JSON Backup"
                      >
                        <Download className="h-3.5 w-3.5 text-blue-500" />
                        <span>Export JSON</span>
                      </button>
                    </div>
                  </div>


                  {/* 4-Stat Summary Row */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-[24px] p-5 aura-shadow flex flex-col justify-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#767676]">Total Evaluated</span>
                      <span className="text-2xl font-extrabold text-[#e60023] font-mono mt-1.5 leading-none">{filteredSummary.evaluated}</span>
                    </div>
                    <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-[24px] p-5 aura-shadow flex flex-col justify-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#767676]">Total Followed</span>
                      <span className="text-2xl font-extrabold text-[#e60023] font-mono mt-1.5 leading-none">{filteredSummary.followed}</span>
                    </div>
                    <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-[24px] p-5 aura-shadow flex flex-col justify-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#767676]">Total Unfollowed</span>
                      <span className="text-2xl font-extrabold text-[#e60023] font-mono mt-1.5 leading-none">{filteredSummary.unfollowed}</span>
                    </div>
                    <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-[24px] p-5 aura-shadow flex flex-col justify-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#767676]">Mutuals Found</span>
                      <span className="text-2xl font-extrabold text-[#e60023] font-mono mt-1.5 leading-none">{filteredSummary.mutuals}</span>
                    </div>
                  </div>


                  {/* Primary charts row */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Daily Action Line Chart */}
                    <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-5 aura-shadow lg:col-span-2">
                      <h3 className="text-sm font-bold font-jakarta mb-4 text-[#1a1c1c] dark:text-[#f0f0f0]">Daily Agent Actions (Follows/Unfollows/Evaluations)</h3>
                      <div className="h-[280px] w-full font-mono text-[10px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#222' : '#f0f0f0'} />
                            <XAxis dataKey="date" stroke="#767676" tick={{ fontFamily: 'Inter', fontSize: 10 }} />
                            <YAxis stroke="#767676" tick={{ fontFamily: 'Geist Mono', fontSize: 10 }} />
                            <Tooltip contentStyle={{ background: isDark ? '#111' : '#fff', border: '1px solid #dadada', borderRadius: '8px' }} />
                            <Legend wrapperStyle={{ fontFamily: 'Geist', fontSize: 11 }} />
                            <Line type="monotone" dataKey="follows" stroke={savedSettings.accentColor || '#e60023'} name="Follows" strokeWidth={2.5} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="unfollows" stroke={`color-mix(in srgb, ${savedSettings.accentColor || '#e60023'} 50%, white)`} name="Unfollows" strokeWidth={2.5} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="evaluations" stroke={`color-mix(in srgb, ${savedSettings.accentColor || '#e60023'} 80%, black)`} name="Evaluations" strokeWidth={2} strokeDasharray="5 5" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Donut status distribution with dynamic center text */}
                    <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-5 aura-shadow relative flex flex-col justify-between">
                      <h3 className="text-sm font-bold font-jakarta mb-4 text-[#1a1c1c] dark:text-[#f0f0f0]">Profiles Status Shares</h3>
                      
                      <div className="h-[200px] w-full font-mono text-[10px] relative">
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
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={entry.color}
                                  onMouseEnter={() => setHoveredDonut(entry)}
                                  onMouseLeave={() => setHoveredDonut(null)}
                                  className="cursor-pointer transition-all duration-300 hover:opacity-80 outline-none"
                                />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ background: isDark ? '#111' : '#fff', border: '1px solid #dadada', borderRadius: '8px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                        
                        {/* Interactive Center Text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#767676] max-w-[90px] text-center truncate">
                            {hoveredDonut ? hoveredDonut.name : 'Total Profiles'}
                          </span>
                          <span className="text-xl font-extrabold text-[#e60023] font-mono leading-none mt-1">
                            {hoveredDonut ? hoveredDonut.value : allProfiles.length}
                          </span>
                        </div>
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
                          <Bar dataKey="follows" fill={savedSettings.accentColor || '#e60023'} name="Follow Actions" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="unfollows" fill={`color-mix(in srgb, ${savedSettings.accentColor || '#e60023'} 50%, white)`} name="Unfollow Actions" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>

          <footer className="mt-auto border-t border-[#dadada] dark:border-[#2a2a2a] py-6 text-center text-[10px] font-mono text-[#767676] bg-white dark:bg-[#111111] transition-colors duration-200">
            <p>FollowMe Dashboard &bull; Verified evaluation runs logged in real time</p>
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
                        <h4 className="font-bold text-[#0058bb] dark:text-blue-400">3. Log Cleanup</h4>
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

                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-xl text-[#0058bb] dark:text-blue-400 font-sans">
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

                  <div className="p-4 bg-orange-50 dark:bg-orange-950/10 border border-orange-200 dark:border-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400 font-sans">
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

      {/* Settings Modal Overlay (Tabbed & Categorized) */}
      {isSettingsOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in"
          onClick={() => {
            setTempSettings(savedSettings);
            setIsSettingsOpen(false);
          }}
        >
          <div 
            className="bg-white dark:bg-[#121215] border border-[#dadada] dark:border-[#2a2a2a] w-full max-w-xl rounded-3xl p-6 flex flex-col shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#eeeeee] dark:border-[#2a2a2a] pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#e60023]/10 border border-[#e60023]/30 flex items-center justify-center text-[#e60023]">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-jakarta text-base font-bold text-[#1a1c1c] dark:text-[#f0f0f0]">Dashboard Settings</h3>
                  <span className="text-[10px] font-mono text-zinc-400">System Preferences & Agent Tuning</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setTempSettings(savedSettings);
                  setIsSettingsOpen(false);
                }}
                className="h-8 w-8 rounded-full border border-[#dadada] dark:border-[#2a2a2a] hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 cursor-pointer transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Category Navigation Pills */}
            <div className="flex bg-[#f3f3f3] dark:bg-[#1a1a1e] p-1 rounded-2xl text-xs font-bold font-geist overflow-x-auto gap-1">
              {[
                { id: 'automation', label: 'Automation', icon: Clock },
                { id: 'safety', label: 'Safety', icon: ShieldCheck },
                { id: 'ai', label: 'AI Tuning', icon: Cpu },
                { id: 'notifications', label: 'Notifications', icon: Mail }
              ].map(cat => {
                const Icon = cat.icon;
                const isActive = settingsTab === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSettingsTab(cat.id as any)}
                    className={`flex-1 min-w-[100px] flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-white dark:bg-[#2a2a30] text-[#e60023] font-bold shadow-xs' 
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Category Tab Content */}
            <div className="space-y-4 font-sans text-xs max-h-[55vh] overflow-y-auto pr-1">
              
              {/* TAB 1: AUTOMATION */}
              {settingsTab === 'automation' && (
                <div className="p-4 rounded-2xl bg-[#f8f9fa] dark:bg-[#18181c] border border-[#eeeeee] dark:border-[#2a2a2a] space-y-3 animate-in fade-in">
                  <h4 className="font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta flex items-center gap-1.5 text-xs">
                    <Clock className="h-3.5 w-3.5 text-[#e60023]" /> Automation & Schedule Controls
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Execution Frequency</label>
                        <select
                          value={tempSettings.cronFrequency}
                          onChange={(e) => setTempSettings({ ...tempSettings, cronFrequency: e.target.value })}
                          className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                        >
                          <option value="2">Every 2 Hours</option>
                          <option value="4">Every 4 Hours</option>
                          <option value="6">Every 6 Hours</option>
                          <option value="12">Every 12 Hours</option>
                          <option value="24">Every 24 Hours</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Max Profiles / Run</label>
                        <input
                          type="number"
                          value={tempSettings.maxProfilesPerRun}
                          onChange={(e) => setTempSettings({ ...tempSettings, maxProfilesPerRun: Number(e.target.value) })}
                          className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Active Operating Window</label>
                      <input
                        type="text"
                        value={tempSettings.activeWorkingHours}
                        onChange={(e) => setTempSettings({ ...tempSettings, activeWorkingHours: e.target.value })}
                        className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                        placeholder="e.g. 09:00 - 22:00"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SAFETY */}
              {settingsTab === 'safety' && (
                <div className="p-4 rounded-2xl bg-[#f8f9fa] dark:bg-[#18181c] border border-[#eeeeee] dark:border-[#2a2a2a] space-y-3 animate-in fade-in">
                  <h4 className="font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta flex items-center gap-1.5 text-xs">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#e60023]" /> Safety & Filtering Limits
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Daily Follow Cap</label>
                        <input
                          type="number"
                          value={tempSettings.dailyFollowLimit}
                          onChange={(e) => setTempSettings({ ...tempSettings, dailyFollowLimit: Number(e.target.value) })}
                          className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Grace Period (Days)</label>
                        <input
                          type="number"
                          value={tempSettings.unfollowGracePeriod}
                          onChange={(e) => setTempSettings({ ...tempSettings, unfollowGracePeriod: Number(e.target.value) })}
                          className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2 pt-1 border-t border-[#eeeeee] dark:border-[#2a2a2a]">
                      <label className="flex items-center space-x-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={tempSettings.autoUnfollowNonMutuals}
                          onChange={(e) => setTempSettings({ ...tempSettings, autoUnfollowNonMutuals: e.target.checked })}
                          className="rounded border-[#dadada] dark:border-[#2a2a2a] text-[#e60023] focus:ring-[#e60023]"
                        />
                        <span className="text-xs font-medium text-[#1a1c1c] dark:text-[#f0f0f0]">
                          Auto-unfollow non-mutual profiles after grace period
                        </span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={tempSettings.excludeOrgAccounts}
                          onChange={(e) => setTempSettings({ ...tempSettings, excludeOrgAccounts: e.target.checked })}
                          className="rounded border-[#dadada] dark:border-[#2a2a2a] text-[#e60023] focus:ring-[#e60023]"
                        />
                        <span className="text-xs font-medium text-[#1a1c1c] dark:text-[#f0f0f0]">
                          Exclude Organization & Company Accounts (Target individual devs only)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: AI TUNING */}
              {settingsTab === 'ai' && (
                <div className="p-4 rounded-2xl bg-[#f8f9fa] dark:bg-[#18181c] border border-[#eeeeee] dark:border-[#2a2a2a] space-y-3 animate-in fade-in">
                  <h4 className="font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta flex items-center gap-1.5 text-xs">
                    <Cpu className="h-3.5 w-3.5 text-[#e60023]" /> AI Model & Evaluation Prompt
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">LLM Model Selector</label>
                      <select
                        value={tempSettings.llmModel}
                        onChange={(e) => setTempSettings({ ...tempSettings, llmModel: e.target.value })}
                        className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                      >
                        <option value="Gemini 2.5 Flash">Gemini 2.5 Flash (Ultra Fast & Efficient)</option>
                        <option value="Gemini 1.5 Pro">Gemini 1.5 Pro (Deep Code Reasoning)</option>
                        <option value="GPT-4o">GPT-4o (High Context Precision)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Custom System Prompt Overlay</label>
                      <textarea
                        rows={3}
                        value={tempSettings.systemPrompt}
                        onChange={(e) => setTempSettings({ ...tempSettings, systemPrompt: e.target.value })}
                        className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-3 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023] leading-relaxed resize-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1.5 flex items-center gap-1">
                        <Palette className="h-3 w-3" /> Dashboard Accent Color Theme
                      </label>
                      <div className="flex gap-2">
                        {[
                          { name: 'Crimson Red', hex: '#e60023' },
                          { name: 'Electric Violet', hex: '#8b5cf6' },
                          { name: 'Emerald Green', hex: '#10b981' },
                          { name: 'Dark Obsidian', hex: '#18181b' }
                        ].map(c => (
                          <button
                            key={c.hex}
                            onClick={() => setTempSettings({ ...tempSettings, accentColor: c.hex })}
                            className={`flex-1 py-1.5 rounded-xl border text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                              tempSettings.accentColor === c.hex
                                ? 'border-[#e60023] ring-1 ring-[#e60023] bg-zinc-100 dark:bg-zinc-800'
                                : 'border-[#dadada] dark:border-[#2a2a2a]'
                            }`}
                          >
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.hex }} />
                            <span>{c.name.split(' ')[0]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: NOTIFICATIONS */}
              {settingsTab === 'notifications' && (
                <div className="p-4 rounded-2xl bg-[#f8f9fa] dark:bg-[#18181c] border border-[#eeeeee] dark:border-[#2a2a2a] space-y-3 animate-in fade-in">
                  <h4 className="font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta flex items-center gap-1.5 text-xs">
                    <Mail className="h-3.5 w-3.5 text-[#e60023]" /> Email Digest & Webhook Alerts
                  </h4>
                  
                  <label className="flex items-center space-x-2 cursor-pointer pb-2 border-b border-[#eeeeee] dark:border-[#2a2a2a]">
                    <input
                      type="checkbox"
                      checked={tempSettings.enableEmailDigest}
                      onChange={(e) => setTempSettings({ ...tempSettings, enableEmailDigest: e.target.checked })}
                      className="rounded border-[#dadada] dark:border-[#2a2a2a] text-[#e60023] focus:ring-[#e60023]"
                    />
                    <span className="text-xs font-bold text-[#1a1c1c] dark:text-[#f0f0f0]">
                      Enable Daily Automated Email Digest
                    </span>
                  </label>

                  {tempSettings.enableEmailDigest && (
                    <div className="space-y-3 pt-1 animate-in fade-in">
                      <div>
                        <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Recipient Email Address</label>
                        <input
                          type="email"
                          value={tempSettings.recipientEmail}
                          onChange={(e) => setTempSettings({ ...tempSettings, recipientEmail: e.target.value })}
                          className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                          placeholder="e.g. user@example.com"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1.5">Digest Content Specifications</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'runSummary', label: 'Run Summary' },
                            { id: 'followedProfiles', label: 'Followed Profiles' },
                            { id: 'unfollowedProfiles', label: 'Unfollowed Profiles' },
                            { id: 'mutualFollows', label: 'Mutual Follow-backs' }
                          ].map(opt => (
                            <label key={opt.id} className="flex items-center space-x-2 cursor-pointer bg-white dark:bg-[#111111] p-2 rounded-xl border border-[#dadada] dark:border-[#2a2a2a]">
                              <input
                                type="checkbox"
                                checked={(tempSettings.digestSummary as any)[opt.id]}
                                onChange={(e) => setTempSettings({
                                  ...tempSettings,
                                  digestSummary: { ...tempSettings.digestSummary, [opt.id]: e.target.checked }
                                })}
                                className="rounded text-[#e60023] focus:ring-[#e60023]"
                              />
                              <span className="text-[11px] font-mono">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Delivery Time</label>
                        <input
                          type="text"
                          value={tempSettings.digestDeliveryTime}
                          onChange={(e) => setTempSettings({ ...tempSettings, digestDeliveryTime: e.target.value })}
                          className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                          placeholder="e.g. 09:00 AM"
                        />
                      </div>

                      <div className="border-t border-[#eeeeee] dark:border-[#2a2a2a] pt-3 space-y-3">
                        <div>
                          <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Webhook Endpoint URL</label>
                          <input
                            type="text"
                            value={tempSettings.webhookUrl || ''}
                            onChange={(e) => setTempSettings({ ...tempSettings, webhookUrl: e.target.value })}
                            className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                            placeholder="e.g. https://api.yoursite.com/webhook"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Webhook Secret Key</label>
                          <input
                            type="password"
                            value={tempSettings.webhookSecret || ''}
                            onChange={(e) => setTempSettings({ ...tempSettings, webhookSecret: e.target.value })}
                            className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                            placeholder="••••••••••••••••"
                          />
                        </div>
                      </div>

                      {/* Setup Guide */}
                      <div className="p-3 bg-amber-50 dark:bg-[#1f1e18] border border-amber-250 dark:border-amber-900/40 rounded-xl space-y-2 text-[10px] font-sans">
                        <span className="font-bold text-amber-850 dark:text-amber-400 block flex items-center gap-1">
                          💡 Understanding Email Digests & Webhooks
                        </span>
                        <p className="text-zinc-650 dark:text-zinc-405 leading-normal">
                          Because the FollowMe dashboard runs locally in your browser, it cannot send emails directly. To receive daily digests:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-zinc-500 dark:text-zinc-400 pl-1 leading-normal">
                          <li>You must host a simple webhook receiver endpoint (e.g. on Vercel, Netlify, or your server).</li>
                          <li>FollowMe automatically posts the execution payload to your configured URL below upon run completion.</li>
                          <li>Your receiver endpoint must then call an email provider API (like Resend, SendGrid, or Mailgun) to dispatch the formatted summary to <span className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 rounded text-zinc-700 dark:text-zinc-300">{tempSettings.recipientEmail}</span>.</li>
                        </ul>
                      </div>

                      {/* Webhook & Trigger Controls */}
                      <div className="flex gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={handleTestWebhook}
                          disabled={isTestingWebhook}
                          className="flex-1 py-2 border border-[#dadada] dark:border-[#2a2a2a] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[#1a1c1c] dark:text-[#f0f0f0] text-[10px] font-bold rounded-xl transition cursor-pointer font-geist flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                        >
                          {isTestingWebhook ? (
                            <>
                              <span className="h-3 w-3 border-2 border-zinc-400 border-t-zinc-850 rounded-full animate-spin" />
                              <span>Testing...</span>
                            </>
                          ) : (
                            <>
                              <Send className="h-3 w-3 text-blue-500" />
                              <span>Test Webhook</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleTriggerAgent}
                          disabled={isTriggeringAgent}
                          className="flex-1 py-2 bg-[#e60023] hover:bg-[#c0001b] text-white text-[10px] font-bold rounded-xl transition cursor-pointer font-geist flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                        >
                          {isTriggeringAgent ? (
                            <>
                              <span className="h-3 w-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              <span>Triggering...</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3 text-white fill-current" />
                              <span>Run Agent Now</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Status banners */}
                      {webhookTestStatus && (
                        <div className={`p-2.5 rounded-xl border text-[10px] font-mono font-medium animate-in slide-in-from-top-2 ${
                          webhookTestStatus.success 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-455'
                        }`}>
                          {webhookTestStatus.message}
                        </div>
                      )}

                      {agentTriggerStatus && (
                        <div className={`p-2.5 rounded-xl border text-[10px] font-mono font-medium animate-in slide-in-from-top-2 ${
                          agentTriggerStatus.success 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-455'
                        }`}>
                          {agentTriggerStatus.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="pt-2 flex items-center justify-between border-t border-[#eeeeee] dark:border-[#2a2a2a]">
              <button
                type="button"
                onClick={() => setTempSettings(defaultSettings)}
                className="px-4 py-2 border border-[#dadada] dark:border-[#2a2a2a] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-full transition cursor-pointer font-geist"
              >
                Restore Defaults
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTempSettings(savedSettings);
                    setIsSettingsOpen(false);
                  }}
                  className="px-4 py-2 border border-[#dadada] dark:border-[#2a2a2a] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-bold rounded-full transition cursor-pointer font-geist"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSavedSettings(tempSettings);
                    localStorage.setItem('savedSettings', JSON.stringify(tempSettings));
                    setIsSettingsOpen(false);
                  }}
                  className="px-5 py-2 bg-[#e60023] hover:bg-[#c0001b] text-white text-xs font-bold rounded-full transition cursor-pointer font-geist shadow-sm"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Security Key Modal Overlay */}
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
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-jakarta text-base font-bold text-[#1a1c1c] dark:text-[#f0f0f0]">Security & Access Key</h3>
                  <span className="text-[10px] font-mono text-zinc-400">Update Gateway Access Passcode</span>
                </div>
              </div>
              <button
                onClick={() => setIsSecurityModalOpen(false)}
                className="h-8 w-8 rounded-full border border-[#dadada] dark:border-[#2a2a2a] hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSecurityKey} className="space-y-4 font-sans text-xs">
              <div>
                <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Current Security Key</label>
                <input
                  type="password"
                  value={currentSecKey}
                  onChange={(e) => setCurrentSecKey(e.target.value)}
                  placeholder="Enter current passcode..."
                  className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">New Security Key</label>
                <input
                  type="password"
                  value={newSecKey}
                  onChange={(e) => setNewSecKey(e.target.value)}
                  placeholder="Enter new passcode (min. 4 chars)..."
                  className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Confirm New Security Key</label>
                <input
                  type="password"
                  value={confirmSecKey}
                  onChange={(e) => setConfirmSecKey(e.target.value)}
                  placeholder="Confirm new passcode..."
                  className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-emerald-500"
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-full transition cursor-pointer font-geist shadow-sm disabled:opacity-50"
                >
                  {isSecKeySubmitting ? 'Updating...' : 'Update Security Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Data Export Preview Modal Overlay */}
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







