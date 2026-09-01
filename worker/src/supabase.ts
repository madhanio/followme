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

export async function fetchAllRows<T = any>(
  table: string,
  selectQuery: string = '*',
  filterFn?: (query: any) => any,
  pageSize: number = 1000
): Promise<T[]> {
  const allRows: T[] = [];
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from(table).select(selectQuery).range(from, to);
    if (filterFn) {
      query = filterFn(query);
    }

    const { data, error } = await query;
    if (error) {
      console.error(`Error fetching rows from ${table} (range ${from}-${to}):`, error.message);
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    allRows.push(...(data as unknown as T[]));
    if (data.length < pageSize) {
      break;
    }

    page++;
  }

  return allRows;
}

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
  starred: boolean,
  followSkipped: boolean = false,
  followSkipReason: string | null = null
) {
  try {
    const actualStarred = followSkipped ? false : starred;
    const upsertData: any = {
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
      starred: actualStarred,
      follow_skipped: followSkipped,
      follow_skip_reason: followSkipReason,
    };

    if (followed) {
      upsertData.followed_at = new Date().toISOString();
    }

    // Check if repo already exists to preserve follow_back and unfollowed state
    const { data: existing } = await supabase
      .from('repos')
      .select('follow_back, unfollowed, followed_at')
      .eq('id', repo.id)
      .maybeSingle();

    if (existing) {
      if (existing.follow_back !== undefined) {
        upsertData.follow_back = existing.follow_back;
      }
      if (existing.unfollowed !== undefined && !followed) {
        upsertData.unfollowed = existing.unfollowed;
      }
      if (existing.followed_at && !upsertData.followed_at) {
        upsertData.followed_at = existing.followed_at;
      }
    }

    const { error } = await supabase.from('repos').upsert(upsertData, { onConflict: 'id' });

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
  status: 'SUCCESS' | 'FAILED' | 'ERROR' | 'WARN',
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

export interface SystemRuntimeConfig {
  maxProfilesPerRun: number;
  gradeThreshold: number;
  activeWorkingHours: string;
  dailyFollowLimit: number;
  unfollowGracePeriod: number;
  autoUnfollowNonMutuals: boolean;
  excludeOrgAccounts: boolean;
  systemPrompt: string;
  maxOwnerFollowers: number;
  minOwnerFollowing: number;
  maxOwnerAgeDays: number;
}

export const DEFAULT_RUNTIME_CONFIG: SystemRuntimeConfig = {
  maxProfilesPerRun: parseInt(process.env.MAX_PROFILES_PER_RUN || '50', 10),
  gradeThreshold: parseInt(process.env.GRADE_THRESHOLD || '7', 10),
  activeWorkingHours: '00:00 - 24:00',
  dailyFollowLimit: parseInt(process.env.DAILY_FOLLOW_LIMIT || '30', 10),
  unfollowGracePeriod: parseInt(process.env.UNFOLLOW_GRACE_PERIOD || '7', 10),
  autoUnfollowNonMutuals: true,
  excludeOrgAccounts: true,
  systemPrompt: 'Focus heavily on README quality, code architecture, commit frequency, and active open-source contribution patterns.',
  maxOwnerFollowers: parseInt(process.env.MAX_OWNER_FOLLOWERS || '500', 10),
  minOwnerFollowing: parseInt(process.env.MIN_OWNER_FOLLOWING || '10', 10),
  maxOwnerAgeDays: parseInt(process.env.MAX_OWNER_AGE_DAYS || '730', 10),
};

export async function fetchSystemSettings(): Promise<SystemRuntimeConfig> {
  try {
    const { data, error } = await supabase.from('settings').select('key, value');
    if (error || !data || data.length === 0) {
      if (error) console.warn('Could not fetch settings from DB, using fallback defaults:', error.message);
      return DEFAULT_RUNTIME_CONFIG;
    }

    const settingsMap: Record<string, any> = {};
    for (const row of data) {
      settingsMap[row.key] = row.value;
    }

    // Merge DB settings with defaults fallback
    return {
      maxProfilesPerRun: settingsMap.maxProfilesPerRun != null ? Number(settingsMap.maxProfilesPerRun) : DEFAULT_RUNTIME_CONFIG.maxProfilesPerRun,
      gradeThreshold: settingsMap.gradeThreshold != null ? Number(settingsMap.gradeThreshold) : DEFAULT_RUNTIME_CONFIG.gradeThreshold,
      activeWorkingHours: settingsMap.activeWorkingHours ?? DEFAULT_RUNTIME_CONFIG.activeWorkingHours,
      dailyFollowLimit: settingsMap.dailyFollowLimit != null ? Number(settingsMap.dailyFollowLimit) : DEFAULT_RUNTIME_CONFIG.dailyFollowLimit,
      unfollowGracePeriod: settingsMap.unfollowGracePeriod != null ? Number(settingsMap.unfollowGracePeriod) : DEFAULT_RUNTIME_CONFIG.unfollowGracePeriod,
      autoUnfollowNonMutuals: settingsMap.autoUnfollowNonMutuals != null ? Boolean(settingsMap.autoUnfollowNonMutuals) : DEFAULT_RUNTIME_CONFIG.autoUnfollowNonMutuals,
      excludeOrgAccounts: settingsMap.excludeOrgAccounts != null ? Boolean(settingsMap.excludeOrgAccounts) : DEFAULT_RUNTIME_CONFIG.excludeOrgAccounts,
      systemPrompt: settingsMap.systemPrompt ?? DEFAULT_RUNTIME_CONFIG.systemPrompt,
      maxOwnerFollowers: settingsMap.maxOwnerFollowers != null ? Number(settingsMap.maxOwnerFollowers) : DEFAULT_RUNTIME_CONFIG.maxOwnerFollowers,
      minOwnerFollowing: settingsMap.minOwnerFollowing != null ? Number(settingsMap.minOwnerFollowing) : DEFAULT_RUNTIME_CONFIG.minOwnerFollowing,
      maxOwnerAgeDays: settingsMap.maxOwnerAgeDays != null ? Number(settingsMap.maxOwnerAgeDays) : DEFAULT_RUNTIME_CONFIG.maxOwnerAgeDays,
    };
  } catch (err: any) {
    console.warn('Failed to fetch settings from Supabase:', err.message || err);
    return DEFAULT_RUNTIME_CONFIG;
  }
}
