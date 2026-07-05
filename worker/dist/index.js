"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_cron_1 = __importDefault(require("node-cron"));
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
const GRADE_THRESHOLD = parseInt(process.env.GRADE_THRESHOLD || '7', 10);
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 */12 * * *'; // Default: every 12 hours
const TOPICS = ['ai', 'machine-learning', 'llm', 'flutter', 'nodejs', 'python'];
let isJobRunning = false;
async function runAutomationJob() {
    if (isJobRunning) {
        console.log('Job is already running. Skipping.');
        return { status: 'skipped', reason: 'already_running' };
    }
    isJobRunning = true;
    console.log('Starting FollowMe repository grading and automation job...');
    await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', 'Automation job started');
    const stats = {
        discovered: 0,
        alreadyGraded: 0,
        graded: 0,
        followed: 0,
        starred: 0,
        failed: 0,
    };
    try {
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
            // 4. Auto follow / star if grade is above or equal to threshold
            if (grading.grade >= GRADE_THRESHOLD) {
                console.log(`Repo ${repo.owner}/${repo.name} meets threshold (${grading.grade} >= ${GRADE_THRESHOLD}). Starring and following...`);
                // Star repo
                const starSuccess = await (0, github_1.starRepo)(repo.owner, repo.name);
                if (starSuccess) {
                    starred = true;
                    stats.starred++;
                    starResult = { success: true, message: `Starred repository ${repo.owner}/${repo.name}` };
                }
                else {
                    starResult = { success: false, message: `Failed to star repository ${repo.owner}/${repo.name}` };
                }
                // Follow owner
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
            // 5. Save repository to database (must happen before logging actions to avoid FK constraint error)
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
            }, followed, starred);
            // 6. Log interactions after repo is successfully saved
            if (starResult) {
                await (0, supabase_1.logAction)('STAR', repo.id, starResult.success ? 'SUCCESS' : 'FAILED', starResult.message);
            }
            if (followResult) {
                await (0, supabase_1.logAction)('FOLLOW', repo.id, followResult.success ? 'SUCCESS' : 'FAILED', followResult.message);
            }
            await (0, supabase_1.logAction)('GRADE', repo.id, 'SUCCESS', `Graded repo: ${repo.owner}/${repo.name}. Score: ${grading.grade}. Reason: ${grading.reason}`);
            // Sleep 1.5 seconds between repositories to be respectful to APIs and limit rates
            await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        console.log('FollowMe job completed successfully.', stats);
        await (0, supabase_1.logAction)('SYSTEM', null, 'SUCCESS', `Automation job finished. Graded ${stats.graded} new repos. Followed: ${stats.followed}, Starred: ${stats.starred}`);
    }
    catch (err) {
        stats.failed++;
        console.error('Error during automated run:', err.message || err);
        await (0, supabase_1.logAction)('SYSTEM', null, 'FAILED', `Automation job failed: ${err.message || 'Unknown error'}`);
    }
    finally {
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
// Set up Cron schedule
node_cron_1.default.schedule(CRON_SCHEDULE, () => {
    console.log('Triggering automated cron job...');
    runAutomationJob().catch(console.error);
});
// Start Server
app.listen(PORT, () => {
    console.log(`Worker service is running on port ${PORT}`);
    console.log(`Cron schedule active: ${CRON_SCHEDULE}`);
    console.log(`Grade threshold set to: ${GRADE_THRESHOLD}`);
});
