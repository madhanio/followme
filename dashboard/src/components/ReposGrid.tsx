import React from 'react';
import { Star } from 'lucide-react';
import Lottie from 'lottie-react';
import mainCharacter from '../../public/animations/main_character.json';
import type { Repo } from '@/lib/types';

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

export interface ReposGridProps {
  filteredRepos: Repo[];
  visibleReposCount: number;
  activeFilter: string | null;
  isRefreshing: boolean;
  isActionLoading?: boolean;
  loadingIds?: Set<string>;
  onFilterChange: (filter: string | null) => void;
  onStar: (owner: string, name: string) => Promise<void>;
  onUnstar: (owner: string, name: string) => Promise<void>;
  onSelectRepo: (repo: Repo) => void;
  onLoadMore: () => void;
}

export function ReposGrid({
  filteredRepos,
  visibleReposCount,
  activeFilter,
  isRefreshing,
  isActionLoading = false,
  loadingIds,
  onFilterChange,
  onStar,
  onUnstar,
  onSelectRepo,
  onLoadMore,
}: ReposGridProps) {
  return (
    <div className="space-y-6">
      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 font-geist">
        {[
          { id: null, label: 'All' },
          { id: 'starred', label: 'Starred' },
          { id: 'unstarred', label: 'Unstarred' },
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
                  : 'bg-transparent text-[#767676] border-[#dadada] dark:border-[#2a2a2a] hover:text-[#1a1c1c] dark:hover:text-[#f0f0f0]'
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {isRefreshing ? (
        <div className="masonry-grid">
          {[1, 2, 3].map(n => (
            <div key={n} className="masonry-item bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-5 h-[160px] animate-pulse" />
          ))}
        </div>
      ) : filteredRepos.length === 0 ? (
        <div className="w-full py-16 flex flex-col items-center justify-center bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-2xl text-center text-xs font-mono text-[#767676] space-y-4 aura-shadow my-2">
          <div className="w-28 h-28 flex items-center justify-center overflow-hidden shrink-0">
            <Lottie animationData={mainCharacter} loop={true} className="w-full h-full object-contain" />
          </div>
          <p className="font-semibold text-zinc-600 dark:text-zinc-400">No repositories found matching search query/filters.</p>
        </div>
      ) : (
        <div className="masonry-grid">
          {filteredRepos.slice(0, visibleReposCount).map(repo => {
            const repoLoadingId = `repo-${repo.owner}-${repo.name}`;
            const isLoading = loadingIds ? loadingIds.has(repoLoadingId) : false;
            const disabled = isLoading || isActionLoading;

            return (
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
                  <span className={getGradeColor(repo.grade || 0)}>
                    {(repo.grade ?? 0).toFixed(1)}/10
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
                      onClick={() => onUnstar(repo.owner, repo.name)}
                      disabled={disabled}
                      className="flex-1 min-h-[34px] flex items-center justify-center gap-1.5 bg-transparent border border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/10 text-xs font-bold rounded-full cursor-pointer transition-all font-geist disabled:opacity-40"
                    >
                      {isLoading && (
                        <svg className="animate-spin h-3.5 w-3.5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                      )}
                      <span>Unstar</span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => onStar(repo.owner, repo.name)}
                      disabled={disabled}
                      className="flex-1 min-h-[34px] flex items-center justify-center gap-1.5 bg-[#e60023] hover:bg-[#c0001b] text-white text-xs font-bold rounded-full transition-all cursor-pointer font-geist disabled:opacity-40"
                    >
                      {isLoading && (
                        <svg className="animate-spin h-3.5 w-3.5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                      )}
                      <span>Star</span>
                    </button>
                  )}

                  {repo.readme_snippet && (
                    <button 
                      onClick={() => onSelectRepo(repo)}
                      className="px-4 min-h-[34px] flex items-center justify-center bg-transparent border border-[#dadada] dark:border-[#2a2a2a] hover:bg-[#f3f3f3] dark:hover:bg-[#1a1a1a] text-[#1a1c1c] dark:text-[#f0f0f0] text-xs font-bold rounded-full transition-all cursor-pointer font-geist"
                    >
                      Readme
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredRepos.length > visibleReposCount && (
        <div className="flex justify-center pt-4">
          <button
            onClick={onLoadMore}
            className="px-6 py-2.5 bg-white dark:bg-[#111111] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-[#dadada] dark:border-[#2a2a2a] text-[#1a1c1c] dark:text-[#f0f0f0] text-xs font-bold rounded-full transition-all cursor-pointer shadow-xs active:scale-95"
          >
            Load More Repositories
          </button>
        </div>
      )}
    </div>
  );
}
