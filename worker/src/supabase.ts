import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase URL or Anon Key. Database functions may fail.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: false,
  },
  realtime: {
    transport: ws as any,
  },
});

export async function isRepoGraded(repoId: number): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('repos')
      .select('id')
      .eq('id', repoId)
      .maybeSingle();

    if (error) {
      console.error(`Error checking if repo ${repoId} is graded:`, error.message);
      return false;
    }
    return data !== null;
  } catch (err: any) {
    console.error(`Failed to check if repo ${repoId} is graded:`, err.message || err);
    return false;
  }
}

export async function saveRepo(
  repo: {
    id: number;
    github_url: string;
    owner: string;
    name: string;
    stars: number;
    language: string | null;
    topics: string[];
    readme_snippet: string;
    grade: number;
  },
  followed: boolean,
  starred: boolean
) {
  try {
    const { error } = await supabase.from('repos').upsert({
      id: repo.id,
      github_url: repo.github_url,
      owner: repo.owner,
      name: repo.name,
      stars: repo.stars,
      language: repo.language,
      topics: repo.topics,
      readme_snippet: repo.readme_snippet,
      grade: repo.grade,
      graded_at: new Date().toISOString(),
      followed,
      starred,
    });

    if (error) {
      console.error(`Error saving repo ${repo.owner}/${repo.name}:`, error.message);
      throw error;
    }
  } catch (err: any) {
    console.error(`Failed to save repo ${repo.owner}/${repo.name}:`, err.message || err);
    throw err;
  }
}

export async function logAction(
  action: string,
  repoId: number | null,
  status: 'SUCCESS' | 'FAILED',
  message?: string
) {
  try {
    const { error } = await supabase.from('logs').insert({
      action,
      repo_id: repoId,
      status,
      message: message || null,
      timestamp: new Date().toISOString(),
    });

    if (error) {
      console.error(`Error inserting log [${action}]:`, error.message);
    }
  } catch (err: any) {
    console.error(`Failed to log action [${action}]:`, err.message || err);
  }
}
