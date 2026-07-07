"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_cron_1 = __importDefault(require("node-cron"));
const dotenv_1 = __importDefault(require("dotenv"));
const cron_parser_1 = __importDefault(require("cron-parser"));
const github_1 = require("./github");
const nvidia_1 = require("./nvidia");
const supabase_1 = require("./supabase");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const PORT = process.env.PORT || 8000;
const WORKER_SECRET = process.env.WORKER_SECRET || 'dev_secret';
const GRADE_THRESHOLD = parseInt(process.env.GRADE_THRESHOLD || '7', 10);
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 */12 * * *'; // Default: every 12 hours
const TOPICS = ['ai', 'machine-learning', 'llm', 'flutter', 'nodejs', 'python'];
let isJobRunning = false;
let lastRun = null;
let consecutiveFailures = 0;
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
// Helper to parse and print next scheduled run time
function printNextScheduledTime() {
    try {
        const interval = cron_parser_1.default.parse(CRON_SCHEDULE);
        console.log(`Next scheduled run time: ${interval.next().toString()}`);
    }
    catch (err) {
        console.error('Error parsing cron schedule:', err.message || err);
    }
}
async function runAutomationJob() {
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
        console.log('Starting FollowMe repository grading and automation job...');
        await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', 'Automation job started');
        const repos = await (0, github_1.searchRecentRepos)(TOPICS);
        stats.discovered = repos.length;
        for (const repo of repos) {
            // 1. Check if already graded to avoid double calls / double grading
            const graded = await (0, supabase_1.isRepoGraded)(repo.id);
            if (graded) {
                stats.alreadyGraded++;
                continue;
            }
            console.log(`Processing repo: ${repo.owner}/${repo.name}`);
            // 2. Fetch README snippet
            const readme = await (0, github_1.fetchRepoReadme)(repo.owner, repo.name);
            repo.readme_snippet = readme;
            // 3. Grade using NVIDIA NIM
            const grading = await (0, nvidia_1.gradeRepository)(repo);
            stats.graded++;
            console.log(`Repo: ${repo.owner}/${repo.name} | Grade: ${grading.grade} | Reason: ${grading.reason}`);
            let followed = false;
            let starred = false;
            let starResult = null;
            let followResult = null;
            // 4. Auto star / follow if grade is above threshold
            let followSkipped = false;
            let followSkipReason = null;
            if (grading.grade >= GRADE_THRESHOLD) {
                console.log(`Repo ${repo.owner}/${repo.name} meets threshold (${grading.grade} >= ${GRADE_THRESHOLD}). Starring...`);
                // Always star a high-grade repo
                const starSuccess = await (0, github_1.starRepo)(repo.owner, repo.name);
                if (starSuccess) {
                    starred = true;
                    stats.starred++;
                    starResult = { success: true, message: `Starred repository ${repo.owner}/${repo.name}` };
                }
                else {
                    starResult = { success: false, message: `Failed to star repository ${repo.owner}/${repo.name}` };
                }
                // Check owner profile before following
                const profileCheck = await (0, github_1.checkOwnerProfile)(repo.owner);
                if (profileCheck.shouldFollow) {
                    console.log(`Owner ${repo.owner} passed targeting filters. Following...`);
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
                else {
                    followSkipped = true;
                    followSkipReason = profileCheck.skipReason;
                    stats.skipped++;
                    console.log(`Skipping follow for ${repo.owner} — reason: ${profileCheck.skipReason}`);
                }
            }
            // 5. Save repository to database and log if followed or starred
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
                }, followed, starred, followSkipped, followSkipReason);
                // 6. Log interactions after repo is successfully saved
                if (starResult) {
                    await (0, supabase_1.logAction)('STAR', repo.id, starResult.success ? 'SUCCESS' : 'FAILED', starResult.message);
                }
                if (followResult) {
                    await (0, supabase_1.logAction)('FOLLOW', repo.id, followResult.success ? 'SUCCESS' : 'FAILED', followResult.message);
                }
                if (followSkipped) {
                    await (0, supabase_1.logAction)('SKIP_FOLLOW', repo.id, 'SUCCESS', `Skipped follow for ${repo.owner}: ${followSkipReason}`);
                }
                await (0, supabase_1.logAction)('GRADE', repo.id, 'SUCCESS', `Graded repo: ${repo.owner}/${repo.name}. Score: ${grading.grade}. Reason: ${grading.reason}`);
            }
            else {
                console.log(`[Automation] Skipped database write for ${repo.owner}/${repo.name} - not followed and not starred. (Grade: ${grading.grade}, Reason: ${grading.reason})`);
            }
            // Sleep 1.5 seconds between repositories to be respectful to APIs and limit rates
            await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        console.log('FollowMe job completed successfully.', stats);
        await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', `Automation job finished. Graded ${stats.graded} new repos. Followed: ${stats.followed}, Starred: ${stats.starred}, Skipped: ${stats.skipped}`);
        consecutiveFailures = 0; // Reset failure counter on success
        // Call cleanup at the end of every automation run
        try {
            await runCleanupJob();
        }
        catch (cleanupErr) {
            console.error('Error running cleanup job as part of automation:', cleanupErr.message || cleanupErr);
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
    // Run asynchronously so endpoint doesn't timeout
    runAutomationJob().catch(console.error);
    return res.json({ message: 'Automation job triggered successfully.' });
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', jobRunning: isJobRunning });
});
// GET /status
app.get('/status', (req, res) => {
    let nextRunStr = null;
    try {
        const interval = cron_parser_1.default.parse(CRON_SCHEDULE);
        nextRunStr = interval.next().toString();
    }
    catch (err) {
        console.error('Error parsing cron schedule for status endpoint:', err);
    }
    res.json({
        nextRun: nextRunStr,
        lastRun,
        isJobRunning,
        consecutiveFailures,
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
            const { error: delErr } = await supabase_1.supabase
                .from('logs')
                .delete()
                .in('id', idsToDelete);
            if (delErr) {
                console.error('Error deleting old logs:', delErr.message);
                return res.status(500).json({ success: false, error: delErr.message });
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
            const { data: dbRepo } = await supabase_1.supabase
                .from('repos')
                .select('id')
                .eq('owner', owner)
                .eq('name', repo)
                .maybeSingle();
            const repoId = dbRepo ? dbRepo.id : null;
            const { error } = await supabase_1.supabase
                .from('repos')
                .update({ starred: true })
                .eq('owner', owner)
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
            // Find repo ID from owner/name
            const { data: dbRepo } = await supabase_1.supabase
                .from('repos')
                .select('id')
                .eq('owner', owner)
                .eq('name', repo)
                .maybeSingle();
            const repoId = dbRepo ? dbRepo.id : null;
            const { error } = await supabase_1.supabase
                .from('repos')
                .update({ starred: false })
                .eq('owner', owner)
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
            const { data: dbRepo } = await supabase_1.supabase
                .from('repos')
                .select('id')
                .eq('owner', username)
                .limit(1)
                .maybeSingle();
            const repoId = dbRepo ? dbRepo.id : null;
            const { error } = await supabase_1.supabase
                .from('repos')
                .update({ followed: true, unfollowed: false, followed_at: new Date().toISOString() })
                .eq('owner', username);
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
            // Find repo ID where owner = username
            const { data: dbRepo } = await supabase_1.supabase
                .from('repos')
                .select('id')
                .eq('owner', username)
                .limit(1)
                .maybeSingle();
            const repoId = dbRepo ? dbRepo.id : null;
            const { error } = await supabase_1.supabase
                .from('repos')
                .update({ followed: false, unfollowed: true })
                .eq('owner', username);
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
// Set up Cron schedule
node_cron_1.default.schedule(CRON_SCHEDULE, () => {
    console.log('Triggering automated cron job...');
    runAutomationJob().catch(console.error);
});
async function runCleanupJob() {
    console.log('Starting FollowMe cleanup job...');
    await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', 'Cleanup job started');
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: repos, error } = await supabase_1.supabase
            .from('repos')
            .select('id, owner, name')
            .eq('followed', true)
            .eq('unfollowed', false)
            .eq('follow_back', false)
            .lte('followed_at', sevenDaysAgo);
        if (error) {
            console.error('Error fetching repos for cleanup:', error.message);
            throw error;
        }
        if (!repos || repos.length === 0) {
            console.log('No users found to check for follow-back cleanup.');
            await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', 'Cleanup job finished: no actions needed');
            return;
        }
        console.log(`Found ${repos.length} users to check for follow-back status.`);
        for (const repo of repos) {
            const followsBack = await (0, github_1.checkIfFollowsBack)(repo.owner);
            if (followsBack) {
                // Update database
                const { error: updateErr } = await supabase_1.supabase
                    .from('repos')
                    .update({ follow_back: true })
                    .eq('id', repo.id);
                if (updateErr) {
                    console.error(`Error updating follow_back for ${repo.owner}:`, updateErr.message);
                }
                else {
                    await (0, supabase_1.logAction)('FOLLOW_BACK', repo.id, 'SUCCESS', `Confirmed user ${repo.owner} followed back`);
                }
            }
            else {
                // Unfollow
                const unfollowedSuccess = await (0, github_1.unfollowUser)(repo.owner);
                if (unfollowedSuccess) {
                    const { error: updateErr } = await supabase_1.supabase
                        .from('repos')
                        .update({ unfollowed: true, followed: false })
                        .eq('id', repo.id);
                    if (updateErr) {
                        console.error(`Error updating unfollowed status for ${repo.owner}:`, updateErr.message);
                    }
                    else {
                        await (0, supabase_1.logAction)('UNFOLLOW', repo.id, 'SUCCESS', `Unfollowed user ${repo.owner} (no follow-back within 7 days)`);
                    }
                }
                else {
                    await (0, supabase_1.logAction)('UNFOLLOW', repo.id, 'FAILED', `Failed to unfollow user ${repo.owner}`);
                }
            }
            // Small delay between checks
            await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        console.log('Cleanup job completed.');
        await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', `Cleanup job completed successfully.`);
    }
    catch (err) {
        console.error('Error during cleanup job:', err.message || err);
        await (0, supabase_1.logAction)('SYSTEM', null, 'FAILED', `Cleanup job failed: ${err.message || 'Unknown error'}`);
    }
}
// Start Server
app.listen(PORT, () => {
    console.log(`Worker service is running on port ${PORT}`);
    console.log(`Cron schedule active: ${CRON_SCHEDULE}`);
    printNextScheduledTime();
    console.log(`Grade threshold set to: ${GRADE_THRESHOLD}`);
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
