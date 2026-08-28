"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RUNTIME_CONFIG = exports.supabase = void 0;
exports.fetchAllRows = fetchAllRows;
exports.isRepoGraded = isRepoGraded;
exports.saveRepo = saveRepo;
exports.logAction = logAction;
exports.fetchSystemSettings = fetchSystemSettings;
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
async function isRepoGraded(repoId) {
    try {
        const { data, error } = await exports.supabase
            .from('repos')
            .select('id')
            .eq('id', repoId)
            .maybeSingle();
        if (error) {
            console.error(`Error checking if repo ${repoId} is graded:`, error.message);
            return false;
        }
        return data !== null;
    }
    catch (err) {
        console.error(`Failed to check if repo ${repoId} is graded:`, err.message || err);
        return false;
    }
}
async function saveRepo(repo, followed, starred, followSkipped = false, followSkipReason = null) {
    try {
        const actualStarred = followSkipped ? false : starred;
        const upsertData = {
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
        const { error } = await exports.supabase.from('repos').upsert(upsertData);
        if (error) {
            console.error(`Error saving repo ${repo.owner}/${repo.name}:`, error.message);
            throw error;
        }
    }
    catch (err) {
        console.error(`Failed to save repo ${repo.owner}/${repo.name}:`, err.message || err);
        throw err;
    }
}
async function logAction(action, repoId, status, message) {
    try {
        const { error } = await exports.supabase.from('logs').insert({
            action,
            repo_id: repoId,
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
            excludeOrgAccounts: settingsMap.excludeOrgAccounts != null ? Boolean(settingsMap.excludeOrgAccounts) : exports.DEFAULT_RUNTIME_CONFIG.excludeOrgAccounts,
            systemPrompt: settingsMap.systemPrompt ?? exports.DEFAULT_RUNTIME_CONFIG.systemPrompt,
            maxOwnerFollowers: settingsMap.maxOwnerFollowers != null ? Number(settingsMap.maxOwnerFollowers) : exports.DEFAULT_RUNTIME_CONFIG.maxOwnerFollowers,
            minOwnerFollowing: settingsMap.minOwnerFollowing != null ? Number(settingsMap.minOwnerFollowing) : exports.DEFAULT_RUNTIME_CONFIG.minOwnerFollowing,
            maxOwnerAgeDays: settingsMap.maxOwnerAgeDays != null ? Number(settingsMap.maxOwnerAgeDays) : exports.DEFAULT_RUNTIME_CONFIG.maxOwnerAgeDays,
        };
    }
    catch (err) {
        console.warn('Failed to fetch settings from Supabase:', err.message || err);
        return exports.DEFAULT_RUNTIME_CONFIG;
    }
}
