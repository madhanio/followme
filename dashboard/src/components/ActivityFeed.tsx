'use client';

import { useState } from 'react';
import type { Repo } from '@/lib/types';

/* Build a flat event list from repos, sorted newest first, capped at 10 visible */

type EventKind = 'followed' | 'unfollowed' | 'follow_back';

interface ActivityEvent {
  kind: EventKind;
  login: string;
  avatar_url?: string | null;
  timestamp: string; /* ISO string */
  grade?: number | null;
}

function buildEvents(repos: Repo[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const r of repos) {
    const owner = r.owner ?? '';
    const avatar = owner ? `https://github.com/${owner}.png?size=72` : null;

    /* followed event — use created_at as proxy */
    if (r.followed && r.created_at) {
      events.push({
        kind: 'followed',
        login: owner,
        avatar_url: avatar,
        timestamp: r.created_at,
        grade: r.grade ?? null,
      });
    }
    /* unfollowed event — use followed_at or created_at fallback */
    if (r.unfollowed && (r.updated_at || r.created_at)) {
      events.push({
        kind: 'unfollowed',
        login: owner,
        avatar_url: avatar,
        timestamp: r.updated_at || r.created_at || '',
        grade: r.grade ?? null,
      });
    }
    /* follow_back event */
    if (r.follow_back && (r.updated_at || r.created_at) && !r.unfollowed) {
      events.push({
        kind: 'follow_back',
        login: owner,
        avatar_url: avatar,
        timestamp: r.updated_at || r.created_at || '',
        grade: r.grade ?? null,
      });
    }
  }

  /* Sort newest first */
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  /* Deduplicate: one event per (login, kind) — keep most recent */
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = `${e.login}:${e.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function relTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const KIND_META: Record<EventKind, { label: string; color: string; bg: string; icon: string }> = {
  followed: { label: 'Followed', color: 'var(--accent)', bg: 'var(--accent-tint)', icon: '＋' },
  unfollowed: { label: 'Unfollowed', color: 'var(--warn)', bg: 'var(--warn-tint)', icon: '−' },
  follow_back: { label: 'Followed back', color: 'var(--accent)', bg: 'var(--accent-tint)', icon: '↩' },
};

function EventRow({ event }: { event: ActivityEvent }) {
  const meta = KIND_META[event.kind];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 16px',
        borderBottom: '1px solid var(--line)',
      }}
    >
      {/* Kind pill */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 99,
          background: meta.bg,
          color: meta.color,
          flexShrink: 0,
          minWidth: 80,
          textAlign: 'center',
        }}
      >
        {meta.icon} {meta.label}
      </span>

      {/* Avatar */}
      {event.avatar_url ? (
        <img
          src={event.avatar_url}
          alt={event.login}
          width={24}
          height={24}
          style={{ borderRadius: '50%', flexShrink: 0, border: '1px solid var(--line)' }}
        />
      ) : (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            flexShrink: 0,
            background: 'var(--hover)',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            color: 'var(--muted)',
            fontWeight: 600,
          }}
        >
          {event.login[0]?.toUpperCase()}
        </div>
      )}

      {/* Login */}
      <a
        href={`https://github.com/${event.login}`}
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', flex: 1 }}
      >
        {event.login}
      </a>

      {/* Grade */}
      {event.grade !== null && event.grade !== undefined && (
        <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
          score {event.grade}
        </span>
      )}

      {/* Time */}
      <span style={{ fontSize: 11, color: 'var(--faint)', flexShrink: 0 }}>
        {relTime(event.timestamp)}
      </span>
    </div>
  );
}

const COLLAPSED_LIMIT = 10;

export interface ActivityFeedProps {
  repos: Repo[];
}

export default function ActivityFeed({ repos }: ActivityFeedProps) {
  const [expanded, setExpanded] = useState(false);
  const allEvents = buildEvents(repos);
  const visible = expanded ? allEvents : allEvents.slice(0, COLLAPSED_LIMIT);

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
          padding: '12px 16px',
          borderBottom: allEvents.length > 0 ? '1px solid var(--line)' : 'none',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          Recent Activity
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {allEvents.length} events
        </span>
      </div>

      {/* Rows */}
      {visible.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          No activity yet.
        </div>
      ) : (
        visible.map((e, i) => <EventRow key={`${e.login}:${e.kind}:${i}`} event={e} />)
      )}

      {/* Expand / collapse toggle */}
      {allEvents.length > COLLAPSED_LIMIT && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)' }}>
          <button
            onClick={() => setExpanded((x) => !x)}
            style={{
              width: '100%',
              padding: '7px 0',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r)',
              background: 'var(--hover)',
              color: 'var(--muted)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {expanded ? 'Show less' : `Show all ${allEvents.length} events`}
          </button>
        </div>
      )}
    </div>
  );
}
