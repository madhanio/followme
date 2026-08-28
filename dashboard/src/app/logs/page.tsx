import { supabase, fetchAllRows } from '@/lib/supabase';
import DashboardView from '../DashboardView';
import { getUserProfile, getSystemSettings } from '../actions';

export const dynamic = 'force-dynamic';

export default async function LogsPage() {
  const [userProfile, dbSettings] = await Promise.all([
    getUserProfile(),
    getSystemSettings()
  ]);

  // Paginated fetch to select all rows across 1000+ records
  let repos: any[] = [];
  try {
    repos = await fetchAllRows(supabase, 'repos', '*');
  } catch (reposError: any) {
    console.error('Error fetching repos for logs page:', reposError.message || reposError);
  }

  // Fetch recent logs
  const { data: logs, error: logsError } = await supabase
    .from('logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(500);

  if (logsError) {
    console.error('Error fetching logs for logs page:', logsError.message);
  }

  // Fetch run summaries
  const { data: runSummary, error: summaryError } = await supabase
    .from('run_summary')
    .select('*')
    .order('ran_at', { ascending: false });

  if (summaryError) {
    console.error('Error fetching run summary details for logs page:', summaryError.message);
  }

  return (
    <DashboardView 
      initialRepos={repos || []} 
      initialLogs={logs || []} 
      initialRunSummary={runSummary || []}
      initialUserProfile={userProfile}
      initialSettings={dbSettings || undefined}
      initialTab="logs"
    />
  );
}
