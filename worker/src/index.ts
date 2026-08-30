import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { searchRecentRepos, fetchRepoReadme, starRepo, followUser, unfollowUser, checkIfFollowsBack, checkOwnerProfile, unstarRepo, getGitHubFollowing, getGitHubFollowers, getAuthenticatedUserStats } from './github';
import { gradeRepository, FatalAiQuotaError, isAiQuotaOrAuthError } from './nvidia';
import { supabase, isRepoGraded, saveRepo, logAction, fetchSystemSettings, SystemRuntimeConfig, fetchAllRows } from './supabase';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;
const WORKER_SECRET = process.env.WORKER_SECRET || 'dev_secret';

const TOPICS = ['ai', 'machine-learning', 'llm', 'flutter', 'nodejs', 'python'];

let isJobRunning = false;
let lastRun: string | null = null;
let consecutiveFailures = 0;

// Helper to determine if an error is recoverable (e.g. rate limit, timeout)
function isRecoverableError(err: any): boolean {
  const msg = (err.message || String(err)).toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('403') ||
    msg.includes('429') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('etimedout')
  );
}

// Helper to log fatal worker errors or warnings to database
async function logFatalErrorOrWarn(errorMessage: string, status: 'ERROR' | 'WARN') {
  // First, try inserting into 'worker_logs' as explicitly requested in instructions
  try {
    const { error } = await supabase.from('worker_logs').insert({
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
  } catch (err: any) {
    console.warn('Error trying to write to worker_logs, trying logs table:', err.message || err);
  }

  // Fallback to the standard 'logs' table
  try {
    const { error } = await supabase.from('logs').insert({
      action: 'SYSTEM',
      status: status,
      message: errorMessage,
      timestamp: new Date().toISOString(),
    });
    if (error) {
      console.error('Error fallback logging to logs table:', error.message);
    } else {
      console.log(`Successfully logged fatal error/warn with status ${status} to logs table.`);
    }
  } catch (err: any) {
    console.error('Failed to log fatal error/warn to logs table:', err.message || err);
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
    const config = await fetchSystemSettings();
    console.log(`Loaded runtime settings: maxProfilesPerRun=${config.maxProfilesPerRun}, gradeThreshold=${config.gradeThreshold}, activeWorkingHours=${config.activeWorkingHours}`);

    // Enforce active working hours check if defined (format: "HH:MM - HH:MM")
    if (config.activeWorkingHours && config.activeWorkingHours !== '00:00 - 24:00') {
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
          console.log(`Outside operating window (${config.activeWorkingHours}). Current time is ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}. Skipping run.`);
          await logAction('SYSTEM', null, 'SUCCESS', `Skipped run — outside active operating window (${config.activeWorkingHours})`);
          return { status: 'skipped', reason: 'outside_working_hours' };
        }
      }
    }

    await logAction('SYSTEM', null, 'SUCCESS', 'Automation job started');

    const repos = await searchRecentRepos(TOPICS);
    stats.discovered = repos.length;

    for (const repo of repos) {
      // 1. Check if already graded to avoid double calls / double grading
      const graded = await isRepoGraded(repo.id);
      if (graded) {
        stats.alreadyGraded++;
        continue;
      }

      console.log(`Processing candidate: ${repo.owner}/${repo.name}`);

      // 2. Pre-filter owner profile eligibility BEFORE AI grading
      if (stats.followed >= config.maxProfilesPerRun) {
        console.log(`Follow limit of ${config.maxProfilesPerRun} reached for this run. Skipping ${repo.owner}.`);
        stats.skipped++;
        continue;
      }

      // Check if owner already exists in repos table with followed = true, follow_back = false and unfollowed = false
      const { data: existingFollow } = await supabase
        .from('repos')
        .select('id')
        .ilike('owner', repo.owner)
        .eq('followed', true)
        .eq('follow_back', false)
        .eq('unfollowed', false)
        .limit(1)
        .maybeSingle();

      if (existingFollow) {
        console.log(`Skipping profile ${repo.owner} — already followed (followed=true, follow_back=false, unfollowed=false). Skipping AI grading.`);
        stats.skipped++;
        continue;
      }

      // Check owner profile targeting filters
      const profileCheck = await checkOwnerProfile(repo.owner, config);
      if (!profileCheck.shouldFollow) {
        console.log(`Skipping profile ${repo.owner} — targeting filter failed: ${profileCheck.skipReason}. Skipping AI grading.`);
        stats.skipped++;
        await logAction('SKIP_FOLLOW', repo.id, 'SUCCESS', `Skipped ${repo.owner} before grading: ${profileCheck.skipReason}`);
        continue;
      }

      // 3. Profile passed target filters — Now fetch README snippet & grade using NVIDIA NIM
      console.log(`Owner ${repo.owner} passed targeting filters. Proceeding to fetch README and grade repo ${repo.owner}/${repo.name}...`);
      const readme = await fetchRepoReadme(repo.owner, repo.name);
      repo.readme_snippet = readme;

      let grading: { grade: number; reason: string };
      try {
        grading = await gradeRepository(repo, config.systemPrompt);
        stats.graded++;
      } catch (aiErr: any) {
        if (aiErr instanceof FatalAiQuotaError || isAiQuotaOrAuthError(aiErr)) {
          const loudMsg = `AI evaluation paused: ${aiErr.message || 'API keys expired or quota exceeded'}. Continuing with unfollow cleanup and mutual sync.`;
          console.warn(`\n================================================================`);
          console.warn(`[AI EVALUATION NOTICE] ${loudMsg}`);
          console.warn(`================================================================\n`);

          await logFatalErrorOrWarn(loudMsg, 'WARN');
          await logAction('SYSTEM', repo.id, 'FAILED', loudMsg);
          // Stop trying more repos this run to avoid spamming API, but proceed with cleanup & unfollows
          break;
        }

        console.error(`Unexpected grading error for ${repo.owner}/${repo.name}:`, aiErr.message || aiErr);
        continue;
      }

      console.log(`Repo: ${repo.owner}/${repo.name} | Grade: ${grading.grade} | Reason: ${grading.reason}`);

      let followed = false;
      let starred = false;
      let starResult: { success: boolean; message: string } | null = null;
      let followResult: { success: boolean; message: string } | null = null;

      // 4. Follow user & Star repo if grade meets threshold
      if (grading.grade >= config.gradeThreshold) {
        // Star if under actions cap
        if (stats.starred < config.maxProfilesPerRun) {
          console.log(`Repo ${repo.owner}/${repo.name} meets threshold (${grading.grade} >= ${config.gradeThreshold}). Starring...`);
          const starSuccess = await starRepo(repo.owner, repo.name);
          if (starSuccess) {
            starred = true;
            stats.starred++;
            starResult = { success: true, message: `Starred repository ${repo.owner}/${repo.name}` };
          } else {
            starResult = { success: false, message: `Failed to star repository ${repo.owner}/${repo.name}` };
          }
        }

        // Follow user (profile already passed check)
        console.log(`Following user ${repo.owner}...`);
        const followSuccess = await followUser(repo.owner);
        if (followSuccess) {
          followed = true;
          stats.followed++;
          followResult = { success: true, message: `Followed user ${repo.owner}` };
        } else {
          followResult = { success: false, message: `Failed to follow user ${repo.owner}` };
        }
      }

      // 5. Save repository to database and log (persist both followed and skipped repos)
      if (followed || starred) {
        await saveRepo(
          {
            id: repo.id,
            github_url: repo.github_url,
            owner: repo.owner,
            name: repo.name,
            stars: repo.stars,
            language: repo.language,
            topics: repo.topics,
            readme_snippet: repo.readme_snippet,
            grade: grading.grade,
          },
          followed,
          starred,
          false,
          null
        );

        if (starResult) {
          await logAction('STAR', repo.id, starResult.success ? 'SUCCESS' : 'FAILED', starResult.message);
        }
        if (followResult) {
          await logAction('FOLLOW', repo.id, followResult.success ? 'SUCCESS' : 'FAILED', followResult.message);
        }

        await logAction(
          'GRADE',
          repo.id,
          'SUCCESS',
          `Graded repo: ${repo.owner}/${repo.name}. Score: ${grading.grade}. Reason: ${grading.reason}`
        );
      } else {
        // Persist low-grade or non-actioned repo to database as follow_skipped: true
        await saveRepo(
          {
            id: repo.id,
            github_url: repo.github_url,
            owner: repo.owner,
            name: repo.name,
            stars: repo.stars,
            language: repo.language,
            topics: repo.topics,
            readme_snippet: repo.readme_snippet,
            grade: grading.grade,
          },
          false,
          false,
          true,
          `Grade ${grading.grade} < ${config.gradeThreshold}: ${grading.reason}`
        );

        await logAction(
          'GRADE',
          repo.id,
          'SUCCESS',
          `Graded repo (skipped follow): ${repo.owner}/${repo.name}. Score: ${grading.grade}. Reason: ${grading.reason}`
        );
        console.log(`[Automation] Persisted skipped repo for ${repo.owner}/${repo.name} - grade below threshold. (Grade: ${grading.grade}, Reason: ${grading.reason})`);
      }

      // Sleep 1.5 seconds between repositories
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log('FollowMe job completed successfully.', stats);
    await logAction(
      'SYSTEM',
      null,
      'SUCCESS',
      `Automation job finished. Graded ${stats.graded} new repos. Followed: ${stats.followed}, Starred: ${stats.starred}, Skipped: ${stats.skipped}`
    );

    // Write to run_summary at the end of the main evaluation job
    let mutualsCount = 0;
    try {
      const { count } = await supabase
        .from('repos')
        .select('*', { count: 'exact', head: true })
        .eq('follow_back', true);
      mutualsCount = count || 0;
    } catch (countErr) {
      console.warn('Failed to query mutuals count for run_summary:', countErr);
    }

    try {
      await supabase.from('run_summary').insert({
        profiles_followed: stats.followed,
        profiles_unfollowed: 0,
        repos_starred: stats.starred,
        mutuals_found: mutualsCount,
        profiles_skipped: stats.skipped,
        profiles_evaluated: stats.graded,
        run_type: 'evaluation'
      });
      console.log('Successfully recorded evaluation run to run_summary.');
    } catch (summaryErr: any) {
      console.error('Error inserting into run_summary:', summaryErr.message || summaryErr);
    }

    consecutiveFailures = 0; // Reset failure counter on success

    // Call cleanup at the end of every automation run
    try {
      await runCleanupJob(config);
    } catch (cleanupErr: any) {
      console.error('Error running cleanup job as part of automation:', cleanupErr.message || cleanupErr);
    }

    try {
      await cleanupNonFollowbacks(config);
    } catch (ratioErr: any) {
      console.error('Error running auto-unfollow ratio cleanup:', ratioErr.message || ratioErr);
    }

    try {
      await syncMutuals();
    } catch (syncErr: any) {
      console.error('Error running mutuals sync:', syncErr.message || syncErr);
    }
  } catch (err: any) {
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
    } else {
      console.error(`Fatal error or max retries reached (${consecutiveFailures}/3). logging error.`);
      await logFatalErrorOrWarn(`Automation job failed: ${err.message || 'Unknown error'}`, 'ERROR');
    }
  } finally {
    lastRun = new Date().toISOString();
    isJobRunning = false;
  }

  return { status: 'completed', stats };
}

// REST Endpoint to trigger manually
app.post('/run', async (req: Request, res: Response) => {
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
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', jobRunning: isJobRunning });
});

// GET /status
app.get('/status', async (req: Request, res: Response) => {
  const stats = await getAuthenticatedUserStats();
  res.json({
    nextRun: null,
    lastRun,
    isJobRunning,
    consecutiveFailures,
    following: stats ? stats.following : null,
    followers: stats ? stats.followers : null,
    ratio: stats ? stats.ratio : null,
  });
});

// POST /cleanup
app.post('/cleanup', async (req: Request, res: Response) => {
  const authHeader = req.headers['x-worker-secret'] || req.body?.secret;

  if (authHeader !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
  }

  runCleanupJob().catch(console.error);
  return res.json({ message: 'Cleanup job triggered successfully.' });
});

// POST /sync-mutuals
app.post('/sync-mutuals', async (req: Request, res: Response) => {
  const authHeader = req.headers['x-worker-secret'] || req.body?.secret;

  if (authHeader !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
  }

  syncMutuals().catch(console.error);
  return res.json({ message: 'Mutuals sync triggered successfully.' });
});

// POST /cleanlogs
app.post('/cleanlogs', async (req: Request, res: Response) => {
  const authHeader = req.headers['x-worker-secret'] || req.body?.secret;

  if (authHeader !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
  }

  try {
    const { data: allLogs, error: fetchErr } = await supabase
      .from('logs')
      .select('id')
      .order('timestamp', { ascending: false });

    if (fetchErr) {
      console.error('Error fetching logs for cleanup:', fetchErr.message);
      return res.status(500).json({ success: false, error: fetchErr.message });
    }

    if (allLogs && allLogs.length > 200) {
      const idsToDelete = allLogs.slice(200).map(row => row.id);
      
      // run_summary is append-only — never delete from this table.
      const { error: delErr } = await supabase
        .from('logs')
        .delete()
        .in('id', idsToDelete);

      if (delErr) {
        console.error('Error deleting old logs:', delErr.message);
        return res.status(500).json({ success: false, error: delErr.message });
      }

      await logAction('SYSTEM', null, 'SUCCESS', `Cleaned up logs. Deleted ${idsToDelete.length} old log entries.`);
      return res.json({ success: true, message: `Successfully deleted ${idsToDelete.length} old log entries, keeping the latest 200.` });
    } else {
      return res.json({ success: true, message: 'Logs table has 200 or fewer entries. No deletion required.' });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error occurred during log cleanup' });
  }
});

// POST /clearstale
app.post('/clearstale', async (req: Request, res: Response) => {
  const authHeader = req.headers['x-worker-secret'] || req.body?.secret;

  if (authHeader !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
  }

  try {
    const { data, error } = await supabase
      .from('repos')
      .delete()
      .eq('followed', false)
      .eq('starred', false)
      .eq('unfollowed', false)
      .eq('follow_skipped', true)
      .select('id');

    if (error) {
      console.error('Error clearing stale profiles:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    const count = data ? data.length : 0;
    await logAction('SYSTEM', null, 'SUCCESS', `Cleared ${count} stale profiles.`);
    return res.json({ success: true, message: `Successfully cleared ${count} stale profiles.` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error occurred during stale profiles cleanup' });
  }
});

// POST /star
app.post('/star', async (req: Request, res: Response) => {
  const authHeader = req.headers['x-worker-secret'] || req.body?.secret;

  if (authHeader !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
  }

  const { owner, repo } = req.body;
  if (!owner || !repo) {
    return res.status(400).json({ error: 'Missing owner or repo parameter' });
  }

  try {
    const success = await starRepo(owner, repo);
    if (success) {
      const { data: dbRepo } = await supabase
        .from('repos')
        .select('id')
        .ilike('owner', owner)
        .eq('name', repo)
        .maybeSingle();

      const repoId = dbRepo ? dbRepo.id : null;

      const { error } = await supabase
        .from('repos')
        .update({ starred: true })
        .ilike('owner', owner)
        .eq('name', repo);

      if (error) {
        console.error(`Error updating DB after star for ${owner}/${repo}:`, error.message);
      }

      await logAction('STAR', repoId, 'SUCCESS', `Manually starred repository ${owner}/${repo}`);
      return res.json({ success: true, message: `Successfully starred ${owner}/${repo}` });
    } else {
      return res.status(500).json({ success: false, error: `Failed to star repository ${owner}/${repo}` });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error manual starring' });
  }
});

// POST /deleteprofile
app.post('/deleteprofile', async (req: Request, res: Response) => {
  const authHeader = req.headers['x-worker-secret'] || req.body?.secret;

  if (authHeader !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
  }

  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Missing username parameter' });
  }

  try {
    const { data, error } = await supabase
      .from('repos')
      .delete()
      .ilike('owner', username);

    if (error) {
      console.error(`Error deleting profile ${username}:`, error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    await logAction('SYSTEM', null, 'SUCCESS', `Manually deleted profile and repositories for ${username}`);
    return res.json({ success: true, message: `Successfully deleted profile ${username}` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error manual deleting profile' });
  }
});

// POST /unstar
app.post('/unstar', async (req: Request, res: Response) => {
  const authHeader = req.headers['x-worker-secret'] || req.body?.secret;

  if (authHeader !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
  }

  const { owner, repo } = req.body;
  if (!owner || !repo) {
    return res.status(400).json({ error: 'Missing owner or repo parameter' });
  }

  try {
    const success = await unstarRepo(owner, repo);
    if (success) {
      // Find repo ID from owner/name
      const { data: dbRepo } = await supabase
        .from('repos')
        .select('id')
        .ilike('owner', owner)
        .eq('name', repo)
        .maybeSingle();

      const repoId = dbRepo ? dbRepo.id : null;

      const { error } = await supabase
        .from('repos')
        .update({ starred: false })
        .ilike('owner', owner)
        .eq('name', repo);

      if (error) {
        console.error(`Error updating DB after unstar for ${owner}/${repo}:`, error.message);
      }

      await logAction('UNSTAR', repoId, 'SUCCESS', `Manually unstarred repository ${owner}/${repo}`);
      return res.json({ success: true, message: `Successfully unstarred ${owner}/${repo}` });
    } else {
      return res.status(500).json({ success: false, error: `Failed to unstar repository ${owner}/${repo}` });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error manual unstarring' });
  }
});

// POST /follow
app.post('/follow', async (req: Request, res: Response) => {
  const authHeader = req.headers['x-worker-secret'] || req.body?.secret;

  if (authHeader !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
  }

  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Missing username parameter' });
  }

  try {
    const success = await followUser(username);
    if (success) {
      const { data: dbRepo } = await supabase
        .from('repos')
        .select('id')
        .ilike('owner', username)
        .limit(1)
        .maybeSingle();

      const repoId = dbRepo ? dbRepo.id : null;

      const { error } = await supabase
        .from('repos')
        .update({ followed: true, unfollowed: false, followed_at: new Date().toISOString() })
        .ilike('owner', username);

      if (error) {
        console.error(`Error updating DB after follow for ${username}:`, error.message);
      }

      await logAction('FOLLOW', repoId, 'SUCCESS', `Manually followed user ${username}`);
      return res.json({ success: true, message: `Successfully followed ${username}` });
    } else {
      return res.status(500).json({ success: false, error: `Failed to follow user ${username}` });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error manual following' });
  }
});

// POST /unfollow
app.post('/unfollow', async (req: Request, res: Response) => {
  const authHeader = req.headers['x-worker-secret'] || req.body?.secret;

  if (authHeader !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
  }

  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Missing username parameter' });
  }

  try {
    const success = await unfollowUser(username);
    if (success) {
      // Find repo ID where owner = username
      const { data: dbRepo } = await supabase
        .from('repos')
        .select('id')
        .ilike('owner', username)
        .limit(1)
        .maybeSingle();

      const repoId = dbRepo ? dbRepo.id : null;

      const { error } = await supabase
        .from('repos')
        .update({ followed: false, unfollowed: true })
        .ilike('owner', username);

      if (error) {
        console.error(`Error updating DB after unfollow for ${username}:`, error.message);
      }

      await logAction('UNFOLLOW', repoId, 'SUCCESS', `Manually unfollowed user ${username}`);
      return res.json({ success: true, message: `Successfully unfollowed ${username}` });
    } else {
      return res.status(500).json({ success: false, error: `Failed to unfollow user ${username}` });
    }
  } catch (err: any) {
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
    // 1. Fetch all GitHub followers (paginated)
    const followers = await getGitHubFollowers();
    const followerSet = new Set(followers.map(u => u.toLowerCase()));
    console.log(`Fetched ${followers.length} GitHub followers for mutuals sync.`);

    // 2. Fetch all profiles in Supabase repos table (paginated)
    const allProfiles = await fetchAllRows<{ id: number; owner: string }>('repos', 'id, owner');

    if (!allProfiles || allProfiles.length === 0) {
      console.log('No profiles found in repos table to sync.');
      return;
    }

    console.log(`Found ${allProfiles.length} total profile rows to sync follow_back status.`);

    // 3. Separate into mutual (follows back) vs non-mutual
    const mutualOwners: string[] = [];
    const nonMutualOwners: string[] = [];

    for (const profile of allProfiles) {
      if (followerSet.has(profile.owner.toLowerCase())) {
        mutualOwners.push(profile.owner);
      } else {
        nonMutualOwners.push(profile.owner);
      }
    }

    console.log(`Mutuals: ${mutualOwners.length}, Non-mutuals: ${nonMutualOwners.length}`);

    // 4. Batch update follow_back = true for mutual owners (chunked by 200)
    for (let i = 0; i < mutualOwners.length; i += 200) {
      const chunk = mutualOwners.slice(i, i + 200);
      const { error: mutualErr } = await supabase
        .from('repos')
        .update({ follow_back: true })
        .in('owner', chunk);

      if (mutualErr) {
        console.error('Error updating follow_back=true for mutuals chunk:', mutualErr.message);
      }
    }
    if (mutualOwners.length > 0) {
      console.log(`Updated follow_back=true for ${mutualOwners.length} mutual owner entries.`);
    }

    // 5. Batch update follow_back = false for non-mutual owners (chunked by 200)
    for (let i = 0; i < nonMutualOwners.length; i += 200) {
      const chunk = nonMutualOwners.slice(i, i + 200);
      const { error: nonMutualErr } = await supabase
        .from('repos')
        .update({ follow_back: false })
        .in('owner', chunk);

      if (nonMutualErr) {
        console.error('Error updating follow_back=false for non-mutuals chunk:', nonMutualErr.message);
      }
    }
    if (nonMutualOwners.length > 0) {
      console.log(`Updated follow_back=false for ${nonMutualOwners.length} non-mutual owner entries.`);
    }

    await logAction('SYSTEM', null, 'SUCCESS', `Mutuals sync complete. Mutuals: ${mutualOwners.length}, Non-mutuals: ${nonMutualOwners.length}`);
    console.log('Mutuals sync completed successfully.');
  } catch (err: any) {
    console.error('Error in syncMutuals:', err.message || err);
    await logAction('SYSTEM', null, 'FAILED', `syncMutuals failed: ${err.message || 'Unknown error'}`);
  }
}

async function cleanupNonFollowbacks(runtimeConfig?: SystemRuntimeConfig) {
  console.log('Starting FollowMe auto-unfollow ratio cleanup (cleanupNonFollowbacks)...');
  let unfollowedRatioCount = 0;
  try {
    const config = runtimeConfig || (await fetchSystemSettings());
    if (config.autoUnfollowNonMutuals === false) {
      console.log('Auto unfollow non-mutuals is disabled in system settings. Skipping ratio cleanup.');
      return;
    }

    const following = await getGitHubFollowing();
    const followers = await getGitHubFollowers();

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
    const dbRepos = await fetchAllRows<{ owner: string; followed_at: string | null }>(
      'repos',
      'owner, followed_at',
      q => q.eq('followed', true)
    );

    const followedAtMap = new Map<string, number>();
    const isFollowedByBot = new Set<string>();
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

    // Filter: allow non-followers who are past the grace period
    const eligibleUnfollows = nonFollowbacks.filter(user => {
      const followedAt = followedAtMap.get(user.toLowerCase());
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
    const apiIndexMap = new Map<string, number>();
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
      const success = await unfollowUser(username);
      if (success) {
        currentFollowingCount--;
        unfollowedRatioCount++;
        
        // Find repo ID if exists to log action properly
        const { data: dbRepo } = await supabase
          .from('repos')
          .select('id')
          .ilike('owner', username)
          .limit(1)
          .maybeSingle();
        const repoId = dbRepo ? dbRepo.id : null;

        // Update database to unfollowed: true, followed: false
        await supabase
          .from('repos')
          .update({ followed: false, unfollowed: true })
          .ilike('owner', username);

        await logAction('UNFOLLOW_RATIO', repoId, 'SUCCESS', `Auto-unfollowed ${username} to balance following/followers ratio.`);
      } else {
        console.error(`Failed to unfollow ${username} during ratio cleanup.`);
      }

      // 2.5 second delay between unfollow calls to avoid abuse detection
      await new Promise(resolve => setTimeout(resolve, 2500));
    }

    // Write a summary row for ratio cleanup
    // run_summary is append-only — never delete from this table.
    try {
      await supabase.from('run_summary').insert({
        run_type: 'cleanup',
        profiles_unfollowed: unfollowedRatioCount,
        profiles_followed: 0,
        repos_starred: 0,
        mutuals_found: 0,
        profiles_skipped: 0,
        profiles_evaluated: 0
      });
      console.log(`Recorded ratio cleanup run to run_summary (${unfollowedRatioCount} unfollowed).`);
    } catch (summaryErr: any) {
      console.error('Error inserting into run_summary for ratio cleanup:', summaryErr.message || summaryErr);
    }
  } catch (err: any) {
    console.error('Error in cleanupNonFollowbacks:', err.message || err);
    await logAction('SYSTEM', null, 'FAILED', `cleanupNonFollowbacks failed: ${err.message || 'Unknown error'}`);
  }
}

async function runCleanupJob(runtimeConfig?: SystemRuntimeConfig) {
  console.log('Starting FollowMe cleanup job...');
  await logAction('SYSTEM', null, 'SUCCESS', 'Cleanup job started');

  let unfollowedCount = 0;

  try {
    const config = runtimeConfig || (await fetchSystemSettings());
    if (config.autoUnfollowNonMutuals === false) {
      console.log('Auto unfollow non-mutuals is disabled in system settings. Skipping cleanup.');
      await logAction('SYSTEM', null, 'SUCCESS', 'Cleanup job finished: autoUnfollowNonMutuals disabled');
      return;
    }

    const graceDays = config.unfollowGracePeriod && config.unfollowGracePeriod > 0 ? config.unfollowGracePeriod : 7;
    const cutoffDate = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000).toISOString();
    console.log(`Checking for non-mutual profiles followed before ${cutoffDate} (${graceDays}-day grace period)...`);

    const repos = await fetchAllRows<any>(
      'repos',
      '*',
      q => q
        .eq('follow_back', false)
        .eq('unfollowed', false)
        .eq('followed', true)
        .lt('followed_at', cutoffDate)
    );

    if (!repos || repos.length === 0) {
      console.log(`No users found beyond the ${graceDays}-day grace period to unfollow.`);
      await logAction('SYSTEM', null, 'SUCCESS', 'Cleanup job finished: no actions needed');
      
      // Write a summary row for cleanup run even if 0 unfollowed
      try {
        await supabase.from('run_summary').insert({
          run_type: 'cleanup',
          profiles_unfollowed: 0,
          profiles_followed: 0,
          repos_starred: 0,
          mutuals_found: 0,
          profiles_skipped: 0,
          profiles_evaluated: 0
        });
      } catch (sumErr) {
        console.error('Error logging empty cleanup run:', sumErr);
      }
      return;
    }

    console.log(`Found ${repos.length} users past the ${graceDays}-day grace period to unfollow.`);

    for (const repo of repos) {
      // Unfollow
      const unfollowedSuccess = await unfollowUser(repo.owner);

      if (unfollowedSuccess) {
        unfollowedCount++;
        const { error: updateErr } = await supabase
          .from('repos')
          .update({ unfollowed: true, followed: false })
          .eq('id', repo.id);

        if (updateErr) {
          console.error(`Error updating unfollowed status for ${repo.owner}:`, updateErr.message);
        } else {
          await logAction('UNFOLLOW', repo.id, 'SUCCESS', `Unfollowed user ${repo.owner} (no follow-back within ${graceDays} days)`);
        }
      } else {
        await logAction('UNFOLLOW', repo.id, 'FAILED', `Failed to unfollow user ${repo.owner}`);
      }

      // 2.5 second delay between checks
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }

    console.log(`Cleanup job completed. Unfollowed ${unfollowedCount} accounts.`);
    await logAction('SYSTEM', null, 'SUCCESS', `Cleanup job completed successfully. Unfollowed: ${unfollowedCount}`);

    // Write a summary row for the cleanup run
    // run_summary is append-only — never delete from this table.
    try {
      await supabase.from('run_summary').insert({
        run_type: 'cleanup',
        profiles_unfollowed: unfollowedCount,
        profiles_followed: 0,
        repos_starred: 0,
        mutuals_found: 0,
        profiles_skipped: 0,
        profiles_evaluated: 0
      });
      console.log('Recorded cleanup run to run_summary.');
    } catch (summaryErr: any) {
      console.error('Error inserting into run_summary for cleanup:', summaryErr.message || summaryErr);
    }

    // Sync mutuals at the end of every cleanup run
    try {
      await syncMutuals();
    } catch (syncErr: any) {
      console.error('Error running mutuals sync after cleanup:', syncErr.message || syncErr);
    }
  } catch (err: any) {
    console.error('Error during cleanup job:', err.message || err);
    await logAction('SYSTEM', null, 'FAILED', `Cleanup job failed: ${err.message || 'Unknown error'}`);
  }
}

async function reconcileFollowing() {
  console.log('Starting following list reconciliation...');
  try {
    const actualFollowingList = await getGitHubFollowing();
    if (!actualFollowingList || actualFollowingList.length === 0) {
      console.warn('Reconciliation skipped: GitHub following list returned empty (possible rate limit or token issue).');
      return;
    }

    const actualFollowingSet = new Set(actualFollowingList.map(u => u.toLowerCase()));
    console.log(`Live following count from GitHub: ${actualFollowingList.length}`);

    // Fetch all profiles in Supabase (paginated)
    const allDbRepos = await fetchAllRows<{ id: number; owner: string; followed: boolean; unfollowed: boolean }>(
      'repos',
      'id, owner, followed, unfollowed'
    );

    // Find profiles in DB marked followed=true that are NO LONGER followed on GitHub
    const toMarkUnfollowed = allDbRepos?.filter(
      row => row.followed === true && !actualFollowingSet.has(row.owner.toLowerCase())
    ) ?? [];

    // Find profiles in DB marked followed=false / unfollowed=true that ARE ACTUALLY STILL followed on GitHub
    const toRestoreFollowed = allDbRepos?.filter(
      row => actualFollowingSet.has(row.owner.toLowerCase()) && (row.followed !== true || row.unfollowed === true)
    ) ?? [];

    console.log(`Reconciliation: ${toMarkUnfollowed.length} to mark unfollowed, ${toRestoreFollowed.length} to restore to active followed.`);

    if (toMarkUnfollowed.length > 0) {
      const idsToUpdate = toMarkUnfollowed.map(r => r.id);
      for (let i = 0; i < idsToUpdate.length; i += 200) {
        const chunk = idsToUpdate.slice(i, i + 200);
        const { error: updateErr } = await supabase
          .from('repos')
          .update({ followed: false, unfollowed: true })
          .in('id', chunk);

        if (updateErr) {
          console.error('Error updating unfollowed during reconciliation chunk:', updateErr.message);
        }
      }
      console.log(`Successfully marked ${toMarkUnfollowed.length} profiles as unfollowed.`);
    }

    if (toRestoreFollowed.length > 0) {
      const idsToRestore = toRestoreFollowed.map(r => r.id);
      for (let i = 0; i < idsToRestore.length; i += 200) {
        const chunk = idsToRestore.slice(i, i + 200);
        const { error: restoreErr } = await supabase
          .from('repos')
          .update({ followed: true, unfollowed: false })
          .in('id', chunk);

        if (restoreErr) {
          console.error('Error restoring profiles during reconciliation chunk:', restoreErr.message);
        }
      }
      console.log(`Successfully restored ${toRestoreFollowed.length} profiles to followed = true, unfollowed = false.`);
    }

    await logAction('SYSTEM', null, 'SUCCESS', `Reconciliation complete. Live following: ${actualFollowingList.length}. Marked unfollowed: ${toMarkUnfollowed.length}, Restored active: ${toRestoreFollowed.length}`);
    console.log('Reconciliation complete.');
  } catch (err: any) {
    console.error('Error in reconcileFollowing:', err.message || err);
  }
}

// POST /reconcile
app.post('/reconcile', async (req: Request, res: Response) => {
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
});

// Global error handlers to prevent silent process crashes and log them
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  try {
    await logFatalErrorOrWarn(`Uncaught Exception: ${error.message || error}`, 'ERROR');
  } catch (logErr) {
    console.error('Failed to log uncaught exception to database:', logErr);
  }
  process.exit(1);
});

process.on('unhandledRejection', async (reason: any, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  try {
    await logFatalErrorOrWarn(`Unhandled Rejection: ${reason?.message || reason || 'Unknown reason'}`, 'ERROR');
  } catch (logErr) {
    console.error('Failed to log unhandled rejection to database:', logErr);
  }
});
