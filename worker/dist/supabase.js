"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RUNTIME_CONFIG = exports.supabase = void 0;
exports.fetchAllRows = fetchAllRows;
exports.isProfileGraded = isProfileGraded;
exports.saveProfile = saveProfile;
exports.logAction = logAction;
exports.fetchSystemSettings = fetchSystemSettings;
exports.getFollowsTodayCount = getFollowsTodayCount;
const supabase_js_1 = require("@supabase/supabase-js");
const ws_1 = __importDefault(require("ws"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Missing Supabase URL or Anon Key. Database functions may fail.');
}
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        persistSession: false,
    },
    realtime: {
        transport: ws_1.default,
    },
});
async function fetchAllRows(table, selectQuery = '*', filterFn, pageSize = 1000) {
    const allRows = [];
    let page = 0;
    while (true) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        let query = exports.supabase.from(table).select(selectQuery).range(from, to);
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
        allRows.push(...data);
        if (data.length < pageSize) {
            break;
        }
        page++;
    }
    return allRows;
}
async function isProfileGraded(owner) {
    try {
        const { data, error } = await exports.supabase
            .from('profiles')
            .select('id, updated_at, grade')
            .ilike('owner', owner.replace(/[_%]/g, '\\$&'))
            .maybeSingle();
        if (error) {
            console.error(`Error checking if profile ${owner} is graded:`, error.message);
            return false;
        }
        if (!data)
            return false;
        // 7-day cooldown threshold: if updated in last 7 days, consider already evaluated
        if (data.updated_at) {
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            if (new Date(data.updated_at).getTime() >= sevenDaysAgo) {
                return true;
            }
        }
        return false;
    }
    catch (err) {
        console.error(`Failed to check if profile ${owner} is graded:`, err.message || err);
        return false;
    }
}
async function saveProfile(candidate, followed, followSkipped = false, followSkipReason = null) {
    try {
        const upsertData = {
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
        const { data: existing } = await exports.supabase
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
        const { error } = await exports.supabase.from('profiles').upsert(upsertData, { onConflict: 'owner' });
        if (error) {
            console.error(`Error saving profile @${candidate.owner}:`, error.message);
            throw error;
        }
    }
    catch (err) {
        console.error(`Failed to save profile @${candidate.owner}:`, err.message || err);
        throw err;
    }
}
async function logAction(action, owner, status, message) {
    try {
        const { error } = await exports.supabase.from('logs').insert({
            action,
            owner,
            status,
            message: message || null,
            timestamp: new Date().toISOString(),
        });
        if (error) {
            console.error(`Error inserting log [${action}]:`, error.message);
        }
    }
    catch (err) {
        console.error(`Failed to log action [${action}]:`, err.message || err);
    }
}
exports.DEFAULT_RUNTIME_CONFIG = {
    maxProfilesPerRun: parseInt(process.env.MAX_PROFILES_PER_RUN || '50', 10),
    gradeThreshold: parseInt(process.env.GRADE_THRESHOLD || '60', 10),
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
    cronFrequency: parseInt(process.env.CRON_FREQUENCY || '6', 10),
    recipientEmail: process.env.NOTIFICATION_EMAIL || process.env.RECIPIENT_EMAIL,
    resendApiKey: process.env.RESEND_API_KEY,
    githubToken: process.env.GITHUB_TOKEN,
    fromDomain: process.env.RESEND_FROM_DOMAIN,
};
async function fetchSystemSettings() {
    try {
        const { data, error } = await exports.supabase.from('settings').select('key, value');
        if (error || !data || data.length === 0) {
            if (error)
                console.warn('Could not fetch settings from DB, using fallback defaults:', error.message);
            return exports.DEFAULT_RUNTIME_CONFIG;
        }
        const settingsMap = {};
        for (const row of data) {
            settingsMap[row.key] = row.value;
        }
        // Merge DB settings with defaults fallback
        return {
            maxProfilesPerRun: settingsMap.maxProfilesPerRun != null ? Number(settingsMap.maxProfilesPerRun) : exports.DEFAULT_RUNTIME_CONFIG.maxProfilesPerRun,
            gradeThreshold: settingsMap.gradeThreshold != null ? Number(settingsMap.gradeThreshold) : exports.DEFAULT_RUNTIME_CONFIG.gradeThreshold,
            activeWorkingHours: settingsMap.activeWorkingHours ?? exports.DEFAULT_RUNTIME_CONFIG.activeWorkingHours,
            dailyFollowLimit: settingsMap.dailyFollowLimit != null ? Number(settingsMap.dailyFollowLimit) : exports.DEFAULT_RUNTIME_CONFIG.dailyFollowLimit,
            unfollowGracePeriod: settingsMap.unfollowGracePeriod != null ? Number(settingsMap.unfollowGracePeriod) : exports.DEFAULT_RUNTIME_CONFIG.unfollowGracePeriod,
            autoUnfollowNonMutuals: settingsMap.autoUnfollowNonMutuals != null ? Boolean(settingsMap.autoUnfollowNonMutuals) : exports.DEFAULT_RUNTIME_CONFIG.autoUnfollowNonMutuals,
            is_paused: Boolean(settingsMap.is_paused || settingsMap.isPaused || false),
            excludeOrgAccounts: settingsMap.excludeOrgAccounts != null ? Boolean(settingsMap.excludeOrgAccounts) : exports.DEFAULT_RUNTIME_CONFIG.excludeOrgAccounts,
            systemPrompt: settingsMap.systemPrompt ?? exports.DEFAULT_RUNTIME_CONFIG.systemPrompt,
            maxOwnerFollowers: settingsMap.maxOwnerFollowers != null ? Number(settingsMap.maxOwnerFollowers) : exports.DEFAULT_RUNTIME_CONFIG.maxOwnerFollowers,
            minOwnerFollowing: settingsMap.minOwnerFollowing != null ? Number(settingsMap.minOwnerFollowing) : exports.DEFAULT_RUNTIME_CONFIG.minOwnerFollowing,
            maxOwnerAgeDays: settingsMap.maxOwnerAgeDays != null ? Number(settingsMap.maxOwnerAgeDays) : exports.DEFAULT_RUNTIME_CONFIG.maxOwnerAgeDays,
            cronFrequency: settingsMap.cronFrequency != null ? Number(settingsMap.cronFrequency) : exports.DEFAULT_RUNTIME_CONFIG.cronFrequency,
            recipientEmail: settingsMap.recipientEmail || exports.DEFAULT_RUNTIME_CONFIG.recipientEmail,
            resendApiKey: settingsMap.resend_api_key || settingsMap.resendApiKey || exports.DEFAULT_RUNTIME_CONFIG.resendApiKey,
            githubToken: settingsMap.github_token || exports.DEFAULT_RUNTIME_CONFIG.githubToken,
            fromDomain: settingsMap.fromDomain || exports.DEFAULT_RUNTIME_CONFIG.fromDomain,
        };
    }
    catch (err) {
        console.warn('Failed to fetch settings from Supabase:', err.message || err);
        return exports.DEFAULT_RUNTIME_CONFIG;
    }
}
async function getFollowsTodayCount() {
    try {
        // Exact calendar day in UTC (from 00:00:00.000Z to now)
        const todayDatePrefix = new Date().toISOString().split('T')[0];
        const startOfTodayUtc = `${todayDatePrefix}T00:00:00.000Z`;
        // Count live profiles that were followed today
        const { data: profileFollows, error: pErr } = await exports.supabase
            .from('profiles')
            .select('owner')
            .eq('followed', true)
            .gte('followed_at', startOfTodayUtc);
        if (pErr) {
            console.error('Error fetching today profile follows:', pErr.message);
        }
        const todayFollowsCount = profileFollows ? profileFollows.length : 0;
        return todayFollowsCount;
    }
    catch (err) {
        console.error('Error fetching follows today count:', err);
        return 0;
    }
}
