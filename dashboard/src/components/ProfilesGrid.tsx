import React from 'react';
import { Clock } from 'lucide-react';
import Lottie from 'lottie-react';
import mainCharacter from '../../public/animations/main_character.json';
import { ProfileCard } from './ProfileCard';
import type { ProfileItem } from '@/lib/types';

export interface ProfilesGridProps {
  filteredProfiles: ProfileItem[];
  allProfilesCount: number;
  visibleProfilesCount: number;
  activeFilter: string | null;
  relationshipMatrix: {
    mutuals: ProfileItem[];
    gracePeriod: ProfileItem[];
    graceEnded: ProfileItem[];
    inbound: ProfileItem[];
    unfollowed: ProfileItem[];
  };
  unfollowGracePeriod: number;
  isRefreshing: boolean;
  isTriggering: boolean;
  isActionLoading?: boolean;
  loadingIds?: Set<string>;
  onFilterChange: (filter: string | null) => void;
  onTrigger: () => Promise<void>;
  onFollow: (username: string) => Promise<void>;
  onUnfollow: (username: string) => Promise<void>;
  onDelete: (username: string) => Promise<void>;
  onLoadMore: () => void;
  setActiveTab: (tab: 'home' | 'profiles' | 'repos' | 'logs' | 'stats') => void;
  setSearchTerm: (term: string) => void;
}

export function ProfilesGrid({
  filteredProfiles,
  allProfilesCount,
  visibleProfilesCount,
  activeFilter,
  relationshipMatrix,
  unfollowGracePeriod,
  isRefreshing,
  isTriggering,
  isActionLoading = false,
  loadingIds,
  onFilterChange,
  onTrigger,
  onFollow,
  onUnfollow,
  onDelete,
  onLoadMore,
  setActiveTab,
  setSearchTerm,
}: ProfilesGridProps) {
  return (
    <div className="space-y-6">
      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 font-geist">
        {[
          { id: null, label: `All (${allProfilesCount})` },
          { id: 'mutual', label: `Mutuals (${relationshipMatrix.mutuals.length})` },
          { id: 'grace_period', label: `Grace Queue (${relationshipMatrix.gracePeriod.length})` },
          {
            id: 'grace_ended',
            label: `Grace Ended (${relationshipMatrix.graceEnded.length})`,
            highlight: relationshipMatrix.graceEnded.length > 0,
          },
          { id: 'inbound', label: `Inbound Fans (${relationshipMatrix.inbound.length})` },
          { id: 'unfollowed', label: `Unfollowed (${relationshipMatrix.unfollowed.length})` },
        ].map(pill => {
          const isSelected = activeFilter === pill.id;
          return (
            <button
              key={pill.label}
              onClick={() => {
                const nextFilter = isSelected ? null : pill.id;
                onFilterChange(nextFilter);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-[#e60023] text-white border-[#e60023] shadow-sm'
                  : pill.highlight
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/40 hover:border-amber-500 font-extrabold'
                  : 'bg-transparent text-[#767676] border-[#dadada] dark:border-[#2a2a2a] hover:text-[#1a1c1c] dark:hover:text-[#f0f0f0]'
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {activeFilter === 'grace_ended' && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-amber-800 dark:text-amber-300 mb-4">
          <div className="flex items-center space-x-2.5">
            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold font-jakarta block sm:inline">Grace Period Ended ({unfollowGracePeriod || 7} Days):</span>
              <span className="ml-1 text-[11px] opacity-90">{filteredProfiles.length} profiles have not followed back and are eligible for auto-cleanup.</span>
            </div>
          </div>
          <button
            onClick={onTrigger}
            disabled={isTriggering || isActionLoading}
            className="px-4 py-1.5 bg-[#e60023] hover:bg-[#c0001b] text-white rounded-full font-bold font-geist text-xs transition-all cursor-pointer shadow-xs active:scale-95 shrink-0 disabled:opacity-40"
          >
            {isTriggering ? 'Running Cleanup...' : 'Run Auto-Cleanup Job'}
          </button>
        </div>
      )}

      {isRefreshing ? (
        <div className="masonry-grid">
          {[1, 2, 3].map(n => (
            <div key={n} className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-5 h-[160px] animate-pulse" />
          ))}
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="w-full py-16 flex flex-col items-center justify-center bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-2xl text-center text-xs font-mono text-[#767676] space-y-4 aura-shadow my-2">
          <div className="w-28 h-28 flex items-center justify-center overflow-hidden shrink-0">
            <Lottie animationData={mainCharacter} loop={true} className="w-full h-full object-contain" />
          </div>
          <p className="font-semibold text-zinc-600 dark:text-zinc-400">No profiles found matching search query/filters.</p>
        </div>
      ) : (
        <div className="masonry-grid">
          {filteredProfiles.slice(0, visibleProfilesCount).map(profile => (
            <div key={profile.owner} className="masonry-item">
              <ProfileCard
                profile={profile}
                onFollow={onFollow}
                onUnfollow={onUnfollow}
                onDelete={onDelete}
                isActionLoading={isActionLoading}
                isLoading={loadingIds ? loadingIds.has(`profile-${profile.owner}`) : false}
                setActiveTab={setActiveTab}
                setSearchTerm={setSearchTerm}
                graceDays={unfollowGracePeriod || 7}
              />
            </div>
          ))}
        </div>
      )}

      {filteredProfiles.length > visibleProfilesCount && (
        <div className="flex justify-center pt-4">
          <button
            onClick={onLoadMore}
            className="px-6 py-2.5 bg-white dark:bg-[#111111] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-[#dadada] dark:border-[#2a2a2a] text-[#1a1c1c] dark:text-[#f0f0f0] text-xs font-bold rounded-full transition-all cursor-pointer shadow-xs active:scale-95"
          >
            Load More Profiles
          </button>
        </div>
      )}
    </div>
  );
}
