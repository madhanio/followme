import { supabase, fetchAllRows } from '@/lib/supabase';
import DashboardView from './DashboardView';
import { getUserProfile, getSystemSettings, getGitHubRateLimit } from './actions';

export const dynamic = 'force-dynamic';

export default async function DashboardPage(props: { searchParams?: Promise<{ tab?: string }> }) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const initialTab = searchParams?.tab === 'stats' ? 'stats' : 'home';

  // Select only columns needed for initial dashboard rendering (excluding bulky readme snippets)
  const REPOS_SELECT = [
    'id', 'github_url', 'owner', 'name', 'stars', 'language', 'topics',
    'grade', 'graded_at', 'followed', 'starred',
    'followed_at', 'follow_back', 'unfollowed', 'follow_skipped',
    'follow_skip_reason', 'created_at', 'updated_at', 'reason', 'bio',
    'followers_count', 'following_count', 'account_created_at',
    'last_pushed_at', 'source',
  ].join(', ');

  // Fetch all core datasets simultaneously in parallel rather than serial sequential queries
  const [
    userProfile,
    dbSettings,
    rateLimitRes,
    repos,
    logs,
    runSummary
  ] = await Promise.all([
    getUserProfile().catch(() => null),
    getSystemSettings().catch(() => null),
    getGitHubRateLimit().catch(() => ({ success: false, data: undefined })),
    fetchAllRows(supabase, 'repos', REPOS_SELECT).catch((err: any) => {
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
      .then(({ data, error }) => (!error && data ? data : []))
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
      .then(({ data, error }) => (!error && data ? data : []))
      .catch((err: any) => {
        console.error('Error fetching run summary details:', err?.message || err);
        return [];
      }),
  ]);

  return (
    <DashboardView 
      initialRepos={repos || []} 
      initialLogs={logs || []} 
      initialRunSummary={runSummary || []}
      initialUserProfile={userProfile}
      initialSettings={dbSettings || undefined}
      initialTab={initialTab}
      initialRateLimitData={rateLimitRes?.data || undefined}
      initialHealthState={null}
    />
  );
}
