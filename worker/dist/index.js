"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const github_1 = require("./github");
const nvidia_1 = require("./nvidia");
const supabase_1 = require("./supabase");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const PORT = process.env.PORT || 8000;
const WORKER_SECRET = process.env.WORKER_SECRET || 'dev_secret';
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const TOPICS = ['ai', 'machine-learning', 'llm', 'flutter', 'nodejs', 'python'];
let isJobRunning = false;
let lastRun = null;
let nextScheduledRunTime = null;
let consecutiveFailures = 0;
const SCHEDULER_INTERVAL_MINUTES = 60;
function updateNextRunTime() {
    const next = new Date(Date.now() + SCHEDULER_INTERVAL_MINUTES * 60 * 1000);
    nextScheduledRunTime = next.toISOString();
}
// Helper to determine if an error is recoverable (e.g. rate limit, timeout)
function isRecoverableError(err) {
    const msg = (err.message || String(err)).toLowerCase();
    return (msg.includes('rate limit') ||
        msg.includes('403') ||
        msg.includes('429') ||
        msg.includes('timeout') ||
        msg.includes('timed out') ||
        msg.includes('etimedout'));
}
// Helper to log fatal worker errors or warnings to database
async function logFatalErrorOrWarn(errorMessage, status) {
    // First, try inserting into 'worker_logs' as explicitly requested in instructions
    try {
        const { error } = await supabase_1.supabase.from('worker_logs').insert({
            action: 'SYSTEM',
            status: status,
            message: errorMessage,
            timestamp: new Date().toISOString(),
        });
        if (!error) {
            console.log(`Successfully logged fatal error/warn with status ${status} to worker_logs table.`);
            return;
        }
        console.warn('Failed to log to worker_logs table, trying logs table:', error.message);
    }
    catch (err) {
        console.warn('Error trying to write to worker_logs, trying logs table:', err.message || err);
    }
    // Fallback to the standard 'logs' table
    try {
        const { error } = await supabase_1.supabase.from('logs').insert({
            action: 'SYSTEM',
            status: status,
            message: errorMessage,
            timestamp: new Date().toISOString(),
        });
        if (error) {
            console.error('Error fallback logging to logs table:', error.message);
        }
        else {
            console.log(`Successfully logged fatal error/warn with status ${status} to logs table.`);
        }
    }
    catch (err) {
        console.error('Failed to log fatal error/warn to logs table:', err.message || err);
    }
}
async function runAutomationJob(isManual = false) {
    if (isJobRunning) {
        console.log('Job is already running. Skipping.');
        return { status: 'skipped', reason: 'already_running' };
    }
    isJobRunning = true;
    const stats = {
        discovered: 0,
        alreadyGraded: 0,
        graded: 0,
        followed: 0,
        starred: 0,
        skipped: 0,
        failed: 0,
    };
    try {
        console.log(`Starting FollowMe repository grading and automation job (${isManual ? 'Manual Run' : 'Scheduled Run'})...`);
        const config = await (0, supabase_1.fetchSystemSettings)();
        console.log(`Loaded runtime settings: maxProfilesPerRun=${config.maxProfilesPerRun}, gradeThreshold=${config.gradeThreshold}, activeWorkingHours=${config.activeWorkingHours}`);
        // Enforce active working hours check if defined (format: "HH:MM - HH:MM"), unless triggered manually by user
        if (!isManual && config.activeWorkingHours && config.activeWorkingHours !== '00:00 - 24:00') {
            const match = config.activeWorkingHours.match(/^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/);
            if (match) {
                const now = new Date();
                const currentMins = now.getHours() * 60 + now.getMinutes();
                const startMins = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
                const endMins = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
                const isInWindow = startMins <= endMins
                    ? (currentMins >= startMins && currentMins <= endMins)
                    : (currentMins >= startMins || currentMins <= endMins);
                if (!isInWindow) {
                    console.log(`Outside operating window (${config.activeWorkingHours}). Current time is ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}. Skipping scheduled run.`);
                    await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', `Skipped scheduled run — outside active operating window (${config.activeWorkingHours})`);
                    return { status: 'skipped', reason: 'outside_working_hours' };
                }
            }
        }
        await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', `Automation job started (${isManual ? 'Manual' : 'Scheduled'})`);
        const liveFollowingList = await (0, github_1.getGitHubFollowing)().catch(() => []);
        const liveFollowingSet = new Set(liveFollowingList.map(u => u.toLowerCase()));
        const repos = await (0, github_1.searchRecentRepos)(TOPICS);
        stats.discovered = repos.length;
        for (const repo of repos) {
            // 1. Check if already graded to avoid double calls / double grading
            const graded = await (0, supabase_1.isRepoGraded)(repo.id);
            if (graded) {
                stats.alreadyGraded++;
                continue;
            }
            console.log(`Processing candidate: ${repo.owner}/${repo.name}`);
            const ownerLower = repo.owner.toLowerCase();
            // Check if user is self
            if (GITHUB_USERNAME && ownerLower === GITHUB_USERNAME.toLowerCase()) {
                console.log(`Skipping profile ${repo.owner} — own repository.`);
                stats.skipped++;
                continue;
            }
            // Check if user is already followed on GitHub
            if (liveFollowingSet.has(ownerLower)) {
                console.log(`Skipping profile ${repo.owner} — already followed on GitHub. Skipping AI grading.`);
                stats.skipped++;
                continue;
            }
            // 2. Pre-filter owner profile eligibility BEFORE AI grading
            if (stats.followed >= config.maxProfilesPerRun) {
                console.log(`Follow limit of ${config.maxProfilesPerRun} reached for this run. Skipping ${repo.owner}.`);
                stats.skipped++;
                continue;
            }
            // Check if owner already exists in repos table with followed = true, follow_back = true, or unfollowed = true
            const { data: existingRecords } = await supabase_1.supabase
                .from('repos')
                .select('id, followed, follow_back, unfollowed')
                .ilike('owner', repo.owner.replace(/[_%]/g, '\\$&'))
                .limit(5);
            if (existingRecords && existingRecords.length > 0) {
                const isFollowedOrMutual = existingRecords.some(r => r.followed || r.follow_back);
                const isPreviouslyUnfollowed = existingRecords.some(r => r.unfollowed);
                if (isFollowedOrMutual) {
                    console.log(`Skipping profile ${repo.owner} — already followed or mutual in database. Skipping AI grading.`);
                    stats.skipped++;
                    continue;
                }
                if (isPreviouslyUnfollowed) {
                    console.log(`Skipping profile ${repo.owner} — previously unfollowed. Respecting grace period cooldown.`);
                    stats.skipped++;
                    continue;
                }
            }
            // Check owner profile targeting filters
            const profileCheck = await (0, github_1.checkOwnerProfile)(repo.owner, config);
            if (!profileCheck.shouldFollow) {
                console.log(`Skipping profile ${repo.owner} — targeting filter failed: ${profileCheck.skipReason}. Skipping AI grading.`);
                stats.skipped++;
                await (0, supabase_1.logAction)('SKIP_FOLLOW', repo.id, 'SUCCESS', `Skipped ${repo.owner} before grading: ${profileCheck.skipReason}`);
                continue;
            }
            // 3. Profile passed target filters — Now fetch README snippet & grade using NVIDIA NIM
            console.log(`Owner ${repo.owner} passed targeting filters. Proceeding to fetch README and grade repo ${repo.owner}/${repo.name}...`);
            const readme = await (0, github_1.fetchRepoReadme)(repo.owner, repo.name);
            repo.readme_snippet = readme;
            let grading;
            try {
                grading = await (0, nvidia_1.gradeRepository)(repo, config.systemPrompt);
                stats.graded++;
            }
            catch (aiErr) {
                if (aiErr instanceof nvidia_1.FatalAiQuotaError || (0, nvidia_1.isAiQuotaOrAuthError)(aiErr)) {
                    const loudMsg = `AI evaluation paused: ${aiErr.message || 'API keys expired or quota exceeded'}. Continuing with unfollow cleanup and mutual sync.`;
                    console.warn(`\n================================================================`);
                    console.warn(`[AI EVALUATION NOTICE] ${loudMsg}`);
                    console.warn(`================================================================\n`);
                    await logFatalErrorOrWarn(loudMsg, 'ERROR');
                    await (0, supabase_1.logAction)('SYSTEM', repo.id, 'ERROR', loudMsg);
                    // Stop trying more repos this run to avoid spamming API, but proceed with cleanup & unfollows
                    break;
                }
                console.error(`Unexpected grading error for ${repo.owner}/${repo.name}:`, aiErr.message || aiErr);
                continue;
            }
            console.log(`Repo: ${repo.owner}/${repo.name} | Grade: ${grading.grade} | Reason: ${grading.reason}`);
            let followed = false;
            let starred = false;
            let starResult = null;
            let followResult = null;
            // 4. Follow user & Star repo if grade meets threshold
            if (grading.grade >= config.gradeThreshold) {
                // Star if under actions cap
                if (stats.starred < config.maxProfilesPerRun) {
                    console.log(`Repo ${repo.owner}/${repo.name} meets threshold (${grading.grade} >= ${config.gradeThreshold}). Starring...`);
                    const starSuccess = await (0, github_1.starRepo)(repo.owner, repo.name);
                    if (starSuccess) {
                        starred = true;
                        stats.starred++;
                        starResult = { success: true, message: `Starred repository ${repo.owner}/${repo.name}` };
                    }
                    else {
                        starResult = { success: false, message: `Failed to star repository ${repo.owner}/${repo.name}` };
                    }
                }
                // Follow user (profile already passed check)
                console.log(`Following user ${repo.owner}...`);
                const followSuccess = await (0, github_1.followUser)(repo.owner);
                if (followSuccess) {
                    followed = true;
                    stats.followed++;
                    followResult = { success: true, message: `Followed user ${repo.owner}` };
                }
                else {
                    followResult = { success: false, message: `Failed to follow user ${repo.owner}` };
                }
            }
            // 5. Save repository to database and log (persist both followed and skipped repos)
            if (followed || starred) {
                await (0, supabase_1.saveRepo)({
                    id: repo.id,
                    github_url: repo.github_url,
                    owner: repo.owner,
                    name: repo.name,
                    stars: repo.stars,
                    language: repo.language,
                    topics: repo.topics,
                    readme_snippet: repo.readme_snippet,
                    grade: grading.grade,
                }, followed, starred, false, null);
                if (starResult) {
                    await (0, supabase_1.logAction)('STAR', repo.id, starResult.success ? 'SUCCESS' : 'FAILED', starResult.message);
                }
                if (followResult) {
                    await (0, supabase_1.logAction)('FOLLOW', repo.id, followResult.success ? 'SUCCESS' : 'FAILED', followResult.message);
                }
                await (0, supabase_1.logAction)('GRADE', repo.id, 'SUCCESS', `Graded repo: ${repo.owner}/${repo.name}. Score: ${grading.grade}. Reason: ${grading.reason}`);
            }
            else {
                // Persist low-grade or non-actioned repo to database as follow_skipped: true
                await (0, supabase_1.saveRepo)({
                    id: repo.id,
                    github_url: repo.github_url,
                    owner: repo.owner,
                    name: repo.name,
                    stars: repo.stars,
                    language: repo.language,
                    topics: repo.topics,
                    readme_snippet: repo.readme_snippet,
                    grade: grading.grade,
                }, false, false, true, `Grade ${grading.grade} < ${config.gradeThreshold}: ${grading.reason}`);
                await (0, supabase_1.logAction)('GRADE', repo.id, 'SUCCESS', `Graded repo (skipped follow): ${repo.owner}/${repo.name}. Score: ${grading.grade}. Reason: ${grading.reason}`);
                console.log(`[Automation] Persisted skipped repo for ${repo.owner}/${repo.name} - grade below threshold. (Grade: ${grading.grade}, Reason: ${grading.reason})`);
            }
            // Sleep 1.5 seconds between repositories
            await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        console.log('FollowMe job completed successfully.', stats);
        await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', `Automation job finished. Graded ${stats.graded} new repos. Followed: ${stats.followed}, Starred: ${stats.starred}, Skipped: ${stats.skipped}`);
        // Write to run_summary at the end of the main evaluation job
        let mutualsCount = 0;
        try {
            const { count } = await supabase_1.supabase
                .from('repos')
                .select('*', { count: 'exact', head: true })
                .eq('follow_back', true);
            mutualsCount = count || 0;
        }
        catch (countErr) {
            console.warn('Failed to query mutuals count for run_summary:', countErr);
        }
        try {
            await supabase_1.supabase.from('run_summary').insert({
                profiles_followed: stats.followed,
                profiles_unfollowed: 0,
                repos_starred: stats.starred,
                mutuals_found: mutualsCount,
                profiles_skipped: stats.skipped,
                profiles_evaluated: stats.graded,
                run_type: 'evaluation'
            });
            console.log('Successfully recorded evaluation run to run_summary.');
        }
        catch (summaryErr) {
            console.error('Error inserting into run_summary:', summaryErr.message || summaryErr);
        }
        consecutiveFailures = 0; // Reset failure counter on success
        // Call cleanup at the end of every automation run
        try {
            await runCleanupJob(config);
        }
        catch (cleanupErr) {
            console.error('Error running cleanup job as part of automation:', cleanupErr.message || cleanupErr);
        }
        try {
            await cleanupNonFollowbacks(config);
        }
        catch (ratioErr) {
            console.error('Error running auto-unfollow ratio cleanup:', ratioErr.message || ratioErr);
        }
        try {
            await syncMutuals();
        }
        catch (syncErr) {
            console.error('Error running mutuals sync:', syncErr.message || syncErr);
        }
    }
    catch (err) {
        stats.failed++;
        consecutiveFailures++;
        console.error('Fatal error during automated run:', err.message || err);
        const isRecoverable = isRecoverableError(err);
        if (isRecoverable && consecutiveFailures < 3) {
            console.warn(`Recoverable error encountered (${consecutiveFailures}/3). Scheduling retry in 30 minutes.`);
            await logFatalErrorOrWarn(`Automation job warning (retry scheduled): ${err.message || 'Unknown error'}`, 'WARN');
            setTimeout(() => {
                console.log('Triggering automated self-healing retry...');
                runAutomationJob().catch(console.error);
            }, 30 * 60 * 1000);
        }
        else {
            console.error(`Fatal error or max retries reached (${consecutiveFailures}/3). logging error.`);
            await logFatalErrorOrWarn(`Automation job failed: ${err.message || 'Unknown error'}`, 'ERROR');
        }
    }
    finally {
        lastRun = new Date().toISOString();
        isJobRunning = false;
    }
    return { status: 'completed', stats };
}
// REST Endpoint to trigger manually
app.post('/run', async (req, res) => {
    const authHeader = req.headers['x-worker-secret'] || req.body?.secret;
    if (authHeader !== WORKER_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
    }
    if (isJobRunning) {
        return res.status(409).json({ error: 'Job is already running' });
    }
    // Run asynchronously so endpoint doesn't timeout (with isManual = true to bypass schedule hours)
    runAutomationJob(true).catch(console.error);
    return res.json({ message: 'Automation job triggered successfully.' });
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', jobRunning: isJobRunning });
});
// GET /status
app.get('/status', async (req, res) => {
    const stats = await (0, github_1.getAuthenticatedUserStats)();
    res.json({
        nextRun: nextScheduledRunTime,
        lastRun,
        isJobRunning,
        consecutiveFailures,
        following: stats ? stats.following : null,
        followers: stats ? stats.followers : null,
        ratio: stats ? stats.ratio : null,
    });
});
// POST /cleanup
app.post('/cleanup', async (req, res) => {
    const authHeader = req.headers['x-worker-secret'] || req.body?.secret;
    if (authHeader !== WORKER_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
    }
    runCleanupJob().catch(console.error);
    return res.json({ message: 'Cleanup job triggered successfully.' });
});
// POST /sync-mutuals
app.post('/sync-mutuals', async (req, res) => {
    const authHeader = req.headers['x-worker-secret'] || req.body?.secret;
    if (authHeader !== WORKER_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
    }
    syncMutuals().catch(console.error);
    return res.json({ message: 'Mutuals sync triggered successfully.' });
});
// POST /cleanlogs
app.post('/cleanlogs', async (req, res) => {
    const authHeader = req.headers['x-worker-secret'] || req.body?.secret;
    if (authHeader !== WORKER_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
    }
    try {
        const { data: allLogs, error: fetchErr } = await supabase_1.supabase
            .from('logs')
            .select('id')
            .order('timestamp', { ascending: false });
        if (fetchErr) {
            console.error('Error fetching logs for cleanup:', fetchErr.message);
            return res.status(500).json({ success: false, error: fetchErr.message });
        }
        if (allLogs && allLogs.length > 200) {
            const idsToDelete = allLogs.slice(200).map(row => row.id);
            // Chunk deletions by 200 to prevent HTTP 414 URI Too Long errors
            for (let i = 0; i < idsToDelete.length; i += 200) {
                const chunk = idsToDelete.slice(i, i + 200);
                const { error: delErr } = await supabase_1.supabase
                    .from('logs')
                    .delete()
                    .in('id', chunk);
                if (delErr) {
                    console.error('Error deleting old logs chunk:', delErr.message);
                    return res.status(500).json({ success: false, error: delErr.message });
                }
            }
            await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', `Cleaned up logs. Deleted ${idsToDelete.length} old log entries.`);
            return res.json({ success: true, message: `Successfully deleted ${idsToDelete.length} old log entries, keeping the latest 200.` });
        }
        else {
            return res.json({ success: true, message: 'Logs table has 200 or fewer entries. No deletion required.' });
        }
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Error occurred during log cleanup' });
    }
});
// POST /clearstale
app.post('/clearstale', async (req, res) => {
    const authHeader = req.headers['x-worker-secret'] || req.body?.secret;
    if (authHeader !== WORKER_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
    }
    try {
        const { data, error } = await supabase_1.supabase
            .from('repos')
            .delete()
            .eq('followed', false)
            .eq('starred', false)
            .eq('unfollowed', false)
            .eq('follow_back', false)
            .eq('follow_skipped', true)
            .select('id');
        if (error) {
            console.error('Error clearing stale profiles:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
        const count = data ? data.length : 0;
        await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', `Cleared ${count} stale profiles.`);
        return res.json({ success: true, message: `Successfully cleared ${count} stale profiles.` });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Error occurred during stale profiles cleanup' });
    }
});
// POST /star
app.post('/star', async (req, res) => {
    const authHeader = req.headers['x-worker-secret'] || req.body?.secret;
    if (authHeader !== WORKER_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
    }
    const { owner, repo } = req.body;
    if (!owner || !repo) {
        return res.status(400).json({ error: 'Missing owner or repo parameter' });
    }
    try {
        const success = await (0, github_1.starRepo)(owner, repo);
        if (success) {
            const escapedOwner = owner.replace(/[_%]/g, '\\$&');
            const { data: dbRepo } = await supabase_1.supabase
                .from('repos')
                .select('id')
                .ilike('owner', escapedOwner)
                .eq('name', repo)
                .maybeSingle();
            const repoId = dbRepo ? dbRepo.id : null;
            const { error } = await supabase_1.supabase
                .from('repos')
                .update({ starred: true })
                .ilike('owner', escapedOwner)
                .eq('name', repo);
            if (error) {
                console.error(`Error updating DB after star for ${owner}/${repo}:`, error.message);
            }
            await (0, supabase_1.logAction)('STAR', repoId, 'SUCCESS', `Manually starred repository ${owner}/${repo}`);
            return res.json({ success: true, message: `Successfully starred ${owner}/${repo}` });
        }
        else {
            return res.status(500).json({ success: false, error: `Failed to star repository ${owner}/${repo}` });
        }
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Error manual starring' });
    }
});
// POST /deleteprofile
app.post('/deleteprofile', async (req, res) => {
    const authHeader = req.headers['x-worker-secret'] || req.body?.secret;
    if (authHeader !== WORKER_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
    }
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Missing username parameter' });
    }
    try {
        const escapedUsername = username.replace(/[_%]/g, '\\$&');
        const { data, error } = await supabase_1.supabase
            .from('repos')
            .delete()
            .ilike('owner', escapedUsername);
        if (error) {
            console.error(`Error deleting profile ${username}:`, error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
        await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', `Manually deleted profile and repositories for ${username}`);
        return res.json({ success: true, message: `Successfully deleted profile ${username}` });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Error manual deleting profile' });
    }
});
// POST /unstar
app.post('/unstar', async (req, res) => {
    const authHeader = req.headers['x-worker-secret'] || req.body?.secret;
    if (authHeader !== WORKER_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
    }
    const { owner, repo } = req.body;
    if (!owner || !repo) {
        return res.status(400).json({ error: 'Missing owner or repo parameter' });
    }
    try {
        const success = await (0, github_1.unstarRepo)(owner, repo);
        if (success) {
            const escapedOwner = owner.replace(/[_%]/g, '\\$&');
            const { data: dbRepo } = await supabase_1.supabase
                .from('repos')
                .select('id')
                .ilike('owner', escapedOwner)
                .eq('name', repo)
                .maybeSingle();
            const repoId = dbRepo ? dbRepo.id : null;
            const { error } = await supabase_1.supabase
                .from('repos')
                .update({ starred: false })
                .ilike('owner', escapedOwner)
                .eq('name', repo);
            if (error) {
                console.error(`Error updating DB after unstar for ${owner}/${repo}:`, error.message);
            }
            await (0, supabase_1.logAction)('UNSTAR', repoId, 'SUCCESS', `Manually unstarred repository ${owner}/${repo}`);
            return res.json({ success: true, message: `Successfully unstarred ${owner}/${repo}` });
        }
        else {
            return res.status(500).json({ success: false, error: `Failed to unstar repository ${owner}/${repo}` });
        }
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Error manual unstarring' });
    }
});
// POST /follow
app.post('/follow', async (req, res) => {
    const authHeader = req.headers['x-worker-secret'] || req.body?.secret;
    if (authHeader !== WORKER_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
    }
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Missing username parameter' });
    }
    try {
        const success = await (0, github_1.followUser)(username);
        if (success) {
            const escapedUsername = username.replace(/[_%]/g, '\\$&');
            const { data: dbRepo } = await supabase_1.supabase
                .from('repos')
                .select('id')
                .ilike('owner', escapedUsername)
                .limit(1)
                .maybeSingle();
            const repoId = dbRepo ? dbRepo.id : null;
            const { error } = await supabase_1.supabase
                .from('repos')
                .update({ followed: true, unfollowed: false, followed_at: new Date().toISOString() })
                .ilike('owner', escapedUsername);
            if (error) {
                console.error(`Error updating DB after follow for ${username}:`, error.message);
            }
            await (0, supabase_1.logAction)('FOLLOW', repoId, 'SUCCESS', `Manually followed user ${username}`);
            return res.json({ success: true, message: `Successfully followed ${username}` });
        }
        else {
            return res.status(500).json({ success: false, error: `Failed to follow user ${username}` });
        }
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Error manual following' });
    }
});
// POST /unfollow
app.post('/unfollow', async (req, res) => {
    const authHeader = req.headers['x-worker-secret'] || req.body?.secret;
    if (authHeader !== WORKER_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
    }
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Missing username parameter' });
    }
    try {
        const success = await (0, github_1.unfollowUser)(username);
        if (success) {
            const escapedUsername = username.replace(/[_%]/g, '\\$&');
            const { data: dbRepo } = await supabase_1.supabase
                .from('repos')
                .select('id')
                .ilike('owner', escapedUsername)
                .limit(1)
                .maybeSingle();
            const repoId = dbRepo ? dbRepo.id : null;
            const { error } = await supabase_1.supabase
                .from('repos')
                .update({ followed: false, unfollowed: true })
                .ilike('owner', escapedUsername);
            if (error) {
                console.error(`Error updating DB after unfollow for ${username}:`, error.message);
            }
            await (0, supabase_1.logAction)('UNFOLLOW', repoId, 'SUCCESS', `Manually unfollowed user ${username}`);
            return res.json({ success: true, message: `Successfully unfollowed ${username}` });
        }
        else {
            return res.status(500).json({ success: false, error: `Failed to unfollow user ${username}` });
        }
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Error manual unfollowing' });
    }
});
/**
 * Syncs follow_back status in Supabase by comparing our followed profiles
 * against the live list of users who follow us back on GitHub.
 * Sets follow_back=true for matches, follow_back=false for non-matches.
 */
async function syncMutuals() {
    console.log('Starting mutuals sync (syncMutuals)...');
    try {
        // 1. Fetch all GitHub followers with details (paginated)
        const followers = await (0, github_1.getGitHubFollowersDetails)();
        const followerSet = new Set(followers.map(u => u.login.toLowerCase()));
        console.log(`Fetched ${followers.length} GitHub followers for mutuals sync.`);
        // 2. Fetch all profiles in Supabase repos table (paginated)
        const allProfiles = await (0, supabase_1.fetchAllRows)('repos', 'id, owner');
        const dbOwnerSet = new Set();
        (allProfiles || []).forEach(p => dbOwnerSet.add(p.owner.toLowerCase()));
        // 3. Separate into mutual (follows back) vs non-mutual
        const mutualOwners = [];
        const nonMutualOwners = [];
        for (const profile of (allProfiles || [])) {
            if (followerSet.has(profile.owner.toLowerCase())) {
                mutualOwners.push(profile.owner);
            }
            else {
                nonMutualOwners.push(profile.owner);
            }
        }
        // 4. Batch update follow_back = true for mutual owners (chunked by 200)
        for (let i = 0; i < mutualOwners.length; i += 200) {
            const chunk = mutualOwners.slice(i, i + 200);
            const { error: mutualErr } = await supabase_1.supabase
                .from('repos')
                .update({ follow_back: true })
                .in('owner', chunk);
            if (mutualErr) {
                console.error('Error updating follow_back=true for mutuals chunk:', mutualErr.message);
            }
        }
        // 5. Batch update follow_back = false for non-mutual owners (chunked by 200)
        for (let i = 0; i < nonMutualOwners.length; i += 200) {
            const chunk = nonMutualOwners.slice(i, i + 200);
            const { error: nonMutualErr } = await supabase_1.supabase
                .from('repos')
                .update({ follow_back: false })
                .in('owner', chunk);
            if (nonMutualErr) {
                console.error('Error updating follow_back=false for non-mutuals chunk:', nonMutualErr.message);
            }
        }
        // 6. Discover missing organic/inbound followers and insert them
        const missingInboundRows = [];
        for (const follower of followers) {
            if (!dbOwnerSet.has(follower.login.toLowerCase())) {
                missingInboundRows.push({
                    id: 1000000000000 + follower.id,
                    github_url: follower.html_url || `https://github.com/${follower.login}`,
                    owner: follower.login,
                    name: `${follower.login}`,
                    stars: 0,
                    language: 'Profile',
                    topics: [],
                    grade: 5,
                    graded_at: new Date().toISOString(),
                    followed: false,
                    starred: false,
                    followed_at: null,
                    follow_back: true,
                    unfollowed: false,
                    follow_skipped: false,
                });
            }
        }
        if (missingInboundRows.length > 0) {
            for (let i = 0; i < missingInboundRows.length; i += 200) {
                const chunk = missingInboundRows.slice(i, i + 200);
                await supabase_1.supabase
                    .from('repos')
                    .upsert(chunk, { onConflict: 'id' });
            }
            console.log(`Inserted ${missingInboundRows.length} missing inbound followers into repos.`);
        }
        await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', `Mutuals sync complete. Mutuals: ${mutualOwners.length}, Inbound added: ${missingInboundRows.length}`);
        console.log('Mutuals sync completed successfully.');
    }
    catch (err) {
        console.error('Error in syncMutuals:', err.message || err);
        await (0, supabase_1.logAction)('SYSTEM', null, 'FAILED', `syncMutuals failed: ${err.message || 'Unknown error'}`);
    }
}
async function cleanupNonFollowbacks(runtimeConfig) {
    console.log('Starting FollowMe auto-unfollow ratio cleanup (cleanupNonFollowbacks)...');
    let unfollowedRatioCount = 0;
    try {
        const config = runtimeConfig || (await (0, supabase_1.fetchSystemSettings)());
        if (config.autoUnfollowNonMutuals === false) {
            console.log('Auto unfollow non-mutuals is disabled in system settings. Skipping ratio cleanup.');
            return;
        }
        const following = await (0, github_1.getGitHubFollowing)();
        const followers = await (0, github_1.getGitHubFollowers)();
        const followingCount = following.length;
        const followersCount = followers.length;
        console.log(`Live counts — Following: ${followingCount}, Followers: ${followersCount}`);
        if (followingCount <= followersCount * 2) {
            console.log(`Ratio is healthy (${followingCount} following <= ${followersCount} followers * 2). No cleanup needed.`);
            return;
        }
        console.log(`Ratio unhealthy! following (${followingCount}) > followers (${followersCount}) * 2. Starting unfollow queue...`);
        // Find users I follow who do not follow me back
        const followerSet = new Set(followers.map(u => u.toLowerCase()));
        const nonFollowbacks = following.filter(user => !followerSet.has(user.toLowerCase()));
        if (nonFollowbacks.length === 0) {
            console.log('No non-followback users found to unfollow.');
            return;
        }
        // Fetch followed profiles from Supabase where we set followed = true
        const dbRepos = await (0, supabase_1.fetchAllRows)('repos', 'owner, followed_at', q => q.eq('followed', true));
        const followedAtMap = new Map();
        const isFollowedByBot = new Set();
        if (dbRepos) {
            for (const r of dbRepos) {
                isFollowedByBot.add(r.owner.toLowerCase());
                if (r.followed_at) {
                    followedAtMap.set(r.owner.toLowerCase(), new Date(r.followed_at).getTime());
                }
            }
        }
        // Dynamic grace period cutoff from settings
        const graceDays = config.unfollowGracePeriod && config.unfollowGracePeriod > 0 ? config.unfollowGracePeriod : 7;
        const gracePeriodCutoff = Date.now() - graceDays * 24 * 60 * 60 * 1000;
        // Filter: allow non-followers who are past the grace period AND were followed by the bot
        const eligibleUnfollows = nonFollowbacks.filter(user => {
            const lower = user.toLowerCase();
            // Shield accounts not followed by the bot (protect personal/manual follows)
            if (!isFollowedByBot.has(lower)) {
                return false;
            }
            const followedAt = followedAtMap.get(lower);
            if (followedAt !== undefined && followedAt > gracePeriodCutoff) {
                // Within grace period
                return false;
            }
            return true;
        });
        if (eligibleUnfollows.length === 0) {
            console.log(`All eligible non-followback users are within the ${graceDays}-day grace period. Skipping unfollow cleanup.`);
            return;
        }
        // Sort: oldest first (use followed_at if available, otherwise preserve API order)
        const apiIndexMap = new Map();
        following.forEach((user, idx) => {
            apiIndexMap.set(user.toLowerCase(), idx);
        });
        eligibleUnfollows.sort((a, b) => {
            const timeA = followedAtMap.get(a.toLowerCase());
            const timeB = followedAtMap.get(b.toLowerCase());
            if (timeA !== undefined && timeB !== undefined) {
                return timeA - timeB;
            }
            if (timeA !== undefined) {
                return -1;
            }
            if (timeB !== undefined) {
                return 1;
            }
            return (apiIndexMap.get(a.toLowerCase()) || 0) - (apiIndexMap.get(b.toLowerCase()) || 0);
        });
        console.log(`Sorted ${eligibleUnfollows.length} non-followers eligible for unfollow (grace period: ${graceDays} days).`);
        let currentFollowingCount = followingCount;
        const targetCount = Math.floor(followersCount * 1.3);
        for (const username of eligibleUnfollows) {
            if (currentFollowingCount <= targetCount) {
                console.log(`Reached target following count (${currentFollowingCount} <= ${targetCount}). Stopping ratio cleanup.`);
                break;
            }
            console.log(`Unfollowing ${username} to recover ratio...`);
            const success = await (0, github_1.unfollowUser)(username);
            if (success) {
                currentFollowingCount--;
                unfollowedRatioCount++;
                // Find repo ID if exists to log action properly
                const { data: dbRepo } = await supabase_1.supabase
                    .from('repos')
                    .select('id')
                    .ilike('owner', username)
                    .limit(1)
                    .maybeSingle();
                const repoId = dbRepo ? dbRepo.id : null;
                // Update database to unfollowed: true, followed: false
                await supabase_1.supabase
                    .from('repos')
                    .update({ followed: false, unfollowed: true })
                    .ilike('owner', username);
                await (0, supabase_1.logAction)('UNFOLLOW_RATIO', repoId, 'SUCCESS', `Auto-unfollowed ${username} to balance following/followers ratio.`);
            }
            else {
                console.error(`Failed to unfollow ${username} during ratio cleanup.`);
            }
            // 2.5 second delay between unfollow calls to avoid abuse detection
            await new Promise(resolve => setTimeout(resolve, 2500));
        }
        // Write a summary row for ratio cleanup
        // run_summary is append-only — never delete from this table.
        try {
            await supabase_1.supabase.from('run_summary').insert({
                run_type: 'cleanup',
                profiles_unfollowed: unfollowedRatioCount,
                profiles_followed: 0,
                repos_starred: 0,
                mutuals_found: 0,
                profiles_skipped: 0,
                profiles_evaluated: 0
            });
            console.log(`Recorded ratio cleanup run to run_summary (${unfollowedRatioCount} unfollowed).`);
        }
        catch (summaryErr) {
            console.error('Error inserting into run_summary for ratio cleanup:', summaryErr.message || summaryErr);
        }
    }
    catch (err) {
        console.error('Error in cleanupNonFollowbacks:', err.message || err);
        await (0, supabase_1.logAction)('SYSTEM', null, 'FAILED', `cleanupNonFollowbacks failed: ${err.message || 'Unknown error'}`);
    }
}
async function runCleanupJob(runtimeConfig) {
    console.log('Starting FollowMe cleanup job...');
    await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', 'Cleanup job started');
    let unfollowedCount = 0;
    try {
        const config = runtimeConfig || (await (0, supabase_1.fetchSystemSettings)());
        if (config.autoUnfollowNonMutuals === false) {
            console.log('Auto unfollow non-mutuals is disabled in system settings. Skipping cleanup.');
            await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', 'Cleanup job finished: autoUnfollowNonMutuals disabled');
            return;
        }
        const graceDays = config.unfollowGracePeriod && config.unfollowGracePeriod > 0 ? config.unfollowGracePeriod : 7;
        const cutoffDate = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000).toISOString();
        console.log(`Checking for non-mutual profiles followed before ${cutoffDate} (${graceDays}-day grace period)...`);
        const repos = await (0, supabase_1.fetchAllRows)('repos', '*', q => q
            .eq('follow_back', false)
            .eq('unfollowed', false)
            .eq('followed', true)
            .lt('followed_at', cutoffDate));
        if (!repos || repos.length === 0) {
            console.log(`No users found beyond the ${graceDays}-day grace period to unfollow.`);
            await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', 'Cleanup job finished: no actions needed');
            // Write a summary row for cleanup run even if 0 unfollowed
            try {
                await supabase_1.supabase.from('run_summary').insert({
                    run_type: 'cleanup',
                    profiles_unfollowed: 0,
                    profiles_followed: 0,
                    repos_starred: 0,
                    mutuals_found: 0,
                    profiles_skipped: 0,
                    profiles_evaluated: 0
                });
            }
            catch (sumErr) {
                console.error('Error logging empty cleanup run:', sumErr);
            }
            return;
        }
        // Deduplicate by owner to avoid calling GitHub unfollow multiple times for the same user
        const ownerToReposMap = new Map();
        for (const repo of repos) {
            const o = repo.owner.toLowerCase();
            if (!ownerToReposMap.has(o)) {
                ownerToReposMap.set(o, []);
            }
            ownerToReposMap.get(o).push(repo);
        }
        console.log(`Found ${ownerToReposMap.size} unique users past the ${graceDays}-day grace period to unfollow.`);
        for (const [, ownerRepos] of ownerToReposMap.entries()) {
            const primaryOwner = ownerRepos[0].owner;
            const primaryRepoId = ownerRepos[0].id;
            const allRepoIds = ownerRepos.map(r => r.id);
            // Unfollow on GitHub once per owner
            const unfollowedSuccess = await (0, github_1.unfollowUser)(primaryOwner);
            if (unfollowedSuccess) {
                unfollowedCount++;
                const { error: updateErr } = await supabase_1.supabase
                    .from('repos')
                    .update({ unfollowed: true, followed: false })
                    .in('id', allRepoIds);
                if (updateErr) {
                    console.error(`Error updating unfollowed status for ${primaryOwner}:`, updateErr.message);
                }
                else {
                    await (0, supabase_1.logAction)('UNFOLLOW', primaryRepoId, 'SUCCESS', `Unfollowed user ${primaryOwner} (no follow-back within ${graceDays} days)`);
                }
            }
            else {
                await (0, supabase_1.logAction)('UNFOLLOW', primaryRepoId, 'FAILED', `Failed to unfollow user ${primaryOwner}`);
            }
            // 2.5 second delay between checks
            await new Promise((resolve) => setTimeout(resolve, 2500));
        }
        console.log(`Cleanup job completed. Unfollowed ${unfollowedCount} accounts.`);
        await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', `Cleanup job completed successfully. Unfollowed: ${unfollowedCount}`);
        // Write a summary row for the cleanup run
        // run_summary is append-only — never delete from this table.
        try {
            await supabase_1.supabase.from('run_summary').insert({
                run_type: 'cleanup',
                profiles_unfollowed: unfollowedCount,
                profiles_followed: 0,
                repos_starred: 0,
                mutuals_found: 0,
                profiles_skipped: 0,
                profiles_evaluated: 0
            });
            console.log('Recorded cleanup run to run_summary.');
        }
        catch (summaryErr) {
            console.error('Error inserting into run_summary for cleanup:', summaryErr.message || summaryErr);
        }
        // Sync mutuals at the end of every cleanup run
        try {
            await syncMutuals();
        }
        catch (syncErr) {
            console.error('Error running mutuals sync after cleanup:', syncErr.message || syncErr);
        }
    }
    catch (err) {
        console.error('Error during cleanup job:', err.message || err);
        await (0, supabase_1.logAction)('SYSTEM', null, 'FAILED', `Cleanup job failed: ${err.message || 'Unknown error'}`);
    }
}
async function reconcileFollowing() {
    console.log('Starting following list reconciliation...');
    try {
        const actualFollowingList = await (0, github_1.getGitHubFollowing)();
        if (!actualFollowingList || actualFollowingList.length === 0) {
            console.warn('Reconciliation skipped: GitHub following list returned empty (possible rate limit or token issue).');
            return;
        }
        const actualFollowingSet = new Set(actualFollowingList.map(u => u.toLowerCase()));
        console.log(`Live following count from GitHub: ${actualFollowingList.length}`);
        // Fetch all profiles in Supabase (paginated)
        const allDbRepos = await (0, supabase_1.fetchAllRows)('repos', 'id, owner, followed, unfollowed');
        // Group repos by owner
        const reposByOwner = new Map();
        (allDbRepos || []).forEach(r => {
            const o = r.owner.toLowerCase();
            if (!reposByOwner.has(o))
                reposByOwner.set(o, []);
            reposByOwner.get(o).push(r);
        });
        const idsToMarkUnfollowed = [];
        const idsToRestoreFollowed = [];
        for (const [ownerLower, ownerRepos] of reposByOwner.entries()) {
            const isActuallyFollowed = actualFollowingSet.has(ownerLower);
            if (!isActuallyFollowed) {
                // If not followed on GitHub, mark any repo currently marked followed as unfollowed
                ownerRepos.forEach(r => {
                    if (r.followed)
                        idsToMarkUnfollowed.push(r.id);
                });
            }
            else {
                // If followed on GitHub, ensure the primary repo is marked followed
                const hasActiveFollow = ownerRepos.some(r => r.followed && !r.unfollowed);
                if (!hasActiveFollow) {
                    idsToRestoreFollowed.push(ownerRepos[0].id);
                }
            }
        }
        console.log(`Reconciliation: ${idsToMarkUnfollowed.length} to mark unfollowed, ${idsToRestoreFollowed.length} to restore to active followed.`);
        if (idsToMarkUnfollowed.length > 0) {
            for (let i = 0; i < idsToMarkUnfollowed.length; i += 200) {
                const chunk = idsToMarkUnfollowed.slice(i, i + 200);
                const { error: updateErr } = await supabase_1.supabase
                    .from('repos')
                    .update({ followed: false, unfollowed: true })
                    .in('id', chunk);
                if (updateErr) {
                    console.error('Error updating unfollowed during reconciliation chunk:', updateErr.message);
                }
            }
            console.log(`Successfully marked ${idsToMarkUnfollowed.length} profiles as unfollowed.`);
        }
        if (idsToRestoreFollowed.length > 0) {
            for (let i = 0; i < idsToRestoreFollowed.length; i += 200) {
                const chunk = idsToRestoreFollowed.slice(i, i + 200);
                const { error: restoreErr } = await supabase_1.supabase
                    .from('repos')
                    .update({ followed: true, unfollowed: false })
                    .in('id', chunk);
                if (restoreErr) {
                    console.error('Error restoring profiles during reconciliation chunk:', restoreErr.message);
                }
            }
            console.log(`Successfully restored ${idsToRestoreFollowed.length} profiles to followed = true, unfollowed = false.`);
        }
        await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', `Reconciliation complete. Live following: ${actualFollowingList.length}. Marked unfollowed: ${idsToMarkUnfollowed.length}, Restored active: ${idsToRestoreFollowed.length}`);
        console.log('Reconciliation complete.');
    }
    catch (err) {
        console.error('Error in reconcileFollowing:', err.message || err);
    }
}
// POST /reconcile
app.post('/reconcile', async (req, res) => {
    const authHeader = req.headers['x-worker-secret'] || req.body?.secret;
    if (authHeader !== WORKER_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
    }
    reconcileFollowing().catch(console.error);
    return res.json({ message: 'Reconciliation job triggered successfully.' });
});
// Start Server
app.listen(PORT, () => {
    console.log(`Worker service is running on port ${PORT}`);
    console.log('Worker runtime configuration initialized from Supabase / env defaults');
    // Run reconciliation once on deploy/startup
    reconcileFollowing().catch(err => {
        console.error('Failed to run startup reconciliation:', err);
    });
    // Initialize dynamic next run timestamp
    updateNextRunTime();
    // Autonomous background interval scheduler
    setInterval(async () => {
        console.log('Autonomous scheduler tick: starting periodic automation & cleanup cycle...');
        updateNextRunTime();
        try {
            await runAutomationJob(false);
            await runCleanupJob();
        }
        catch (schedErr) {
            console.error('Error during autonomous background cycle:', schedErr.message || schedErr);
        }
    }, SCHEDULER_INTERVAL_MINUTES * 60 * 1000);
});
// Global error handlers to prevent silent process crashes and log them
process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    try {
        await logFatalErrorOrWarn(`Uncaught Exception: ${error.message || error}`, 'ERROR');
    }
    catch (logErr) {
        console.error('Failed to log uncaught exception to database:', logErr);
    }
    process.exit(1);
});
process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    try {
        await logFatalErrorOrWarn(`Unhandled Rejection: ${reason?.message || reason || 'Unknown reason'}`, 'ERROR');
    }
    catch (logErr) {
        console.error('Failed to log unhandled rejection to database:', logErr);
    }
});
