import React, { useState, useRef, useMemo } from 'react';
import {
  UserCheck,
  Clock,
  UserPlus,
  UserMinus,
  Star,
  Zap,
  RotateCw,
} from 'lucide-react';
import { StatCards } from './StatCards';
import type { Repo, Log, ProfileItem, GitHubRateLimitData, RunSummary, UserProfile } from '@/lib/types';

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

const getGradeColor = (grade: number) => {
  if (grade >= 9.0) return 'text-emerald-500 font-extrabold text-sm';
  if (grade >= 7.0) return 'text-[#e60023] font-extrabold text-sm';
  return 'text-amber-500 font-extrabold text-sm';
};

export interface HomeTabProps {
  relationshipMatrix: {
    mutuals: ProfileItem[];
    gracePeriod: ProfileItem[];
    graceEnded: ProfileItem[];
    inbound: ProfileItem[];
    unfollowed: ProfileItem[];
  };
  savedGraceDays: number;
  stats: {
    totalProfiles: number;
    followed: number;
    mutuals: number;
    skipped: number;
  };
  rateLimitData: GitHubRateLimitData | null;
  rateLimitLoading: boolean;
  repos: Repo[];
  logs: Log[];
  runSummary: RunSummary[];
  workerStatus?: {
    nextRun: string | null;
    lastRun: string | null;
    isJobRunning: boolean;
    consecutiveFailures: number;
  } | null;
  userProfile?: UserProfile | null;
  showOnboardingTest?: boolean;
  isBannerDismissed?: boolean;
  isOAuthConnecting?: boolean;
  onGitHubOAuth?: (e?: React.MouseEvent) => void;
  onDismissBanner?: () => void;
  onSelectRepo: (repo: Repo) => void;
  setActiveTab: (tab: 'home' | 'profiles' | 'repos' | 'logs' | 'stats', filter?: string | null) => void;
  setSearchTerm?: (term: string) => void;
  onRefreshRateLimits: (force: boolean) => void;
  onFollow?: (username: string) => Promise<void>;
  onUnfollow?: (username: string) => Promise<void>;
  onDelete?: (username: string) => Promise<void>;
  loadingIds?: Set<string>;
}

export function HomeTab({
  relationshipMatrix,
  savedGraceDays,
  stats,
  rateLimitData,
  rateLimitLoading,
  repos,
  logs,
  runSummary,
  userProfile,
  onSelectRepo,
  setActiveTab,
  onRefreshRateLimits,
}: HomeTabProps) {
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [insightIndex, setInsightIndex] = useState(0);

  // Drag-to-scroll carousel state
  const repoCarouselRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const onRepoMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    startXRef.current = e.pageX - (repoCarouselRef.current?.offsetLeft || 0);
    scrollLeftRef.current = repoCarouselRef.current?.scrollLeft || 0;
  };

  const onRepoMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !repoCarouselRef.current) return;
    e.preventDefault();
    const x = e.pageX - (repoCarouselRef.current.offsetLeft || 0);
    const walk = (x - startXRef.current) * 1.5;
    repoCarouselRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const onRepoMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  // Derive top 5 profiles & top 3 repos internally
  const top5Profiles = useMemo(() => {
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
          followStatus: ownerStatus,
        });
      } else {
        existing.reposCount += 1;
        existing.repos.push(repo);
      }
    });
    return Array.from(profilesMap.values()).slice(0, 5);
  }, [repos]);

  const top3Repos = useMemo(() => {
    return [...repos]
      .filter(r => (r.grade || 0) > 0)
      .sort((a, b) => (b.grade || 0) - (a.grade || 0))
      .slice(0, 6);
  }, [repos]);

  const lastRunTaskFormattedTime = useMemo(() => {
    const lastTask = runSummary.find(r => r.run_type !== 'sync_following' && r.run_type !== 'cleanup');
    if (!lastTask || !lastTask.ran_at) return 'Recent';
    const diffMs = Date.now() - new Date(lastTask.ran_at).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  }, [runSummary]);

  const last3Insights = useMemo(() => [
    "Evaluated recent repositories against semantic contribution criteria.",
    "System monitor operating smoothly with no GitHub rate limit throttles.",
    "Relationship matrix updated based on latest reciprocal sync data."
  ], []);

  return (
    <div className="space-y-6">
      {/* 4-WAY PROFILE RELATIONSHIP MATRIX CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-geist">
        {/* 1. Mutual Friends */}
        <div 
          onClick={() => setActiveTab('profiles', 'mutual')}
          className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] hover:border-emerald-500/80 dark:hover:border-emerald-500/80 rounded-2xl p-5 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5" /> Mutual Friends
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 font-bold border border-emerald-200/50 dark:border-emerald-900/40">
              I Follow + They Follow
            </span>
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta">
              {relationshipMatrix.mutuals.length}
            </div>
            <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
              Reciprocal connections. Protected from auto-unfollow.
            </p>
          </div>
          <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>View mutuals</span> &rarr;
          </div>
        </div>

        {/* 2. Grace Period Queue */}
        <div 
          onClick={() => setActiveTab('profiles', 'grace_period')}
          className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] hover:border-blue-500/80 dark:hover:border-blue-500/80 rounded-2xl p-5 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0058bb] dark:text-blue-400 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Grace Period
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 font-bold border border-blue-200/50 dark:border-blue-900/40">
              I Follow + They Don&apos;t
            </span>
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta">
              {relationshipMatrix.gracePeriod.length}
            </div>
            <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
              Awaiting follow-back ({savedGraceDays || 7}d grace timer).
            </p>
          </div>
          <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>View pending queue</span> &rarr;
          </div>
        </div>

        {/* 3. Inbound Fans */}
        <div 
          onClick={() => setActiveTab('profiles', 'inbound')}
          className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] hover:border-purple-500/80 dark:hover:border-purple-500/80 rounded-2xl p-5 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5" /> Inbound Fans
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400 font-bold border border-purple-200/50 dark:border-purple-900/40">
              They Follow + I Don&apos;t
            </span>
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta">
              {relationshipMatrix.inbound.length}
            </div>
            <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
              Developers following you. Ready to follow back!
            </p>
          </div>
          <div className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Follow back opportunities</span> &rarr;
          </div>
        </div>

        {/* 4. Unfollowed History */}
        <div 
          onClick={() => setActiveTab('profiles', 'unfollowed')}
          className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] hover:border-rose-500/80 dark:hover:border-rose-500/80 rounded-2xl p-5 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <UserMinus className="h-3.5 w-3.5" /> Unfollowed
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 font-bold border border-rose-200/50 dark:border-rose-900/40">
              I Don&apos;t + They Don&apos;t
            </span>
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta">
              {relationshipMatrix.unfollowed.length}
            </div>
            <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
              Auto-cleaned after grace period expiration.
            </p>
          </div>
          <div className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>View cleanup archive</span> &rarr;
          </div>
        </div>
      </div>

      <div className="masonry-grid">
        {/* Card 1: Top Profile Spotlight */}
        {top5Profiles.length > 0 && (() => {
          const profile = top5Profiles[spotlightIndex];
          if (!profile) return null;
          const status = profile.followStatus;
          const isFollowed = status.followed && !status.unfollowed && !status.follow_back;
          const isUnfollowed = status.unfollowed;
          const isSkipped = status.follow_skipped;
          const isMutual = status.followed && !status.unfollowed && status.follow_back;

          let badgeClass = 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-955/20 dark:text-orange-400';
          let badgeLabel = 'Pending';
          if (isFollowed) {
            badgeClass = 'bg-blue-50 text-[#0058bb] border-blue-200 dark:bg-blue-955/20 dark:text-blue-400';
            badgeLabel = 'Followed';
          } else if (isMutual) {
            badgeClass = 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-955/20 dark:text-emerald-400';
            badgeLabel = 'Mutual Follow';
          } else if (isUnfollowed) {
            badgeClass = 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/20 dark:text-rose-455';
            badgeLabel = 'Unfollowed';
          } else if (isSkipped) {
            badgeClass = 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-955/20 dark:text-orange-400';
            badgeLabel = 'Skipped';
          }

          return (
            <div 
              onClick={() => setActiveTab('profiles')}
              className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-[32px] aura-shadow hover:shadow-lg dark:hover:shadow-black/40 aura-shadow-hover transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[245px]"
            >
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

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
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
                    {profile.repos.reduce((acc: number, r: Repo) => acc + r.stars, 0)} Stars
                  </span>
                </div>
                
                <div className="flex space-x-1">
                  {top5Profiles.map((_, idx: number) => (
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

        {/* Card 2: Featured Repositories Carousel */}
        {top3Repos.length > 0 && (
          <div className="masonry-item space-y-3 bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-[32px] p-5 aura-shadow">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#e60023] font-jakarta">Top Graded Repositories</span>
              <span className="text-[9px] font-mono text-zinc-400 select-none">Swipe &larr;</span>
            </div>
            
            <div 
              ref={repoCarouselRef}
              onMouseDown={onRepoMouseDown}
              onMouseMove={onRepoMouseMove}
              onMouseUp={onRepoMouseUpOrLeave}
              onMouseLeave={onRepoMouseUpOrLeave}
              className="flex overflow-x-auto space-x-4 pb-2 no-scrollbar select-none cursor-grab active:cursor-grabbing scroll-smooth"
            >
              {top3Repos.map((repo: Repo) => (
                <div 
                  key={repo.id}
                  onClick={() => {
                    onSelectRepo(repo);
                  }}
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
          onClick={() => setActiveTab('logs')}
          className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-[32px] aura-shadow hover:shadow-lg dark:hover:shadow-black/40 aura-shadow-hover transition-all duration-200 cursor-pointer p-5 flex flex-col space-y-4"
        >
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold font-jakarta text-[#1a1c1c] dark:text-[#f0f0f0]">Recent Logs</h3>
            <span className="text-zinc-400 font-bold tracking-widest text-[10px]">...</span>
          </div>

          <div className="space-y-3 font-sans text-xs">
            {logs.slice(0, 3).map(log => {
              let dotColor = 'bg-blue-400';
              if (log.status === 'SUCCESS') dotColor = 'bg-[#10b981]';
              else if (log.status === 'FAILED' || log.status === 'ERROR') dotColor = 'bg-rose-500';
              else if (log.status === 'WARN') dotColor = 'bg-orange-500';
              
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
                setActiveTab('logs');
              }}
              className="w-full min-h-[38px] bg-[#e60023] hover:bg-[#c0001b] text-white text-xs font-bold rounded-full transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center space-x-1.5"
            >
              <span>View System Console</span>
            </button>
          </div>
        </div>

        {/* Card 4: Stats Snapshot Card with StatCards & Rate Limits */}
        <div 
          onClick={() => setActiveTab('stats')}
          className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] hover:border-[#e60023]/50 rounded-[32px] aura-shadow p-5 flex flex-col space-y-4 cursor-pointer transition-all hover:shadow-lg select-none"
          title="Click to view full Evaluation Metrics"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#e60023] font-jakarta">Activity Snapshot</span>
            <span className="text-xs font-bold text-[#e60023]">&rarr;</span>
          </div>

          {/* Extracted StatCards component */}
          <StatCards
            totalProfiles={stats.totalProfiles || repos.length}
            followed={stats.followed}
            mutuals={stats.mutuals}
            skipped={stats.skipped}
          />

          {/* GitHub API Rate Limits Live Display Cards */}
          <div className="pt-3 border-t border-[#eeeeee] dark:border-[#222222] space-y-2.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#767676] font-jakarta">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>GitHub Rate Limits</span>
              </span>
              <button
                onClick={() => onRefreshRateLimits(true)}
                disabled={rateLimitLoading}
                className="flex items-center space-x-1 text-[9px] font-mono lowercase text-zinc-500 hover:text-[#1a1c1c] dark:hover:text-[#f0f0f0] transition-all cursor-pointer select-none"
                title="Click to fetch live quota immediately"
              >
                <RotateCw className={`h-3 w-3 ${rateLimitLoading ? 'animate-spin text-[#e60023]' : ''}`} />
                <span>{rateLimitLoading ? 'syncing...' : 'live'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Card 1: Core API */}
              {(() => {
                const coreLimit = rateLimitData?.core?.limit ?? 5000;
                const coreRemaining = rateLimitData?.core?.remaining ?? 5000;
                const coreUsed = rateLimitData?.core?.used ?? (coreLimit - coreRemaining);
                const isCoreLow = coreLimit > 0 && (coreRemaining / coreLimit) < 0.2;
                const remainingPct = coreLimit > 0 ? Math.min(100, Math.max(0, (coreRemaining / coreLimit) * 100)) : 100;

                return (
                  <div className="relative bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] rounded-[20px] p-3.5 pb-4 overflow-hidden flex flex-col justify-between transition-all hover:border-[#dadada] dark:hover:border-zinc-700 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta">Core API</span>
                      <span className="text-[8px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">1h limit</span>
                    </div>
                    <div className="my-1.5">
                      <div className="text-lg font-black font-mono text-[#1a1c1c] dark:text-[#f0f0f0] leading-none">
                        {coreRemaining.toLocaleString()} <span className="text-[10px] text-[#767676] font-normal font-sans">/ {coreLimit.toLocaleString()}</span>
                      </div>
                      <span className={`text-[9px] font-mono mt-1 block ${isCoreLow ? 'text-[#e60023] font-bold' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {coreUsed > 0 ? `${coreUsed} used this hr` : '100% capacity free'}
                      </span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 rounded-r-full ${isCoreLow ? 'bg-[#e60023]' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.max(remainingPct, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Card 2: Search API */}
              {(() => {
                const searchLimit = rateLimitData?.search?.limit ?? 30;
                const searchRemaining = rateLimitData?.search?.remaining ?? 30;
                const searchUsed = rateLimitData?.search?.used ?? (searchLimit - searchRemaining);
                const isSearchLow = searchLimit > 0 && (searchRemaining / searchLimit) < 0.2;
                const remainingPct = searchLimit > 0 ? Math.min(100, Math.max(0, (searchRemaining / searchLimit) * 100)) : 100;

                return (
                  <div className="relative bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] rounded-[20px] p-3.5 pb-4 overflow-hidden flex flex-col justify-between transition-all hover:border-[#dadada] dark:hover:border-zinc-700 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta">Search API</span>
                      <span className="text-[8px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">1m limit</span>
                    </div>
                    <div className="my-1.5">
                      <div className="text-lg font-black font-mono text-[#1a1c1c] dark:text-[#f0f0f0] leading-none">
                        {searchRemaining} <span className="text-[10px] text-[#767676] font-normal font-sans">/ {searchLimit}</span>
                      </div>
                      <span className={`text-[9px] font-mono mt-1 block ${isSearchLow ? 'text-[#e60023] font-bold' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {searchUsed > 0 ? `${searchUsed} used this min` : '100% capacity free'}
                      </span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 rounded-r-full ${isSearchLow ? 'bg-[#e60023]' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.max(remainingPct, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
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

          <div className="relative p-4 rounded-[20px] bg-rose-50 border border-rose-100 dark:bg-rose-950/15 dark:border-rose-900/30 text-rose-700 dark:text-rose-455 font-sans text-xs leading-relaxed transition-all duration-500">
            <div className="absolute top-[-6px] left-6 w-3 h-3 bg-rose-50 border-t border-l border-rose-100 dark:bg-[#281116] dark:border-rose-900/30 transform rotate-45" />
            &quot;{last3Insights[insightIndex]}&quot;
          </div>

          <div className="flex items-center space-x-2 text-[10px] font-mono text-[#767676]">
            <span className="h-2 w-2 rounded-full bg-[#e60023] animate-pulse" />
            <span>GitAuto Agent Alpha</span>
          </div>
        </div>
      </div>
    </div>
  );
}
