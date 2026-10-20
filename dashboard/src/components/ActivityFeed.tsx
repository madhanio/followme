'use client';

import { useState } from 'react';
import type { Log, Repo } from '@/lib/types';

export interface ActivityFeedProps {
  logs?: Log[];
  repos?: Repo[];
  isLoading?: boolean;
  workerStatus?: {
    nextRun: string | null;
    lastRun: string | null;
    isJobRunning: boolean;
  } | null;
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'just now';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function getActionBadge(action: string, status: string) {
  const isErr = status === 'FAILED' || status === 'ERROR';
  if (isErr) {
    return {
      label: 'ERROR',
      bg: '#fee2e2',
      color: '#dc2626',
    };
  }
  switch (action.toUpperCase()) {
    case 'FOLLOW':
      return { label: 'FOLLOWED', bg: 'var(--accent-tint)', color: 'var(--accent)' };
    case 'UNFOLLOW':
    case 'UNFOLLOW_RATIO':
      return { label: 'UNFOLLOWED', bg: 'var(--warn-tint)', color: 'var(--warn)' };
    case 'STAR':
      return { label: 'STARRED', bg: '#fef3c7', color: '#d97706' };
    case 'GRADE':
      return { label: 'EVALUATED', bg: '#e0e7ff', color: '#4338ca' };
    case 'SKIP_FOLLOW':
      return { label: 'SKIPPED', bg: 'var(--hover)', color: 'var(--muted)' };
    case 'SYSTEM':
      return { label: 'SYSTEM', bg: 'var(--hover)', color: 'var(--ink)' };
    default:
      return { label: action, bg: 'var(--hover)', color: 'var(--muted)' };
  }
}

export default function ActivityFeed({ logs = [], isLoading = false, workerStatus }: ActivityFeedProps) {
  const [expanded, setExpanded] = useState(false);
  const COLLAPSED_LIMIT = 8;

  // Deduplicate and filter out noisy repetition (clean, single-line log items)
  const cleanLogs = logs.filter(l => l && l.message);
  const displayed = expanded ? cleanLogs : cleanLogs.slice(0, COLLAPSED_LIMIT);

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderBottom: cleanLogs.length > 0 ? '1px solid var(--line)' : 'none',
          background: 'var(--surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
            System Activity & Worker Logs
          </span>
          {workerStatus && (
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 999,
                fontWeight: 600,
                background: workerStatus.isJobRunning ? 'var(--accent-tint)' : 'var(--hover)',
                color: workerStatus.isJobRunning ? 'var(--accent)' : 'var(--muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: workerStatus.isJobRunning ? 'var(--accent)' : 'var(--faint)',
                }}
              />
              {workerStatus.isJobRunning ? 'RUNNING NOW' : 'IDLE'}
            </span>
          )}
        </div>
        {!isLoading && (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {cleanLogs.length} events logged
          </span>
        )}
      </div>

      {/* Rows */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 18px',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <div
                style={{
                  width: 75,
                  height: 20,
                  borderRadius: 4,
                  background: 'var(--hover)',
                  animation: 'fm-pulse 1.6s ease-in-out infinite',
                }}
              />
              <div
                style={{
                  flex: 1,
                  height: 14,
                  borderRadius: 4,
                  background: 'var(--hover)',
                  animation: 'fm-pulse 1.6s ease-in-out infinite',
                }}
              />
              <div
                style={{
                  width: 50,
                  height: 12,
                  borderRadius: 4,
                  background: 'var(--hover)',
                  animation: 'fm-pulse 1.6s ease-in-out infinite',
                }}
              />
            </div>
          ))}
        </div>
      ) : cleanLogs.length === 0 ? (
        <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          No system logs found yet. Run the agent to start generating activity.
        </div>
      ) : (
        displayed.map((log) => {
          const badge = getActionBadge(log.action, log.status);
          const time = formatRelativeTime(log.timestamp);
          return (
            <div
              key={log.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 18px',
                borderBottom: '1px solid var(--line)',
                gap: 12,
                fontSize: 13,
                transition: 'background 0.1s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 4,
                    background: badge.bg,
                    color: badge.color,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}
                >
                  {badge.label}
                </span>

                <span
                  style={{
                    color: 'var(--ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 12.5,
                  }}
                  title={log.message}
                >
                  {log.owner ? (
                    <b>@{log.owner}: </b>
                  ) : null}
                  {log.message}
                </span>
              </div>

              <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {time}
              </span>
            </div>
          );
        })
      )}

      {/* Expand / collapse toggle */}
      {cleanLogs.length > COLLAPSED_LIMIT && (
        <div style={{ padding: '9px 18px', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
          <button
            onClick={() => setExpanded((x) => !x)}
            style={{
              width: '100%',
              padding: '6px 0',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r)',
              background: 'var(--hover)',
              color: 'var(--muted)',
              fontSize: 12.5,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {expanded ? 'Show fewer logs' : `Show all ${cleanLogs.length} logs`}
          </button>
        </div>
      )}
    </div>
  );
}
