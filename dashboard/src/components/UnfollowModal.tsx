import React from 'react';

export interface UnfollowCandidate {
  id: number;
  owner: string;
  name: string;
  followed_at: string;
}

export interface UnfollowModalProps {
  isOpen: boolean;
  cleanupOption: 'list' | 'logs' | 'stale' | null;
  isCleaning: boolean;
  isFetchingUnfollowList: boolean;
  unfollowList: UnfollowCandidate[];
  totalLogsCount: number;
  staleProfilesCount: number;
  onClose: () => void;
  setCleanupOption: (opt: 'list' | 'logs' | 'stale' | null) => void;
  onFetchUnfollowList: () => Promise<void>;
  onFetchTotalLogsCount: () => Promise<void>;
  onUnfollowUser: (username: string) => Promise<void>;
  onRemoveFromUnfollowList: (username: string) => void;
  onRunBulkCleanup: () => Promise<void>;
  onRunLogCleanup: () => Promise<void>;
  onRunClearStale: () => Promise<void>;
}

export function UnfollowModal({
  isOpen,
  cleanupOption,
  isCleaning,
  isFetchingUnfollowList,
  unfollowList,
  totalLogsCount,
  staleProfilesCount,
  onClose,
  setCleanupOption,
  onFetchUnfollowList,
  onFetchTotalLogsCount,
  onUnfollowUser,
  onRemoveFromUnfollowList,
  onRunBulkCleanup,
  onRunLogCleanup,
  onRunClearStale,
}: UnfollowModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 dark:bg-black/85 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111111] border-t sm:border border-[#dadada] dark:border-[#2a2a2a] w-full sm:max-w-2xl h-[92vh] sm:h-auto sm:max-h-[85vh] rounded-t-2xl sm:rounded-xl flex flex-col shadow-2xl overflow-hidden font-mono text-xs">
        <div className="px-5 py-4 border-b border-[#dadada] dark:border-[#2a2a2a] bg-[#f9f9f9] dark:bg-[#151515] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#767676] uppercase tracking-wider">Maintenance Dashboard</span>
            <h3 className="text-xs font-bold text-[#1a1c1c] dark:text-[#f0f0f0] uppercase tracking-widest mt-0.5">Cleanup Assistant</h3>
          </div>
          <button
            onClick={() => {
              onClose();
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
                    onClick={async () => {
                      await onRunBulkCleanup();
                      onClose();
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
                    onClick={async () => {
                      await onFetchUnfollowList();
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
                      await onFetchTotalLogsCount();
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
                              await onUnfollowUser(user.owner);
                              onRemoveFromUnfollowList(user.owner);
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
                      onClick={async () => {
                        await onRunBulkCleanup();
                        onClose();
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
                    await onRunLogCleanup();
                    onClose();
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
                    await onRunClearStale();
                    onClose();
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
  );
}
