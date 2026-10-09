import { supabase, fetchAllRows } from '@/lib/supabase';
import DashboardView from './DashboardView';
import { getUserProfile, getSystemSettings, getGitHubRateLimit } from './actions';

export const dynamic = 'force-dynamic';

export default async function DashboardPage(props: { searchParams?: Promise<{ tab?: string }> }) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const initialTab = searchParams?.tab === 'stats' ? 'stats' : 'home';

  const [userProfile, dbSettings, rateLimitRes, healthState] = await Promise.all([
    getUserProfile().catch(() => null),
    getSystemSettings().catch(() => null),
    getGitHubRateLimit().catch(() => ({ success: false, data: undefined })),
    (async () => {
      try {
        const { checkSystemHealth } = await import('./actions');
        return await checkSystemHealth();
      } catch (err: any) {
        return {
          isGitHubValid: false,
          gitHubError: err.message || 'Health check error',
          gitHubUsername: null,
          isDbConnected: false,
          dbError: 'Could not connect to database',
          isWorkerOnline: false,
          workerError: 'Worker offline',
          lastChecked: new Date().toISOString(),
        };
      }
    })(),
  ]);

  // Paginated fetch to select all rows across 1000+ records
  const REPOS_SELECT = [
    'id', 'github_url', 'owner', 'name', 'stars', 'language', 'topics',
    'readme_snippet', 'grade', 'graded_at', 'followed', 'starred',
    'followed_at', 'follow_back', 'unfollowed', 'follow_skipped',
    'follow_skip_reason', 'created_at', 'reason', 'bio',
    'followers_count', 'following_count', 'account_created_at',
    'last_pushed_at', 'source',
  ].join(', ');

  let repos: any[] = [];
  try {
    repos = await fetchAllRows(supabase, 'repos', REPOS_SELECT);
  } catch (reposError: any) {
    console.error('Error fetching repos details:', reposError.message || reposError);
  }

  // Fetch recent logs
  let logs: any[] = [];
  try {
    const { data: logsData, error: logsError } = await supabase
      .from('logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(500);
    if (!logsError && logsData) logs = logsData;
  } catch (logsErr: any) {
    console.error('Error fetching logs details:', logsErr.message || logsErr);
  }

  // Fetch run summaries
  let runSummary: any[] = [];
  try {
    const { data: summaryData, error: summaryError } = await supabase
      .from('run_summary')
      .select('*')
      .order('ran_at', { ascending: false });
    if (!summaryError && summaryData) runSummary = summaryData;
  } catch (summaryErr: any) {
    console.error('Error fetching run summary details:', summaryErr.message || summaryErr);
  }

  return (
    <DashboardView 
      initialRepos={repos || []} 
      initialLogs={logs || []} 
      initialRunSummary={runSummary || []}
      initialUserProfile={userProfile}
      initialSettings={dbSettings || undefined}
      initialTab={initialTab}
      initialRateLimitData={rateLimitRes?.data || undefined}
      initialHealthState={healthState}
    />
  );
}
