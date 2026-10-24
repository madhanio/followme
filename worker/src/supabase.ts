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

export async function isProfileGraded(owner: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, updated_at, grade')
      .ilike('owner', owner.replace(/[_%]/g, '\\$&'))
      .maybeSingle();

    if (error) {
      console.error(`Error checking if profile ${owner} is graded:`, error.message);
      return false;
    }
    if (!data) return false;

    // 7-day cooldown threshold: if updated in last 7 days, consider already evaluated
    if (data.updated_at) {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (new Date(data.updated_at).getTime() >= sevenDaysAgo) {
        return true;
      }
    }
    return false;
  } catch (err: any) {
    console.error(`Failed to check if profile ${owner} is graded:`, err.message || err);
    return false;
  }
}

export async function saveProfile(
  candidate: {
    owner: string;
    display_name?: string | null;
    avatar_url?: string | null;
    bio?: string | null;
    followers_count?: number | null;
    following_count?: number | null;
    public_repos_count?: number | null;
    account_created_at?: string | null;
    account_age_years?: number | null;
    last_pushed_at?: string | null;
    top_repos?: any[];
    languages?: any[];
    found_by?: string | null;
    grade?: number;
    reason?: string | null;
    whitelisted?: boolean;
    ai_evaluation?: any;
  },
  followed: boolean,
  followSkipped: boolean = false,
  followSkipReason: string | null = null
) {
  try {
    const upsertData: any = {
      owner: candidate.owner,
      display_name: candidate.display_name ?? null,
      avatar_url: candidate.avatar_url ?? `https://github.com/${candidate.owner}.png`,
      bio: candidate.bio ?? null,
      followers_count: candidate.followers_count ?? 0,
      following_count: candidate.following_count ?? 0,
      public_repos_count: candidate.public_repos_count ?? 0,
      account_created_at: candidate.account_created_at ?? null,
      account_age_years: candidate.account_age_years ?? null,
      last_pushed_at: candidate.last_pushed_at ?? null,
      top_repos: candidate.top_repos ?? [],
      languages: candidate.languages ?? [],
      found_by: candidate.found_by ?? 'GitHub topic & open-source discovery',
      grade: candidate.grade ?? 0,
            followed,
      follow_skipped: followSkipped,
      follow_skip_reason: followSkipReason,
      reason: candidate.reason ?? (followSkipped ? followSkipReason : null),
      ai_evaluation: candidate.ai_evaluation ?? null,
      updated_at: new Date().toISOString(),
    };

    if (followed) {
      upsertData.followed_at = new Date().toISOString();
      upsertData.unfollowed = false;
    }

    if (candidate.whitelisted !== undefined) {
      upsertData.whitelisted = candidate.whitelisted;
    }

    // Preserve existing follow_back, unfollowed, whitelisted state
    const { data: existing } = await supabase
      .from('profiles')
      .select('follow_back, unfollowed, followed_at, whitelisted')
      .ilike('owner', candidate.owner.replace(/[_%]/g, '\\$&'))
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
      if (existing.whitelisted !== undefined && candidate.whitelisted === undefined) {
        upsertData.whitelisted = existing.whitelisted;
      }
    }

    const { error } = await supabase.from('profiles').upsert(upsertData, { onConflict: 'owner' });

    if (error) {
      console.error(`Error saving profile @${candidate.owner}:`, error.message);
      throw error;
    }
  } catch (err: any) {
    console.error(`Failed to save profile @${candidate.owner}:`, err.message || err);
    throw err;
  }
}

export async function logAction(
  action: string,
  owner: string | null,
  status: 'SUCCESS' | 'FAILED' | 'ERROR' | 'WARN',
  message?: string
) {
  try {
    const { error } = await supabase.from('logs').insert({
      action,
      owner,
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
  is_paused?: boolean;
  excludeOrgAccounts: boolean;
  systemPrompt: string;
  maxOwnerFollowers: number;
  minOwnerFollowing: number;
  maxOwnerAgeDays: number;
  recipientEmail?: string;
  resendApiKey?: string;
  githubToken?: string;
  fromDomain?: string;
}

export const DEFAULT_RUNTIME_CONFIG: SystemRuntimeConfig = {
  maxProfilesPerRun: parseInt(process.env.MAX_PROFILES_PER_RUN || '50', 10),
  gradeThreshold: parseInt(process.env.GRADE_THRESHOLD || '7', 10),
  activeWorkingHours: '00:00 - 24:00',
  dailyFollowLimit: parseInt(process.env.DAILY_FOLLOW_LIMIT || '30', 10),
  unfollowGracePeriod: parseInt(process.env.UNFOLLOW_GRACE_PERIOD || '7', 10),
  autoUnfollowNonMutuals: true,
  is_paused: false,
  excludeOrgAccounts: true,
  systemPrompt: 'Focus heavily on README quality, code architecture, commit frequency, and active open-source contribution patterns.',
  maxOwnerFollowers: parseInt(process.env.MAX_OWNER_FOLLOWERS || '500', 10),
  minOwnerFollowing: parseInt(process.env.MIN_OWNER_FOLLOWING || '10', 10),
  maxOwnerAgeDays: parseInt(process.env.MAX_OWNER_AGE_DAYS || '0', 10),
  recipientEmail: process.env.NOTIFICATION_EMAIL || process.env.RECIPIENT_EMAIL,
  resendApiKey: process.env.RESEND_API_KEY,
  githubToken: process.env.GITHUB_TOKEN,
  fromDomain: process.env.RESEND_FROM_DOMAIN,
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
      is_paused: Boolean(settingsMap.is_paused || settingsMap.isPaused || false),
      excludeOrgAccounts: settingsMap.excludeOrgAccounts != null ? Boolean(settingsMap.excludeOrgAccounts) : DEFAULT_RUNTIME_CONFIG.excludeOrgAccounts,
      systemPrompt: settingsMap.systemPrompt ?? DEFAULT_RUNTIME_CONFIG.systemPrompt,
      maxOwnerFollowers: settingsMap.maxOwnerFollowers != null ? Number(settingsMap.maxOwnerFollowers) : DEFAULT_RUNTIME_CONFIG.maxOwnerFollowers,
      minOwnerFollowing: settingsMap.minOwnerFollowing != null ? Number(settingsMap.minOwnerFollowing) : DEFAULT_RUNTIME_CONFIG.minOwnerFollowing,
      maxOwnerAgeDays: settingsMap.maxOwnerAgeDays != null ? Number(settingsMap.maxOwnerAgeDays) : DEFAULT_RUNTIME_CONFIG.maxOwnerAgeDays,
      recipientEmail: settingsMap.recipientEmail || DEFAULT_RUNTIME_CONFIG.recipientEmail,
      resendApiKey: settingsMap.resend_api_key || settingsMap.resendApiKey || DEFAULT_RUNTIME_CONFIG.resendApiKey,
      githubToken: settingsMap.github_token || DEFAULT_RUNTIME_CONFIG.githubToken,
      fromDomain: settingsMap.fromDomain || DEFAULT_RUNTIME_CONFIG.fromDomain,
    };
  } catch (err: any) {
    console.warn('Failed to fetch settings from Supabase:', err.message || err);
    return DEFAULT_RUNTIME_CONFIG;
  }
}

export async function getFollowsTodayCount(): Promise<number> {
  try {
    // 24-hour rolling window cutoff & calendar day cutoff
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const todayDatePrefix = new Date().toISOString().split('T')[0];

    // Source of Truth 1: Live profiles marked followed within the last 24h
    const { data: profileFollows, error: pErr } = await supabase
      .from('profiles')
      .select('owner')
      .eq('followed', true)
      .gte('followed_at', twentyFourHoursAgo);

    const liveProfileCount = (profileFollows && !pErr) ? profileFollows.length : 0;

    // Source of Truth 2: Historical run_summary records
    const { data: runSummaryData, error: rErr } = await supabase
      .from('run_summary')
      .select('profiles_followed')
      .gte('ran_at', todayDatePrefix + 'T00:00:00.000Z');

    const summaryCount = (runSummaryData && !rErr)
      ? runSummaryData.reduce((acc, row) => acc + (row.profiles_followed || 0), 0)
      : 0;

    return Math.max(liveProfileCount, summaryCount);
  } catch (err) {
    console.error('Error fetching follows today count:', err);
    return 0;
  }
}
