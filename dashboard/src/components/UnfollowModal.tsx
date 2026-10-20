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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          width: '100%',
          maxWidth: 620,
          maxHeight: '85vh',
          borderRadius: 'var(--r)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          overflow: 'hidden',
          fontSize: 13,
          color: 'var(--ink)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span
              style={{
                fontSize: 10,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 600,
                display: 'block',
              }}
            >
              Maintenance
            </span>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '2px 0 0', color: 'var(--ink)' }}>
              Cleanup Assistant
            </h3>
          </div>
          <button
            onClick={() => {
              onClose();
              setCleanupOption(null);
            }}
            style={{
              padding: '6px 12px',
              background: 'var(--hover)',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>

        {/* Content body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {cleanupOption === null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
                Select a maintenance task to run:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {/* 1. Bulk Unfollow */}
                <div
                  style={{
                    padding: 16,
                    background: 'var(--hover)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div>
                    <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      1. Bulk Unfollow
                    </h4>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                      Unfollows anyone followed &gt;7 days ago who has not followed back.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      await onRunBulkCleanup();
                      onClose();
                    }}
                    disabled={isCleaning}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--warn-tint)',
                      color: 'var(--warn)',
                      border: '1px solid var(--warn)',
                      borderRadius: 'var(--r-sm)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: isCleaning ? 'not-allowed' : 'pointer',
                      opacity: isCleaning ? 0.6 : 1,
                    }}
                  >
                    Run Bulk Cleanup
                  </button>
                </div>

                {/* 2. Selective Unfollow */}
                <div
                  style={{
                    padding: 16,
                    background: 'var(--hover)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div>
                    <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      2. Selective Unfollow
                    </h4>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                      Preview eligible developers to unfollow them selectively or in bulk.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      await onFetchUnfollowList();
                      setCleanupOption('list');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--r-sm)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Preview & Select
                  </button>
                </div>

                {/* 3. Log Cleanup */}
                <div
                  style={{
                    padding: 16,
                    background: 'var(--hover)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div>
                    <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                      3. Log Cleanup
                    </h4>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                      Purges old logs history to save database storage, keeping the latest 200 logs.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      await onFetchTotalLogsCount();
                      setCleanupOption('logs');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--r-sm)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Purge Old Logs
                  </button>
                </div>

                {/* 4. Clear Stale Profiles */}
                <div
                  style={{
                    padding: 16,
                    background: 'var(--hover)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div>
                    <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      4. Clear Stale Profiles
                    </h4>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                      Deletes discovered profiles that were skipped and never starred or followed.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCleanupOption('stale');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--r-sm)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Clear Stale Data
                  </button>
                </div>
              </div>
            </div>
          ) : cleanupOption === 'list' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--line)',
                  paddingBottom: 8,
                }}
              >
                <h4 style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink)' }}>
                  Unfollow Candidates List
                </h4>
                <button
                  onClick={() => setCleanupOption(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 12,
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    textDecoration: 'none',
                  }}
                >
                  &larr; Back to Options
                </button>
              </div>

              {isFetchingUnfollowList ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  Fetching candidates list...
                </div>
              ) : unfollowList.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13, fontWeight: 500 }}>
                  No users match the cleanup criteria right now.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '42vh', overflowY: 'auto', paddingRight: 4 }}>
                    {unfollowList.map((user) => (
                      <div
                        key={user.id}
                        style={{
                          padding: '10px 14px',
                          background: 'var(--hover)',
                          border: '1px solid var(--line)',
                          borderRadius: 'var(--r-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--ink)', display: 'block', fontSize: 13 }}>
                            @{user.owner}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 2 }}>
                            Followed: {new Date(user.followed_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <button
                            onClick={async () => {
                              await onUnfollowUser(user.owner);
                              onRemoveFromUnfollowList(user.owner);
                            }}
                            style={{
                              padding: '5px 12px',
                              background: 'var(--warn-tint)',
                              border: '1px solid var(--warn)',
                              color: 'var(--warn)',
                              borderRadius: 'var(--r-sm)',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Unfollow
                          </button>
                          <a
                            href={`https://github.com/${user.owner}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '5px 12px',
                              background: 'var(--surface)',
                              border: '1px solid var(--line)',
                              color: 'var(--ink)',
                              borderRadius: 'var(--r-sm)',
                              fontSize: 11,
                              fontWeight: 500,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            Profile
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ paddingTop: 8 }}>
                    <button
                      onClick={async () => {
                        await onRunBulkCleanup();
                        onClose();
                      }}
                      disabled={isCleaning}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--warn-tint)',
                        color: 'var(--warn)',
                        border: '1px solid var(--warn)',
                        fontSize: 13,
                        fontWeight: 600,
                        borderRadius: 'var(--r-sm)',
                        cursor: isCleaning ? 'not-allowed' : 'pointer',
                        opacity: isCleaning ? 0.6 : 1,
                      }}
                    >
                      Unfollow All ({unfollowList.length})
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : cleanupOption === 'logs' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--line)',
                  paddingBottom: 8,
                }}
              >
                <h4 style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)' }}>
                  Logs Cleanup Confirmation
                </h4>
                <button
                  onClick={() => setCleanupOption(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 12,
                    color: 'var(--accent)',
                    cursor: 'pointer',
                  }}
                >
                  &larr; Back
                </button>
              </div>

              <div
                style={{
                  padding: 16,
                  background: 'var(--hover)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-sm)',
                }}
              >
                <p style={{ margin: 0, fontWeight: 700, fontSize: 12, color: 'var(--accent)' }}>
                  PURGING HISTORICAL ACTION LOGS
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--muted)' }}>
                  This action will delete all old worker logs except for the latest 200 entries. It will not alter repository evaluation scores or follower details.
                </p>
                <p style={{ margin: '12px 0 0', fontSize: 12, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>
                  This will delete {Math.max(0, totalLogsCount - 200)} old log entries (Total logs in DB: {totalLogsCount}).
                </p>
              </div>

              <div style={{ paddingTop: 8 }}>
                <button
                  onClick={async () => {
                    await onRunLogCleanup();
                    onClose();
                    setCleanupOption(null);
                  }}
                  disabled={isCleaning}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--warn-tint)',
                    color: 'var(--warn)',
                    border: '1px solid var(--warn)',
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 'var(--r-sm)',
                    cursor: isCleaning ? 'not-allowed' : 'pointer',
                    opacity: isCleaning ? 0.6 : 1,
                  }}
                >
                  Confirm and Delete Logs
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--line)',
                  paddingBottom: 8,
                }}
              >
                <h4 style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--warn)' }}>
                  Stale Profiles Cleanup
                </h4>
                <button
                  onClick={() => setCleanupOption(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 12,
                    color: 'var(--accent)',
                    cursor: 'pointer',
                  }}
                >
                  &larr; Back
                </button>
              </div>

              <div
                style={{
                  padding: 16,
                  background: 'var(--warn-tint)',
                  border: '1px solid var(--warn)',
                  borderRadius: 'var(--r-sm)',
                }}
              >
                <p style={{ margin: 0, fontWeight: 700, fontSize: 12, color: 'var(--warn)' }}>
                  STALE PROFILE DATA REMOVAL
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--ink)' }}>
                  Deletes profiles from the database that were evaluated and skipped, but never starred or followed. Freeing up unnecessary metadata storage.
                </p>
                <p style={{ margin: '12px 0 0', fontSize: 12, fontWeight: 600, color: 'var(--warn)', fontFamily: 'var(--font-mono)' }}>
                  This will remove {staleProfilesCount} stale profiles from your table.
                </p>
              </div>

              <div style={{ paddingTop: 8 }}>
                <button
                  onClick={async () => {
                    await onRunClearStale();
                    onClose();
                    setCleanupOption(null);
                  }}
                  disabled={isCleaning}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--warn-tint)',
                    color: 'var(--warn)',
                    border: '1px solid var(--warn)',
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 'var(--r-sm)',
                    cursor: isCleaning ? 'not-allowed' : 'pointer',
                    opacity: isCleaning ? 0.6 : 1,
                  }}
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
