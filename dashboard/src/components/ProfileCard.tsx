import React, { useState, useEffect } from 'react';
import { Trash2, Clock } from 'lucide-react';
import type { ProfileItem } from '@/lib/types';

const githubStatsCache = new Map<string, { followers: number; following: number }>();

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

export interface ProfileCardProps {
  id?: string;
  profile: ProfileItem;
  onFollow: (username: string) => Promise<void>;
  onUnfollow: (username: string) => Promise<void>;
  onDelete: (username: string) => Promise<void>;
  isActionLoading?: boolean;
  isLoading?: boolean;
  setActiveTab: (tab: 'home' | 'profiles' | 'repos' | 'logs' | 'stats') => void;
  setSearchTerm: (term: string) => void;
  graceDays?: number;
}

export function ProfileCard({
  profile,
  onFollow,
  onUnfollow,
  onDelete,
  isActionLoading = false,
  isLoading = false,
  setActiveTab,
  setSearchTerm,
  graceDays = 7,
}: ProfileCardProps) {
  const [, setStats] = useState<{ followers: number; following: number } | null>(null);
  const [, setLoading] = useState(false);

  const disabled = isLoading || isActionLoading;

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
            following: data.following || 0,
          };
          githubStatsCache.set(username, userStats);
          if (active) setStats(userStats);
        } else {
          if (active) setStats(null);
        }
      } catch {
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
  const isMutual = status.followed && !status.unfollowed && status.follow_back;
  const isGracePeriod = status.followed && !status.unfollowed && !status.follow_back;
  const isInbound = !status.followed && status.follow_back;
  const isUnfollowed = status.unfollowed;
  const isSkipped = status.follow_skipped;

  // Calculate Grace Period Countdown
  let graceCountdownText: string | null = null;
  let isGraceExpired = false;
  if (isGracePeriod) {
    if (status.followed_at) {
      const elapsedDays = (Date.now() - new Date(status.followed_at).getTime()) / (1000 * 60 * 60 * 24);
      const remaining = Math.max(0, graceDays - elapsedDays);
      if (remaining <= 0) {
        graceCountdownText = 'Grace period ended (Due for unfollow)';
        isGraceExpired = true;
      } else {
        graceCountdownText = `${remaining.toFixed(1)}d remaining in grace period`;
      }
    } else {
      graceCountdownText = 'Grace period ended (Due for unfollow)';
      isGraceExpired = true;
    }
  }

  let badgeClass = 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400';
  let badgeLabel = 'Pending';

  if (isMutual) {
    badgeClass = 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 font-bold';
    badgeLabel = 'Mutual (Follows Back)';
  } else if (isGracePeriod) {
    if (isGraceExpired) {
      badgeClass = 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 font-extrabold';
      badgeLabel = 'Grace Ended (Due)';
    } else {
      badgeClass = 'bg-blue-50 text-[#0058bb] border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 font-bold';
      badgeLabel = 'Grace Period';
    }
  } else if (isInbound) {
    badgeClass = 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 font-bold';
    badgeLabel = 'Inbound (Follows You)';
  } else if (isUnfollowed) {
    badgeClass = 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 font-bold';
    badgeLabel = 'Unfollowed Archive';
  } else if (isSkipped) {
    badgeClass = 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 font-bold';
    badgeLabel = 'Filter Skipped';
  }

  return (
    <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] hover:shadow-lg dark:hover:shadow-black/40 rounded-[32px] transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-h-[230px]">
      {/* Top Header */}
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
          <span className={`px-2 py-0.5 rounded-full text-[9px] border font-mono shrink-0 ${badgeClass}`}>
            {badgeLabel}
          </span>
          <button
            onClick={() => onDelete(profile.owner)}
            disabled={disabled}
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
          {/* Quality Score Bar */}
          <div className="bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] py-2 px-3 rounded-xl text-center my-2 relative overflow-hidden flex items-center justify-between">
            <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#767676]">Quality Score</span>
            <span className={`text-sm font-extrabold font-mono leading-none ${
              profile.avgGrade >= 9.0 ? 'text-emerald-600 dark:text-emerald-400' :
              profile.avgGrade >= 7.0 ? 'text-[#e60023]' : 'text-orange-500'
            }`}>
              {profile.avgGrade.toFixed(1)}/10
            </span>
          </div>

          {profile.reason && (
            <p className="text-xs" style={{ color: 'var(--muted)', marginTop: '4px' }}>
              {profile.reason}
            </p>
          )}

          {/* Grace Period Countdown Alert */}
          {graceCountdownText && (
            <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 p-2 rounded-xl mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold">
                <Clock className="h-3 w-3 shrink-0" />
                {graceCountdownText}
              </span>
            </div>
          )}

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

      {/* Card Action Buttons: deduplicated GitHub anchor */}
      <div className="flex space-x-2 px-4 pb-4 pt-2 border-t border-[#eeeeee] dark:border-[#2a2a2a]">
        {isMutual ? (
          <button
            onClick={() => onUnfollow(profile.owner)}
            disabled={disabled}
            className="flex-1 min-h-[34px] flex items-center justify-center gap-1.5 bg-transparent border border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/10 text-xs font-bold rounded-full cursor-pointer transition-all font-geist disabled:opacity-40"
          >
            {isLoading && (
              <svg className="animate-spin h-3.5 w-3.5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            )}
            <span>Unfollow</span>
          </button>
        ) : isGracePeriod ? (
          <button
            onClick={() => onUnfollow(profile.owner)}
            disabled={disabled}
            className="flex-1 min-h-[34px] flex items-center justify-center gap-1.5 bg-transparent border border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/10 text-xs font-bold rounded-full cursor-pointer transition-all font-geist disabled:opacity-40"
          >
            {isLoading && (
              <svg className="animate-spin h-3.5 w-3.5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            )}
            <span>Unfollow</span>
          </button>
        ) : isInbound ? (
          <button
            onClick={() => onFollow(profile.owner)}
            disabled={disabled}
            className="flex-1 min-h-[34px] flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-full cursor-pointer transition-all font-geist disabled:opacity-40"
          >
            {isLoading && (
              <svg className="animate-spin h-3.5 w-3.5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            )}
            <span>Follow Back</span>
          </button>
        ) : (
          <button
            onClick={() => onFollow(profile.owner)}
            disabled={disabled}
            className="flex-1 min-h-[34px] flex items-center justify-center gap-1.5 bg-[#e60023] hover:bg-[#c0001b] text-white text-xs font-bold rounded-full cursor-pointer transition-all font-geist disabled:opacity-40"
          >
            {isLoading && (
              <svg className="animate-spin h-3.5 w-3.5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            )}
            <span>Follow</span>
          </button>
        )}
        <a
          href={`https://github.com/${profile.owner}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 min-h-[34px] flex items-center justify-center bg-transparent border border-[#dadada] dark:border-[#2a2a2a] hover:bg-[#f3f3f3] dark:hover:bg-[#1a1a1a] text-[#1a1c1c] dark:text-[#f0f0f0] text-xs font-bold rounded-full cursor-pointer transition-all font-geist"
        >
          GitHub
        </a>
      </div>
    </div>
  );
}
