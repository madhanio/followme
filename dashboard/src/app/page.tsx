import { supabase } from '@/lib/supabase';
import DashboardView from './DashboardView';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Simplify fetch to select all rows with no filters or ordering
  const { data: repos, error: reposError } = await supabase
    .from('repos')
    .select('*');

  console.log("Supabase Repos Fetch:", { dataCount: repos?.length, error: reposError });
  if (reposError) {
    console.error('Error fetching repos details:', reposError.message);
  }

  // Fetch recent logs
  const { data: logs, error: logsError } = await supabase
    .from('logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(50);

  console.log("Supabase Logs Fetch:", { dataCount: logs?.length, error: logsError });
  if (logsError) {
    console.error('Error fetching logs details:', logsError.message);
  }

  return (
    <DashboardView 
      initialRepos={repos || []} 
      initialLogs={logs || []} 
    />
  );
}
