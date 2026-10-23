'use client';

import React, { useState } from 'react';
import type { ProfileItem } from '@/lib/types';
import { Search } from 'lucide-react';

export interface ScoreCheckerProps {
  onProfileScored?: (profile: ProfileItem) => void;
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export default function ScoreChecker({ onProfileScored }: ScoreCheckerProps) {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'info' | 'error' | 'success' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = username.trim().replace(/^@/, '');
    if (!user) return;

    setIsLoading(true);
    setStatusMsg({ text: 'Connecting to GitHub API and loading public profile...', type: 'info' });

    try {
      const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}`);
      if (userRes.status === 404) {
        throw new Error(`GitHub user @${user} not found. Please check spelling.`);
      }
      if (userRes.status === 403) {
        throw new Error('GitHub API rate limit reached. Please wait a moment and try again.');
      }
      if (!userRes.ok) {
        throw new Error(`Failed to fetch profile (HTTP ${userRes.status}).`);
      }
      const uData = await userRes.json();

      await sleep(350);
      setStatusMsg({ text: 'Extracting verified public repositories and commit logs...', type: 'info' });

      const reposRes = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=updated`);
      const repos = reposRes.ok ? await reposRes.json() : [];

      let realCommits90d = 0;
      let latestEventPushTimestamp = 0;
      try {
        const eventsRes = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/events/public?per_page=100`);
        if (eventsRes.ok) {
          const events = await eventsRes.json();
          const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
          events.forEach((ev: any) => {
            const evTime = new Date(ev.created_at).getTime();
            if (ev.type === 'PushEvent') {
              if (evTime > latestEventPushTimestamp) latestEventPushTimestamp = evTime;
              if (evTime >= ninetyDaysAgo) {
                realCommits90d += (ev.payload && (ev.payload.commits ? ev.payload.commits.length : (ev.payload.size || ev.payload.distinct_size || 1))) || 1;
              }
            }
          });
        }
      } catch (_) {}

      setStatusMsg({ text: 'Synthesizing AI evaluation breakdown across activity, quality, relevance & reach...', type: 'info' });
      await sleep(400);

      const now = Date.now();
      let latestRepoPushTimestamp = 0;
      repos.forEach((r: any) => {
        const t = r.pushed_at ? new Date(r.pushed_at).getTime() : 0;
        if (t > latestRepoPushTimestamp) latestRepoPushTimestamp = t;
      });

      const trueLatestPushTimestamp = Math.max(latestEventPushTimestamp, latestRepoPushTimestamp);
      let daysSinceLastPush = 999;
      if (trueLatestPushTimestamp > 0) {
        daysSinceLastPush = Math.max(0, Math.floor((now - trueLatestPushTimestamp) / (1000 * 60 * 60 * 24)));
      }

      const originalRepos = repos.filter((r: any) => !r.fork);
      const totalStars = repos.reduce((acc: number, r: any) => acc + (r.stargazers_count || 0), 0);

      // 1. Activity (30% weight)
      let activity = 20;
      if (daysSinceLastPush <= 2) activity += 32;
      else if (daysSinceLastPush <= 7) activity += 24;
      else if (daysSinceLastPush <= 21) activity += 16;
      else if (daysSinceLastPush <= 45) activity += 8;

      if (realCommits90d >= 80) activity += 40;
      else if (realCommits90d >= 30) activity += 30;
      else if (realCommits90d >= 10) activity += 20;
      else if (realCommits90d >= 2) activity += 10;
      activity = Math.min(96, Math.max(15, activity));

      // 2. Code Quality (35% weight)
      let codeQuality = 25;
      if (totalStars >= 300) codeQuality += 42;
      else if (totalStars >= 100) codeQuality += 34;
      else if (totalStars >= 40) codeQuality += 25;
      else if (totalStars >= 15) codeQuality += 16;
      else if (totalStars >= 3) codeQuality += 8;

      const descCount = repos.filter((r: any) => r.description && r.description.trim().length > 15).length;
      const descRatio = repos.length ? descCount / repos.length : 0;
      if (descRatio >= 0.7) codeQuality += 14;
      else if (descRatio >= 0.4) codeQuality += 7;

      const origRatio = repos.length ? originalRepos.length / repos.length : 0;
      if (origRatio >= 0.8 && originalRepos.length >= 4) codeQuality += 12;
      else if (origRatio < 0.4) codeQuality -= 12;
      codeQuality = Math.min(96, Math.max(15, codeQuality));

      // 3. Relevance (20% weight)
      const realBio = uData.bio ? uData.bio.trim() : '';
      const langCounts: Record<string, number> = {};
      let totalLangs = 0;
      repos.forEach((r: any) => {
        if (r.language && r.language !== 'Profile') {
          langCounts[r.language] = (langCounts[r.language] || 0) + 1;
          totalLangs++;
        }
      });
      const sortedLangEntries = Object.entries(langCounts).sort((a, b) => b[1] - a[1]);
      const dynamicLanguages = sortedLangEntries.length > 0 ? sortedLangEntries.map(e => ({ name: e[0], pct: Math.round((e[1] / Math.max(1, totalLangs)) * 100) })) : [{ name: 'Code', pct: 100 }];

      let relevance = 30;
      if (realBio.length >= 50) relevance += 25;
      else if (realBio.length >= 15) relevance += 15;

      if (dynamicLanguages.length >= 2 && dynamicLanguages.length <= 5) relevance += 20;
      else if (dynamicLanguages.length === 1 && dynamicLanguages[0].name !== 'Code') relevance += 10;

      if (repos.length >= 5) relevance += 15;
      else if (repos.length <= 1) relevance -= 8;
      relevance = Math.min(92, Math.max(20, relevance));

      // 4. Reach (15% weight)
      const followers = typeof uData.followers === 'number' ? uData.followers : 0;
      const following = typeof uData.following === 'number' ? uData.following : 0;
      let reach = 20;
      if (followers >= 1000) reach += 58;
      else if (followers >= 400) reach += 46;
      else if (followers >= 150) reach += 35;
      else if (followers >= 40) reach += 24;
      else if (followers >= 10) reach += 14;
      else if (followers >= 2) reach += 6;

      if (following > 0) {
        const fRatio = followers / following;
        if (fRatio >= 2.0 && followers >= 40) reach += 14;
        else if (fRatio >= 1.0) reach += 8;
        else if (fRatio < 0.3 && following > 80) reach -= 14;
      }
      reach = Math.min(94, Math.max(15, reach));

      const rawScore = Math.round(
        activity * 0.30 +
        codeQuality * 0.35 +
        relevance * 0.20 +
        reach * 0.15
      );
      const score = Math.max(1, Math.min(99, rawScore));

      const topRepo = repos.sort((a: any, b: any) => (b.stargazers_count || 0) - (a.stargazers_count || 0))[0];
      const primaryLang = dynamicLanguages[0]?.name || topRepo?.language || 'Software';

      let reason = '';
      if (topRepo && totalStars >= 50) {
        reason = `Active ${primaryLang} contributor maintaining ${topRepo.name} with ${totalStars} stars.`;
      } else if (realBio) {
        reason = `${realBio.slice(0, 90).trim()} (${primaryLang})`;
      } else {
        reason = `Active ${primaryLang} developer shipping public repositories.`;
      }

      const topReposFormatted = repos.slice(0, 3).map((r: any) => ({
        name: r.name,
        stars: r.stargazers_count || 0,
        language: r.language || 'Code',
        description: r.description || null,
        pushed_at: r.pushed_at,
      }));

      const newProfile: ProfileItem = {
        owner: uData.login,
        login: uData.login,
        display_name: uData.name || uData.login,
        avatar_url: uData.avatar_url,
        bio: realBio || null,
        grade: score,
        reason,
        reposCount: repos.length,
        totalGrade: score,
        avgGrade: score,
        followers_count: followers,
        following_count: following,
        last_pushed_at: trueLatestPushTimestamp ? new Date(trueLatestPushTimestamp).toISOString() : null,
        language: primaryLang,
        languages: dynamicLanguages,
        top_repos: topReposFormatted,
        followed: false,
        follow_back: false,
        unfollowed: false,
        whitelisted: false,
        followStatus: {
          followed: false,
          unfollowed: false,
          follow_skipped: score < 60,
          follow_back: false,
          reason: score < 60 ? 'Score below follow threshold' : undefined,
        },
        repos: repos.slice(0, 5).map((r: any, idx: number) => ({
          id: idx + 90000,
          github_url: r.html_url,
          owner: uData.login,
          name: r.name,
          stars: r.stargazers_count || 0,
          language: r.language || null,
          description: r.description || null,
          last_pushed_at: r.pushed_at || null,
          grade: score,
          starred: false,
          followed: false,
          follow_back: false,
          unfollowed: false,
          follow_skipped: score < 60,
          whitelisted: false,
        })),
      };

      setStatusMsg({
        text: `✓ Evaluated @${uData.login} with a score of ${score}/100 (${score >= 90 ? 'Top Pick ⭐' : score >= 60 ? 'Threshold Met' : 'Skipped'}).`,
        type: 'success',
      });

      if (onProfileScored) {
        onProfileScored(newProfile);
      }
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Failed to score GitHub profile.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      marginTop: 16,
      background: 'var(--surface)',
      border: '1px solid var(--line-strong)',
      borderRadius: 'var(--r)',
      padding: '14px 18px',
      width: '100%',
      maxWidth: 640,
      boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(22,24,29,0.04))',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
        <Search className="h-4 w-4 text-[var(--ink)]" />
        <span>Check your GitHub score</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', background: 'var(--hover)', padding: '2px 7px', borderRadius: 999, border: '1px solid var(--line)' }}>
          Real-time Audit
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)', fontWeight: 600, fontSize: 13, pointerEvents: 'none' }}>
            @
          </span>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="username (e.g. torvalds)"
            disabled={isLoading}
            style={{
              width: '100%',
              border: '1px solid var(--line-strong)',
              borderRadius: 7,
              padding: '7px 10px 7px 24px',
              background: 'var(--bg)',
              fontSize: 13,
              color: 'var(--ink)',
              outline: 'none',
              transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !username.trim()}
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            padding: '7px 14px',
            borderRadius: 7,
            background: 'var(--ink)',
            color: 'var(--surface)',
            border: '1px solid var(--ink)',
            cursor: (isLoading || !username.trim()) ? 'not-allowed' : 'pointer',
            opacity: (isLoading || !username.trim()) ? 0.6 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.16s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {isLoading ? 'Auditing...' : 'Score profile'}
        </button>
      </form>

      {statusMsg && (
        <div style={{
          fontSize: 12.5,
          marginTop: 2,
          color: statusMsg.type === 'error' ? '#DC2626' : statusMsg.type === 'success' ? 'var(--accent)' : 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          {statusMsg.text}
        </div>
      )}
    </div>
  );
}
