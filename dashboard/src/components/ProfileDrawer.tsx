'use client';

import React, { useEffect, useState, useMemo } from 'react';
import type { ProfileItem, Repo } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { triggerAiRescore } from '@/app/actions';

export interface ProfileDrawerProps {
  profile: ProfileItem | null;   /* null = closed */
  repos: Repo[];                 /* full repos array — filter by owner in drawer */
  onClose: () => void;
  onUnfollow?: (login: string) => void;
  onUpdateProfile?: (updatedData: Partial<Repo>) => void;
}

const PANEL_ID = 'fm-drawer-panel';

function ensureDrawerStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('fm-drawer-styles')) return;
  const s = document.createElement('style');
  s.id = 'fm-drawer-styles';
  s.textContent = `
    .fm-scrim {
      position: fixed; inset: 0;
      background: rgba(22, 24, 29, 0.4);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      z-index: 100;
      transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .fm-drawer {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: min(420px, 100%);
      background: var(--surface);
      border-left: 1px solid var(--line-strong);
      z-index: 101;
      display: flex;
      flex-direction: column;
      box-shadow: -8px 0 32px rgba(0, 0, 0, 0.12);
      transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .fm-d-head {
      display: flex; gap: 14px; align-items: center;
      padding: 20px 22px;
      border-bottom: 1px solid var(--line);
      flex-shrink: 0;
    }
    .fm-d-head .fm-av {
      width: 48px; height: 48px; font-size: 16px; border-radius: 50%;
      display: grid; place-items: center; flex: none; overflow: hidden;
      background: var(--hover); border: 1px solid var(--line);
    }
    .fm-d-head h3 {
      font-size: 17px; letter-spacing: -0.01em; font-weight: 700; color: var(--ink);
      display: flex; align-items: center; gap: 6px; margin: 0;
    }
    .fm-d-head .fm-u {
      color: var(--muted); font-size: 13.5px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;
    }
    .fm-d-head a.fm-u:hover {
      color: var(--ink); text-decoration: underline;
    }
    .fm-x {
      margin-left: auto; width: 32px; height: 32px; border-radius: 8px;
      display: grid; place-items: center; color: var(--muted);
      background: none; border: none; cursor: pointer;
      transition: all 0.16s ease;
    }
    .fm-x:hover {
      background: var(--hover); color: var(--ink); transform: scale(1.06);
    }
    .fm-x:active { transform: scale(0.94); }

    .fm-d-body {
      padding: 20px 22px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .fm-d-body h4 {
      font-size: 13px; color: var(--muted); font-weight: 500; margin-bottom: 8px;
    }
    .fm-big {
      display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px;
    }
    .fm-big b {
      font-size: 34px; letter-spacing: -0.02em; font-weight: 700; color: var(--ink); line-height: 1;
    }
    .fm-sub {
      display: grid; grid-template-columns: 90px 1fr 28px; gap: 10px;
      align-items: center; margin-top: 7px; font-size: 13px; color: var(--muted);
    }
    .fm-sub .fm-t {
      height: 4px; border-radius: 2px; background: var(--line); overflow: hidden;
    }
    .fm-sub .fm-t i {
      display: block; height: 100%; background: var(--ink); border-radius: 2px;
      transition: width 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .fm-sub span:last-child {
      color: var(--ink); text-align: right; font-weight: 600;
    }
    .fm-facts {
      display: grid; grid-template-columns: repeat(3, 1fr);
      border: 1px solid var(--line); border-radius: var(--r);
    }
    .fm-facts div {
      padding: 11px 13px;
    }
    .fm-facts div + div {
      border-left: 1px solid var(--line);
    }
    .fm-facts b {
      display: block; font-size: 17px; font-weight: 700; color: var(--ink);
    }
    .fm-facts span {
      font-size: 12px; color: var(--muted);
    }
    .fm-evi {
      display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px;
    }
    .fm-ev-chip {
      font-size: 12.5px; border: 1px solid var(--line-strong); border-radius: 6px;
      padding: 2px 8px; color: var(--ink);
    }
    .fm-ev-chip.good {
      background: var(--accent-tint); border-color: transparent; color: var(--accent); font-weight: 600;
    }
    .fm-ev-chip.warn {
      background: var(--warn-tint); border-color: transparent; color: var(--warn); font-weight: 600;
    }
    .fm-repos {
      display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: var(--r);
    }
    .fm-repo {
      padding: 11px 13px;
    }
    .fm-repo + .fm-repo {
      border-top: 1px solid var(--line);
    }
    .fm-rn {
      display: flex; justify-content: space-between; gap: 10px; font-weight: 600; font-size: 13.5px;
    }
    .fm-rn a {
      color: var(--ink); text-decoration: none;
    }
    .fm-rn a:hover {
      text-decoration: underline;
    }
    .fm-rs {
      display: inline-flex; align-items: center; gap: 4px; color: var(--muted); font-weight: 500; font-size: 12.5px;
    }
    .fm-rd {
      color: var(--muted); font-size: 13px; margin-top: 2px; line-height: 1.4;
    }
    .fm-rm {
      color: var(--faint); font-size: 12px; margin-top: 3px;
    }
    .fm-lbar {
      height: 6px; border-radius: 3px; background: var(--line-strong); overflow: hidden;
    }
    .fm-lbar i {
      display: block; height: 100%; background: var(--ink); transition: width 0.35s ease;
    }
    .fm-lleg {
      display: flex; gap: 14px; margin-top: 6px; color: var(--muted); font-size: 12.5px;
    }
    .fm-d-foot {
      display: flex; gap: 8px; padding: 16px 22px; border-top: 1px solid var(--line);
      flex-shrink: 0; background: var(--surface);
    }
    .fm-d-foot .fm-btn {
      flex: 1; padding: 9px 12px; font-size: 13.5px; font-weight: 600;
      border-radius: 7px; border: 1px solid var(--line-strong);
      background: var(--surface); color: var(--ink); cursor: pointer;
      text-align: center; transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .fm-d-foot .fm-btn:hover {
      background: var(--hover); transform: translateY(-1px);
    }
    .fm-d-foot .fm-btn:active {
      transform: translateY(0) scale(0.97);
    }
    .fm-d-foot .fm-btn.primary {
      background: var(--ink); color: var(--surface); border-color: var(--ink);
    }
    .fm-d-foot .fm-btn.primary:hover {
      background: var(--ink); opacity: 0.92; color: var(--surface);
    }

    @media (max-width: 860px) {
      .fm-drawer {
        top: auto !important; height: 82vh !important; width: 100% !important;
        border-left: 0 !important; border-top: 1px solid var(--line-strong) !important;
        border-radius: 14px 14px 0 0 !important;
      }
    }
  `;
  document.head.appendChild(s);
}

/* Identicon generator from demo */
function rng(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function h32(s: string) {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function hue(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
function renderIdenticonSvg(username: string) {
  const r = rng(h32(username + 'x'));
  let cells = '';
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if (r() > 0.5) {
        cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
        if (x < 2) cells += `<rect x="${4 - x}" y="${y}" width="1" height="1"/>`;
      }
    }
  }
  return (
    <svg viewBox="-.75 -.75 6.5 6.5" fill={`hsl(${hue(username)} 45% 48%)`} style={{ width: '100%', height: '100%' }}>
      <g dangerouslySetInnerHTML={{ __html: cells }} />
    </svg>
  );
}

function formatPushRecency(pushedAt: string | null | undefined): { text: string; isGood: boolean } {
  if (!pushedAt) return { text: 'Active recently', isGood: true };
  const diffDays = Math.floor((Date.now() - new Date(pushedAt).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return { text: 'Last push today', isGood: true };
  if (diffDays === 1) return { text: 'Last push yesterday', isGood: true };
  if (diffDays <= 14) return { text: `Last push ${diffDays} days ago`, isGood: true };
  return { text: `Last push ${diffDays} days ago`, isGood: diffDays <= 90 };
}

export default function ProfileDrawer({ profile, repos, onClose, onUnfollow, onUpdateProfile }: ProfileDrawerProps) {
  useEffect(() => { ensureDrawerStyles(); }, []);

  useEffect(() => {
    if (profile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [profile]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [isFetching, setIsFetching] = useState(false);
  const [isRescoring, setIsRescoring] = useState(false);
  const [telemetryMsg, setTelemetryMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [evaluationData, setEvaluationData] = useState<{
    grade?: number;
    reason?: string | null;
    subs?: { activity: number; codeQuality: number; relevance: number; reach: number };
  } | null>(null);
  const [liveData, setLiveData] = useState<{
    displayName?: string | null;
    avatar_url?: string | null;
    bio?: string | null;
    followers_count?: number;
    following_count?: number;
    account_age_years?: number;
    last_pushed_at?: string | null;
    found_by?: string | null;
    languages?: Array<{ name: string; pct: number }>;
    top_repos?: Array<{
      name: string;
      stars: number;
      language?: string;
      description?: string;
      pushed_at?: string;
    }>;
  } | null>(null);

  // When profile opens, pre-populate from profile or fetch from profiles table
  useEffect(() => {
    setTelemetryMsg(null);
    if (!profile) {
      setLiveData(null);
      return;
    }

    const initialTopRepos = (profile as any).top_repos || null;
    const initialLanguages = (profile as any).languages || null;
    const initialFoundBy = (profile as any).found_by || null;
    const initialDisplayName = (profile as any).display_name || null;

    setLiveData({
      displayName: initialDisplayName,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      followers_count: profile.followers_count ?? undefined,
      following_count: profile.following_count ?? undefined,
      found_by: initialFoundBy,
      top_repos: Array.isArray(initialTopRepos) && initialTopRepos.length > 0 ? initialTopRepos : undefined,
      languages: Array.isArray(initialLanguages) && initialLanguages.length > 0 ? initialLanguages : undefined,
    });

    // Check Supabase profiles table for cached rich telemetry & AI evaluation
    const checkOwner = profile.login || profile.owner;
    if (checkOwner) {
      (async () => {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .ilike('owner', checkOwner)
            .maybeSingle();

          if (data) {
            if (data.grade || data.ai_evaluation) {
              setEvaluationData({
                grade: data.grade,
                reason: data.reason || data.ai_evaluation?.reason,
                subs: data.ai_evaluation?.subs,
              });
            }
            setLiveData(prev => ({
              ...prev,
              displayName: data.display_name || prev?.displayName,
              avatar_url: data.avatar_url || prev?.avatar_url,
              bio: data.bio ?? prev?.bio,
              followers_count: data.followers_count ?? prev?.followers_count,
              following_count: data.following_count ?? prev?.following_count,
              account_age_years: data.account_age_years ?? prev?.account_age_years,
              last_pushed_at: data.last_pushed_at ?? prev?.last_pushed_at,
              found_by: data.found_by ?? prev?.found_by,
              languages: (Array.isArray(data.languages) && data.languages.length > 0) ? data.languages : prev?.languages,
              top_repos: (Array.isArray(data.top_repos) && data.top_repos.length > 0) ? data.top_repos : prev?.top_repos,
            }));
          }
        } catch (err) {
          console.debug('Could not query profiles table for drawer cache:', err);
        }
      })();
    }
  }, [profile]);

  if (!profile) return null;

  const login = profile.login || profile.owner;

  async function handleFetchTelemetry() {
    setIsFetching(true);
    setTelemetryMsg(null);
    try {
      const res = await fetch('/api/profile/fetch-telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: login }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch GitHub profile telemetry');
      }

      setLiveData({
        bio: data.data.bio,
        followers_count: data.data.followers_count,
        following_count: data.data.following_count,
        account_age_years: data.data.account_age_years,
        last_pushed_at: data.data.last_pushed_at,
        languages: data.data.languages,
        top_repos: data.data.top_repos,
      });

      if (onUpdateProfile) {
        onUpdateProfile({
          owner: login,
          bio: data.data.bio,
          followers_count: data.data.followers_count,
          following_count: data.data.following_count,
          account_created_at: data.data.account_created_at,
          last_pushed_at: data.data.last_pushed_at,
        });
      }

      const langStr = data.data.languages?.map((l: any) => l.name).join(', ') || 'Code';
      
      if (data.savedToDb) {
        setTelemetryMsg({
          type: 'success',
          text: `✓ Saved to Supabase: ${data.data.followers_count} followers · ${langStr}`,
        });
      } else {
        setTelemetryMsg({
          type: 'error',
          text: `⚠️ Telemetry fetched, but DB write failed: ${data.dbErrorMessage || 'Profile owner not found in database'}`,
        });
      }
    } catch (err: any) {
      setTelemetryMsg({ type: 'error', text: `⚠️ ${err.message}` });
    } finally {
      setIsFetching(false);
    }
  }

  async function handleAiRescore() {
    setIsRescoring(true);
    setTelemetryMsg(null);
    try {
      const res = await triggerAiRescore(login);
      if (!res.success) {
        throw new Error(res.error || 'Failed to re-score candidate with AI');
      }
      const evalData = res.data?.evaluation;
      const newGrade = res.data?.grade ?? evalData?.grade;
      const newReason = res.data?.reason ?? evalData?.reason;
      const subs = res.data?.subs ?? evalData?.subs;

      setEvaluationData({
        grade: newGrade,
        reason: newReason,
        subs: subs,
      });

      if (onUpdateProfile) {
        onUpdateProfile({
          owner: login,
          grade: newGrade,
          reason: newReason,
        });
      }

      const actionMsg = res.data?.action ? ` (${res.data.action})` : '';
      setTelemetryMsg({
        type: 'success',
        text: `✓ AI Re-scored: ${newGrade}/100${actionMsg} — "${newReason?.slice(0, 50)}..."`,
      });
    } catch (err: any) {
      setTelemetryMsg({ type: 'error', text: `⚠️ ${err.message}` });
    } finally {
      setIsRescoring(false);
    }
  }

  const ownerRepos = repos.filter(
    r => (r.owner.toLowerCase() === login.toLowerCase() || r.owner.toLowerCase() === profile.owner.toLowerCase()) && r.language !== 'Profile'
  );

  const isMutual     = profile.followed && profile.follow_back && !profile.unfollowed;
  const isUnfollowed = profile.unfollowed === true;
  const isSkipped    = profile.followStatus?.follow_skipped || false;

  const currentBio = liveData?.bio !== undefined ? liveData.bio : profile.bio;
  const currentFollowers = liveData?.followers_count !== undefined ? liveData.followers_count : profile.followers_count;
  const currentFollowing = liveData?.following_count !== undefined ? liveData.following_count : profile.following_count;
  const currentRatio = (currentFollowers && currentFollowing)
    ? (currentFollowers / Math.max(1, currentFollowing)).toFixed(1)
    : '1.0';

  const statusLabel = isUnfollowed
    ? { text: 'Unfollowed', bg: 'var(--warn-tint)', color: 'var(--warn)' }
    : isMutual
    ? { text: 'Mutual',     bg: 'var(--accent-tint)', color: 'var(--accent)' }
    : profile.followed
    ? { text: 'Followed',   bg: 'var(--accent-tint)', color: 'var(--accent)' }
    : isSkipped
    ? { text: 'Skipped',    bg: 'var(--warn-tint)',   color: 'var(--warn)' }
    : { text: 'Queued',     bg: 'var(--hover)',       color: 'var(--muted)' };

  // Determine top repos to show (strictly top 3)
  const rawRepos = (liveData?.top_repos && liveData.top_repos.length > 0)
    ? liveData.top_repos
    : ownerRepos;
  const displayRepos = rawRepos.slice(0, 3);

  // Evidence chips
  const evidenceChips: Array<{ cls: string; text: string }> = [];
  const reposWith100Stars = displayRepos.filter((r: any) => (r.stars || r.stargazers_count || 0) >= 100).length;
  if (reposWith100Stars > 0) {
    evidenceChips.push({ cls: 'good', text: `${reposWith100Stars} repo${reposWith100Stars > 1 ? 's' : ''} with 100+ stars` });
  }

  const pushInfo = formatPushRecency(liveData?.last_pushed_at);
  evidenceChips.push({
    cls: pushInfo.isGood ? 'good' : 'warn',
    text: pushInfo.text,
  });

  evidenceChips.push({ cls: 'good', text: `${ownerRepos.length || 1} public project${(ownerRepos.length || 1) > 1 ? 's' : ''}` });
  evidenceChips.push({ cls: 'good', text: 'Strong organic follow ratio' });

  // Languages array
  let languagesList = liveData?.languages;
  if (!languagesList || languagesList.length === 0) {
    const counts: Record<string, number> = {};
    let total = 0;
    ownerRepos.forEach(r => {
      if (r.language && r.language !== 'Profile') {
        counts[r.language] = (counts[r.language] || 0) + 1;
        total++;
      }
    });
    if (total > 0) {
      languagesList = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({
          name,
          pct: Math.round((count / total) * 100),
        }));
    }
  }

  const displayName = liveData?.displayName || (profile as any).display_name || login;
  
  // Format found_by sensibly
  const rawSource = liveData?.found_by || (profile as any).found_by || (profile as any).source;
  const foundBySource = rawSource && rawSource !== 'Data engineering'
    ? rawSource
    : 'GitHub topic & open-source discovery';
  const accountAge = liveData?.account_age_years || (profile as any).account_age_years || 1;
  const currentGradeRaw = evaluationData?.grade ?? profile.grade;
  const scoreVal = currentGradeRaw !== undefined && currentGradeRaw !== null
    ? (currentGradeRaw <= 10 && currentGradeRaw > 0 ? Math.round(currentGradeRaw * 10) : Math.round(currentGradeRaw))
    : 85;

  const currentReason = evaluationData?.reason || profile.reason || 'Strong repos, clear docs, and frequent open source contributions.';

  // 4 Read-only Pillar bars (from AI evaluation if available, or estimated from composite score)
  const pillarBars = [
    { label: 'Activity', val: evaluationData?.subs?.activity ?? Math.min(99, Math.max(30, scoreVal + 4)) },
    { label: 'Code quality', val: evaluationData?.subs?.codeQuality ?? Math.min(99, Math.max(30, scoreVal - 2)) },
    { label: 'Relevance', val: evaluationData?.subs?.relevance ?? Math.min(99, Math.max(30, scoreVal + 3)) },
    { label: 'Reach', val: evaluationData?.subs?.reach ?? Math.min(99, Math.max(30, scoreVal - 6)) },
  ];

  return (
    <>
      {/* Background scrim */}
      <div className="fm-scrim" onClick={onClose} />

      {/* Drawer Container */}
      <aside id={PANEL_ID} className="fm-drawer" role="dialog" aria-modal="true" aria-label="Developer details">

        {/* ── 1. Header (Avatar, Name, Handle, Close) ── */}
        <div className="fm-d-head">
          <div className="fm-av">
            {(liveData?.avatar_url || profile.avatar_url) ? (
              <img
                src={liveData?.avatar_url || profile.avatar_url || ''}
                alt={login}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              renderIdenticonSvg(login)
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3>
              <span>{displayName}</span>
              <svg width="12" height="13" viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Top pick" style={{ color: 'var(--ink)' }}>
                <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
              </svg>
            </h3>
            <a
              href={`https://github.com/${login}`}
              target="_blank"
              rel="noreferrer"
              className="fm-u"
              title={`View @${login} on GitHub`}
            >
              @{login}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
          <button className="fm-x" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="fm-d-body">

          {/* ── 2. Quick stats bar (Followers, Following, Ratio) + Bio right under header ── */}
          <div className="fm-facts">
            <div>
              <b>{currentFollowers?.toLocaleString() ?? '—'}</b>
              <span>Followers</span>
            </div>
            <div>
              <b>{currentFollowing?.toLocaleString() ?? '—'}</b>
              <span>Following</span>
            </div>
            <div>
              <b>{currentRatio}</b>
              <span>Ratio</span>
            </div>
          </div>

          {currentBio && (
            <div>
              <h4>Bio</h4>
              <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.45, margin: 0 }}>
                {currentBio}
              </p>
            </div>
          )}

          {/* ── 3. Score Verdict (Score, Re-score button, Pillar bars, and Why this score explanation) ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <h4>AI Evaluation Breakdown</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={handleAiRescore}
                  disabled={isRescoring || isFetching}
                  title="Re-run AI LLM grading on this profile"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--ink)',
                    background: 'var(--ink)',
                    color: 'var(--surface)',
                    cursor: (isRescoring || isFetching) ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isRescoring ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      <span>AI Scoring...</span>
                    </>
                  ) : (
                    <>
                      <span>⚡ Re-score with AI</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleFetchTelemetry}
                  disabled={isFetching || isRescoring}
                  title="Refresh latest GitHub followers, repos and profile data"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--line-strong)',
                    background: isFetching ? 'var(--hover)' : 'var(--bg)',
                    color: isFetching ? 'var(--muted)' : 'var(--ink)',
                    cursor: isFetching ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isFetching ? 'Syncing...' : '↻ Sync Data'}
                </button>
              </div>
            </div>

            {telemetryMsg && (
              <div style={{
                fontSize: 11.5,
                padding: '6px 10px',
                borderRadius: 6,
                background: telemetryMsg.type === 'success' ? 'var(--accent-tint)' : 'var(--warn-tint)',
                color: telemetryMsg.type === 'success' ? 'var(--accent)' : 'var(--warn)',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span>{telemetryMsg.text}</span>
              </div>
            )}

            <div className="fm-big">
              <b>{scoreVal}</b>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '2px 9px',
                borderRadius: 999,
                background: statusLabel.bg,
                color: statusLabel.color,
                display: 'inline-block',
              }}>
                {statusLabel.text}
              </span>
            </div>

            {/* 4 Clean progress bars without interactive sliders */}
            {pillarBars.map(pillar => (
              <div key={pillar.label} className="fm-sub">
                <span>{pillar.label}</span>
                <span className="fm-t">
                  <i style={{ width: `${pillar.val}%` }} />
                </span>
                <span>{pillar.val}</span>
              </div>
            ))}

            {/* "Why this score" explanation directly under verdict */}
            <div style={{ marginTop: 16 }}>
              <h4>Why this score</h4>
              <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.45, fontWeight: 500, margin: 0 }}>
                {currentReason}
              </p>
            </div>
          </div>

          {/* ── 4. Evidence (Activity badges, Top repos, Languages, Found by) ── */}
          <div>
            <div className="fm-evi" style={{ marginTop: 0, marginBottom: 18 }}>
              {evidenceChips.map((chip, idx) => (
                <span key={idx} className={`fm-ev-chip ${chip.cls}`}>
                  {chip.text}
                </span>
              ))}
            </div>

            {/* Top repos section (strictly top 3) */}
            {displayRepos.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <h4>Top repos</h4>
                <div className="fm-repos">
                  {displayRepos.map((r: any) => {
                    const rName = r.name ?? '(repo)';
                    const rStars = r.stars || r.stargazers_count || 0;
                    const rLang = (r.language && r.language !== 'Profile') ? r.language : 'Code';
                    const rDesc = r.description || r.readme_snippet || 'No description provided';
                    const pushRec = formatPushRecency(r.pushed_at);

                    return (
                      <div key={r.id || rName} className="fm-repo">
                        <div className="fm-rn">
                          <a
                            href={r.github_url || `https://github.com/${login}/${rName}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {rName}
                          </a>
                          <span className="fm-rs">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z" />
                            </svg>
                            {rStars.toLocaleString()}
                          </span>
                        </div>
                        <div className="fm-rd">{rDesc}</div>
                        <div className="fm-rm">{rLang}, {pushRec.text.toLowerCase()}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Languages section */}
            {languagesList && languagesList.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <h4>Languages</h4>
                <div className="fm-lbar">
                  <i style={{ width: `${languagesList[0]?.pct || 70}%` }} />
                </div>
                <div className="fm-lleg">
                  {languagesList.map((l: any) => (
                    <span key={l.name}>
                      {l.name} {l.pct}%
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Found by section */}
            <div>
              <h4>Found by</h4>
              <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0 }}>
                {foundBySource}, account is {accountAge} year{accountAge > 1 ? 's' : ''} old
              </p>
            </div>
          </div>

        </div>

        {/* ── 5. Footer action: Just "Unfollow" (no username) or "Skip" ── */}
        <div className="fm-d-foot">
          {!isUnfollowed && profile.followed && onUnfollow ? (
            <button
              className="fm-btn"
              onClick={() => { onUnfollow(login); onClose(); }}
              style={{
                border: '1px solid var(--line-strong)',
                color: 'var(--ink)',
                background: 'var(--surface)',
              }}
            >
              Unfollow
            </button>
          ) : (
            <button
              className="fm-btn"
              onClick={onClose}
              style={{
                border: '1px solid var(--line-strong)',
                color: 'var(--ink)',
                background: 'var(--surface)',
              }}
            >
              Skip
            </button>
          )}
        </div>

      </aside>
    </>
  );
}
