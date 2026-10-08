import React, { useState } from 'react';
import type { Log, RunSummary } from '@/lib/types';

export interface LogsTableProps {
  logs: Log[];
  filteredLogs: Log[];
  runSummary: RunSummary[];
  workerStatus: {
    nextRun: string | null;
    isJobRunning: boolean;
  } | null;
  lastRunTask: RunSummary | null;
  isRefreshing: boolean;
  terminalEndRef: React.RefObject<HTMLDivElement | null>;
  getRelativeTime: (dateStr: string) => string;
  getFutureRelativeTime: (dateStr: string | null | undefined) => string;
}

const LOGS_PER_PAGE = 50;

export function LogsTable({
  filteredLogs,
  workerStatus,
  lastRunTask,
  isRefreshing,
  terminalEndRef,
  getRelativeTime,
  getFutureRelativeTime,
}: LogsTableProps) {
  const [logTypeFilter, setLogTypeFilter] = useState<'ALL' | 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO'>('ALL');
  const [page, setPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(displayedLogs.length / LOGS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pagedLogs = displayedLogs.slice((currentPage - 1) * LOGS_PER_PAGE, currentPage * LOGS_PER_PAGE);

  return (
    <div className="space-y-4">
      {/* Type Filter pills */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'SUCCESS', 'ERROR', 'WARN', 'INFO'] as const).map(type => (
            <button
              key={type}
              onClick={() => {
                setLogTypeFilter(type);
                setPage(1);
              }}
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

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center space-x-2 text-xs font-mono">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1 rounded-lg border border-[#dadada] dark:border-[#2a2a2a] bg-white dark:bg-[#111] text-[#1a1c1c] dark:text-[#f0f0f0] disabled:opacity-40 cursor-pointer"
            >
              Prev
            </button>
            <span className="text-zinc-500">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 rounded-lg border border-[#dadada] dark:border-[#2a2a2a] bg-white dark:bg-[#111] text-[#1a1c1c] dark:text-[#f0f0f0] disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Viewport: Terminal Window */}
        <div className="lg:col-span-2 flex flex-col">
          {/* Header Bar */}
          <div className="bg-[#18181b] border border-zinc-800 px-4 py-3 flex items-center justify-between text-zinc-400 font-mono text-xs rounded-t-2xl">
            <div className="flex items-center space-x-2 shrink-0 select-none">
              <span className="h-3 w-3 rounded-full bg-[#ef4444] border border-[#d63d3d]" />
              <span className="h-3 w-3 rounded-full bg-[#f59e0b] border border-[#dc8f0a]" />
              <span className="h-3 w-3 rounded-full bg-[#10b981] border border-[#0ea26b]" />
            </div>
            {/* Removed hardcoded SYSTEM_MONITOR_V4.2.LOG and UTC -05:00 as instructed */}
            <></>
          </div>

          {/* Terminal Body */}
          <div className="bg-[#09090b] text-zinc-300 font-mono text-xs p-5 overflow-y-auto no-scrollbar h-[480px] space-y-3.5 rounded-b-2xl border border-zinc-800 border-t-0 select-text">
            {isRefreshing ? (
              [1, 2, 3].map(n => <div key={n} className="h-8 bg-zinc-900 rounded animate-pulse" />)
            ) : pagedLogs.length === 0 ? (
              <div className="py-12 text-center text-zinc-500">No active logs matching search filters.</div>
            ) : (
              <>
                {pagedLogs.map(log => {
                  let prefixColor = 'text-blue-500';
                  let prefixLabel = '[INFO]';

                  if (log.status === 'SUCCESS') {
                    prefixColor = 'text-[#10b981] font-bold';
                    prefixLabel = '[SUCCESS]';
                  } else if (log.status === 'FAILED' || log.status === 'ERROR') {
                    prefixColor = 'text-[#ef4444] font-bold';
                    prefixLabel = '[ERROR]';
                  } else if (log.status === 'WARN') {
                    prefixColor = 'text-[#f59e0b] font-bold';
                    prefixLabel = '[WARN]';
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
            )}
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
  );
}
