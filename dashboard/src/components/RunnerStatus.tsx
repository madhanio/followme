import React from 'react';
import { Play } from 'lucide-react';
import type { SystemHealthState } from '@/lib/types';

export interface RunnerStatusProps {
  workerStatus: {
    nextRun: string | null;
    isJobRunning: boolean;
  } | null;
  lastRunTime?: string | null;
  isTriggering: boolean;
  healthState: SystemHealthState | null;
  onTrigger: () => Promise<void>;
}

export function RunnerStatus({
  workerStatus,
  lastRunTime,
  isTriggering,
  healthState,
  onTrigger,
}: RunnerStatusProps) {
  const isRunning = workerStatus?.isJobRunning;
  const isGitHubInvalid = healthState?.isGitHubValid === false;

  return (
    <div className="flex items-center space-x-3 font-geist">
      {/* Header status dot and status text */}
      <div className="flex items-center space-x-2 select-none">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            isRunning
              ? 'bg-amber-500 animate-pulse'
              : healthState?.isWorkerOnline === false
              ? 'bg-rose-500'
              : 'bg-emerald-500 animate-pulse'
          }`}
        />
        <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-[#767676] hidden sm:inline-block">
          {isRunning ? 'RUNNING' : healthState?.isWorkerOnline === false ? 'OFFLINE' : 'ACTIVE'}
        </span>
      </div>

      {lastRunTime && (
        <span className="text-[10px] font-mono text-zinc-400 hidden lg:inline-block">
          Last: {lastRunTime}
        </span>
      )}

      {/* Run Now Trigger Button */}
      <button
        onClick={onTrigger}
        disabled={isTriggering || isRunning || isGitHubInvalid}
        className="min-h-[36px] px-4 flex items-center space-x-1.5 bg-[#e60023] hover:bg-[#c0001b] disabled:bg-slate-350 disabled:opacity-40 text-white text-xs font-bold rounded-full transition-all cursor-pointer shadow-sm active:scale-95 disabled:cursor-not-allowed"
        title={
          isGitHubInvalid
            ? 'Disabled: GitHub PAT is expired or invalid. Please update your token in Settings.'
            : 'Run Automation Task'
        }
      >
        <Play className="h-3.5 w-3.5 fill-current shrink-0" />
        <span>{isTriggering ? 'Running...' : 'Run Task'}</span>
      </button>
    </div>
  );
}
