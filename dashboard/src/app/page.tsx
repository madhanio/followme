import { supabase } from '@/lib/supabase';
import DashboardView from './DashboardView';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Fetch repos ordered by grade desc, then stars desc
  const { data: repos, error: reposError } = await supabase
    .from('repos')
    .select('*')
    .order('grade', { ascending: false })
    .order('stars', { ascending: false });

  if (reposError) {
    console.error('Error fetching repos:', reposError.message);
  }

  // Fetch recent logs
  const { data: logs, error: logsError } = await supabase
    .from('logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(50);

  if (logsError) {
    console.error('Error fetching logs:', logsError.message);
  }

  return (
    <DashboardView 
      initialRepos={repos || []} 
      initialLogs={logs || []} 
    />
  );
}
