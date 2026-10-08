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
  'id', 'owner', 'login', 'full_name', 'repo_name',
  'grade', 'followed', 'unfollowed', 'follow_back',
  'language', 'avatar_url', 'bio', 'reason',
  'followers_count', 'following_count',
  'stargazers_count', 'created_at', 'updated_at',
  'source', 'account_created_at', 'last_pushed_at',
].join(', ');

export async function fetchDashboardData(options?: { checkHealth?: boolean }): Promise<DashboardData> {
  const [userProfile, dbSettings, rateLimitRes, healthState] = await Promise.all([
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
  ]);

  let repos: Repo[] = [];
  try {
    repos = await fetchAllRows<Repo>(supabase, 'repos', REPOS_SELECT);
  } catch (reposError: unknown) {
    const msg = reposError instanceof Error ? reposError.message : String(reposError);
    console.error('Error fetching repos details:', msg);
  }

  let logs: Log[] = [];
  try {
    const { data: logsData, error: logsError } = await supabase
      .from('logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(500);
    if (!logsError && logsData) logs = logsData as Log[];
  } catch (logsErr: unknown) {
    const msg = logsErr instanceof Error ? logsErr.message : String(logsErr);
    console.error('Error fetching logs details:', msg);
  }

  let runSummary: RunSummary[] = [];
  try {
    const { data: summaryData, error: summaryError } = await supabase
      .from('run_summary')
      .select('*')
      .order('ran_at', { ascending: false });
    if (!summaryError && summaryData) runSummary = summaryData as RunSummary[];
  } catch (summaryErr: unknown) {
    const msg = summaryErr instanceof Error ? summaryErr.message : String(summaryErr);
    console.error('Error fetching run summary details:', msg);
  }

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
