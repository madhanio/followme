import { supabase, fetchAllRows } from '@/lib/supabase';
import { getUserProfile, getSystemSettings, getGitHubRateLimit, checkSystemHealth } from '@/app/actions';
import type { Repo, Log, RunSummary, UserProfile, GitHubRateLimitData, SystemHealthState } from './types';

export interface DashboardData {
  repos: Repo[];
  logs: Log[];
  runSummary: RunSummary[];
  userProfile: UserProfile | null;
  settings: Record<string, any> | null;
  rateLimitData?: GitHubRateLimitData;
  healthState?: SystemHealthState;
}

export const REPOS_SELECT = [
  'id', 'github_url', 'owner', 'name', 'stars', 'language', 'topics',
  'grade', 'graded_at', 'followed', 'starred',
  'followed_at', 'follow_back', 'unfollowed', 'follow_skipped',
  'follow_skip_reason', 'created_at', 'reason', 'bio',
  'followers_count', 'following_count', 'account_created_at',
  'last_pushed_at', 'source',
].join(', ');

export async function fetchDashboardData(options?: { checkHealth?: boolean }): Promise<DashboardData> {
  const [
    userProfile,
    dbSettings,
    rateLimitRes,
    healthState,
    profilesData,
    logs,
    runSummary
  ] = await Promise.all([
    getUserProfile().catch(() => null),
    getSystemSettings().catch(() => null),
    getGitHubRateLimit().catch(() => ({ success: false, data: undefined as GitHubRateLimitData | undefined })),
    options?.checkHealth
      ? checkSystemHealth().catch((err: Error) => ({
          isGitHubValid: false,
          gitHubError: err.message || 'Health check error',
          gitHubUsername: null,
          isDbConnected: false,
          dbError: 'Could not connect to database',
          isWorkerOnline: false,
          workerError: 'Worker offline',
          lastChecked: new Date().toISOString(),
        }))
      : Promise.resolve(undefined),
    fetchAllRows<any>(supabase, 'profiles', '*').catch((err: any) => {
      console.error('Error fetching profiles data:', err.message || err);
      return [];
    }),
    Promise.resolve(
      supabase
        .from('logs')
        .select('id, action, owner, timestamp, status, message')
        .order('timestamp', { ascending: false })
        .limit(100)
    )
      .then(({ data, error }) => (!error && data ? (data as Log[]) : []))
      .catch((err: any) => {
        console.error('Error fetching logs details:', err?.message || err);
        return [];
      }),
    Promise.resolve(
      supabase
        .from('run_summary')
        .select('*')
        .order('ran_at', { ascending: false })
        .limit(50)
    )
      .then(({ data, error }) => (!error && data ? (data as RunSummary[]) : []))
      .catch((err: any) => {
        console.error('Error fetching run summary details:', err?.message || err);
        return [];
      }),
  ]);

  // Map profiles into canonical Repo format for dashboard components
  const enrichedRepos: Repo[] = (profilesData || []).map((p: any, idx: number) => {
    const topProject = Array.isArray(p.top_repos) && p.top_repos.length > 0 ? p.top_repos[0] : null;
    return {
      id: idx + 1,
      github_url: `https://github.com/${p.owner}`,
      owner: p.owner,
      name: topProject?.name || p.owner,
      stars: topProject?.stars || topProject?.stargazers_count || 0,
      language: (Array.isArray(p.languages) && p.languages[0]?.name) || (topProject?.language) || 'Code',
      topics: [],
      grade: p.grade ?? 0,
      graded_at: p.graded_at || p.created_at || new Date().toISOString(),
      followed: p.followed ?? false,
      starred: p.starred ?? false,
      followed_at: p.followed_at || null,
      follow_back: p.follow_back ?? false,
      unfollowed: p.unfollowed ?? false,
      follow_skipped: p.follow_skipped ?? false,
      follow_skip_reason: p.follow_skip_reason || null,
      created_at: p.created_at || null,
      updated_at: p.updated_at || null,
      reason: p.reason || null,
      bio: p.bio || null,
      display_name: p.display_name || null,
      followers_count: p.followers_count ?? null,
      following_count: p.following_count ?? null,
      account_created_at: p.account_created_at || null,
      last_pushed_at: p.last_pushed_at || null,
      source: p.found_by || null,
      top_repos: p.top_repos || null,
      languages: p.languages || null,
      whitelisted: p.whitelisted ?? false,
    };
  });

  return {
    repos: enrichedRepos,
    logs: logs || [],
    runSummary: runSummary || [],
    userProfile,
    settings: dbSettings,
    rateLimitData: rateLimitRes?.data,
    healthState,
  };
}
