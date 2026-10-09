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
  'follow_skip_reason', 'created_at', 'updated_at', 'reason', 'bio',
  'followers_count', 'following_count', 'account_created_at',
  'last_pushed_at', 'source',
].join(', ');

export async function fetchDashboardData(options?: { checkHealth?: boolean }): Promise<DashboardData> {
  const [
    userProfile,
    dbSettings,
    rateLimitRes,
    healthState,
    repos,
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
    fetchAllRows<Repo>(supabase, 'repos', REPOS_SELECT).catch((err: any) => {
      console.error('Error fetching repos details:', err.message || err);
      return [];
    }),
    Promise.resolve(
      supabase
        .from('logs')
        .select('id, action, repo_id, timestamp, status, message')
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

  return {
    repos: repos || [],
    logs: logs || [],
    runSummary: runSummary || [],
    userProfile,
    settings: dbSettings,
    rateLimitData: rateLimitRes?.data,
    healthState,
  };
}
