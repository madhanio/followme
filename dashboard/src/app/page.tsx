import { supabase, fetchAllRows } from '@/lib/supabase';
import DashboardView from './DashboardView';
import { getUserProfile, getSystemSettings } from './actions';

export const dynamic = 'force-dynamic';

export default async function DashboardPage(props: { searchParams?: Promise<{ tab?: string }> }) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const initialTab = searchParams?.tab === 'stats' ? 'stats' : 'home';

  const [userProfile, dbSettings] = await Promise.all([
    getUserProfile(),
    getSystemSettings()
  ]);

  // Paginated fetch to select all rows across 1000+ records
  let repos: any[] = [];
  try {
    repos = await fetchAllRows(supabase, 'repos', '*');
    console.log("Supabase Repos Paginated Fetch:", { dataCount: repos.length });
  } catch (reposError: any) {
    console.error('Error fetching repos details:', reposError.message || reposError);
  }

  // Fetch recent logs
  const { data: logs, error: logsError } = await supabase
    .from('logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(500);

  console.log("Supabase Logs Fetch:", { dataCount: logs?.length, error: logsError });
  if (logsError) {
    console.error('Error fetching logs details:', logsError.message);
  }

  // Fetch run summaries
  const { data: runSummary, error: summaryError } = await supabase
    .from('run_summary')
    .select('*')
    .order('ran_at', { ascending: false });

  console.log("Supabase run_summary Fetch:", { dataCount: runSummary?.length, error: summaryError });
  if (summaryError) {
    console.error('Error fetching run summary details:', summaryError.message);
  }

  return (
    <DashboardView 
      initialRepos={repos || []} 
      initialLogs={logs || []} 
      initialRunSummary={runSummary || []}
      initialUserProfile={userProfile}
      initialSettings={dbSettings || undefined}
      initialTab={initialTab}
    />
  );
}
