import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { searchRecentRepos, fetchRepoReadme, starRepo, followUser, unfollowUser, checkIfFollowsBack, checkOwnerProfile, unstarRepo, getGitHubFollowing, getGitHubFollowers, getAuthenticatedUserStats } from './github';
import { gradeRepository } from './nvidia';
import { supabase, isRepoGraded, saveRepo, logAction } from './supabase';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;
const WORKER_SECRET = process.env.WORKER_SECRET || 'dev_secret';
const GRADE_THRESHOLD = parseInt(process.env.GRADE_THRESHOLD || '7', 10);
const MAX_ACTIONS_PER_RUN = 30;

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

      console.log(`Processing repo: ${repo.owner}/${repo.name}`);

      // 2. Fetch README snippet
      const readme = await fetchRepoReadme(repo.owner, repo.name);
      repo.readme_snippet = readme;

      // 3. Grade using NVIDIA NIM
      const grading = await gradeRepository(repo);
      stats.graded++;

      console.log(`Repo: ${repo.owner}/${repo.name} | Grade: ${grading.grade} | Reason: ${grading.reason}`);

      let followed = false;
      let starred = false;
      let starResult: { success: boolean; message: string } | null = null;
      let followResult: { success: boolean; message: string } | null = null;

      // 4. Auto star / follow if grade is above threshold
      let followSkipped = false;
      let followSkipReason: string | null = null;

      if (grading.grade >= GRADE_THRESHOLD) {
        // Star if under the actions cap
        if (stats.starred < MAX_ACTIONS_PER_RUN) {
          console.log(`Repo ${repo.owner}/${repo.name} meets threshold (${grading.grade} >= ${GRADE_THRESHOLD}). Starring...`);
          const starSuccess = await starRepo(repo.owner, repo.name);
          if (starSuccess) {
            starred = true;
            stats.starred++;
            starResult = { success: true, message: `Starred repository ${repo.owner}/${repo.name}` };
          } else {
            starResult = { success: false, message: `Failed to star repository ${repo.owner}/${repo.name}` };
          }
        } else {
          console.log(`Star limit of ${MAX_ACTIONS_PER_RUN} reached for this run. Skipping star for ${repo.owner}/${repo.name}.`);
        }

        // Follow if under the actions cap
        if (stats.followed < MAX_ACTIONS_PER_RUN) {
          // Check owner profile before following
          const profileCheck = await checkOwnerProfile(repo.owner);
          if (profileCheck.shouldFollow) {
            console.log(`Owner ${repo.owner} passed targeting filters. Following...`);
            const followSuccess = await followUser(repo.owner);
            if (followSuccess) {
              followed = true;
              stats.followed++;
              followResult = { success: true, message: `Followed user ${repo.owner}` };
            } else {
              followResult = { success: false, message: `Failed to follow user ${repo.owner}` };
            }
          } else {
            followSkipped = true;
            followSkipReason = profileCheck.skipReason;
            stats.skipped++;
            console.log(`Skipping follow for ${repo.owner} — reason: ${profileCheck.skipReason}`);
          }
        } else {
          console.log(`Follow limit of ${MAX_ACTIONS_PER_RUN} reached for this run. Skipping profile checks / follow for ${repo.owner}.`);
        }
      }

      // 5. Save repository to database and log if followed or starred
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
          followSkipped,
          followSkipReason
        );

        // 6. Log interactions after repo is successfully saved
        if (starResult) {
          await logAction('STAR', repo.id, starResult.success ? 'SUCCESS' : 'FAILED', starResult.message);
        }
        if (followResult) {
          await logAction('FOLLOW', repo.id, followResult.success ? 'SUCCESS' : 'FAILED', followResult.message);
        }
        if (followSkipped) {
          await logAction('SKIP_FOLLOW', repo.id, 'SUCCESS', `Skipped follow for ${repo.owner}: ${followSkipReason}`);
        }

        await logAction(
          'GRADE',
          repo.id,
          'SUCCESS',
          `Graded repo: ${repo.owner}/${repo.name}. Score: ${grading.grade}. Reason: ${grading.reason}`
        );
      } else {
        console.log(`[Automation] Skipped database write for ${repo.owner}/${repo.name} - not followed and not starred. (Grade: ${grading.grade}, Reason: ${grading.reason})`);
      }

      // Sleep 1.5 seconds between repositories to be respectful to APIs and limit rates
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log('FollowMe job completed successfully.', stats);
    await logAction(
      'SYSTEM',
      null,
      'SUCCESS',
      `Automation job finished. Graded ${stats.graded} new repos. Followed: ${stats.followed}, Starred: ${stats.starred}, Skipped: ${stats.skipped}`
    );

    consecutiveFailures = 0; // Reset failure counter on success

    // Call cleanup at the end of every automation run
    try {
      await runCleanupJob();
    } catch (cleanupErr: any) {
      console.error('Error running cleanup job as part of automation:', cleanupErr.message || cleanupErr);
    }

    try {
      await cleanupNonFollowbacks();
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
        .eq('owner', owner)
        .eq('name', repo)
        .maybeSingle();

      const repoId = dbRepo ? dbRepo.id : null;

      const { error } = await supabase
        .from('repos')
        .update({ starred: true })
        .eq('owner', owner)
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
      .eq('owner', username);

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
        .eq('owner', owner)
        .eq('name', repo)
        .maybeSingle();

      const repoId = dbRepo ? dbRepo.id : null;

      const { error } = await supabase
        .from('repos')
        .update({ starred: false })
        .eq('owner', owner)
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
        .eq('owner', username)
        .limit(1)
        .maybeSingle();

      const repoId = dbRepo ? dbRepo.id : null;

      const { error } = await supabase
        .from('repos')
        .update({ followed: true, unfollowed: false, followed_at: new Date().toISOString() })
        .eq('owner', username);

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
        .eq('owner', username)
        .limit(1)
        .maybeSingle();

      const repoId = dbRepo ? dbRepo.id : null;

      const { error } = await supabase
        .from('repos')
        .update({ followed: false, unfollowed: true })
        .eq('owner', username);

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

    // 2. Fetch all profiles in Supabase repos table (no followed = true filter)
    const { data: allProfiles, error } = await supabase
      .from('repos')
      .select('id, owner');

    if (error) {
      console.error('Error fetching profiles for mutuals sync:', error.message);
      return;
    }

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

    // 4. Batch update follow_back = true for mutual owners
    if (mutualOwners.length > 0) {
      const { error: mutualErr } = await supabase
        .from('repos')
        .update({ follow_back: true })
        .in('owner', mutualOwners);

      if (mutualErr) {
        console.error('Error updating follow_back=true for mutuals:', mutualErr.message);
      } else {
        console.log(`Updated follow_back=true for ${mutualOwners.length} mutual owner entries.`);
      }
    }

    // 5. Batch update follow_back = false for non-mutual owners
    if (nonMutualOwners.length > 0) {
      const { error: nonMutualErr } = await supabase
        .from('repos')
        .update({ follow_back: false })
        .in('owner', nonMutualOwners);

      if (nonMutualErr) {
        console.error('Error updating follow_back=false for non-mutuals:', nonMutualErr.message);
      } else {
        console.log(`Updated follow_back=false for ${nonMutualOwners.length} non-mutual owner entries.`);
      }
    }

    await logAction('SYSTEM', null, 'SUCCESS', `Mutuals sync complete. Mutuals: ${mutualOwners.length}, Non-mutuals: ${nonMutualOwners.length}`);
    console.log('Mutuals sync completed successfully.');
  } catch (err: any) {
    console.error('Error in syncMutuals:', err.message || err);
    await logAction('SYSTEM', null, 'FAILED', `syncMutuals failed: ${err.message || 'Unknown error'}`);
  }
}

async function cleanupNonFollowbacks() {
  console.log('Starting FollowMe auto-unfollow ratio cleanup (cleanupNonFollowbacks)...');
  try {
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
    const followerSet = new Set(followers);
    const nonFollowbacks = following.filter(user => !followerSet.has(user));

    if (nonFollowbacks.length === 0) {
      console.log('No non-followback users found to unfollow.');
      return;
    }

    // Fetch followed profiles from Supabase where we set followed = true
    const { data: dbRepos, error } = await supabase
      .from('repos')
      .select('owner, followed_at')
      .eq('followed', true)
      .in('owner', nonFollowbacks);

    if (error) {
      console.warn('Error fetching followed users from Supabase, processing in API order:', error.message);
    }

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

    // 7-day grace period cutoff
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Filter out users followed less than 7 days ago AND users not followed by FollowMe bot
    const eligibleUnfollows = nonFollowbacks.filter(user => {
      // Must be followed by the bot (in repos table with followed = true)
      if (!isFollowedByBot.has(user.toLowerCase())) {
        return false;
      }
      const followedAt = followedAtMap.get(user.toLowerCase());
      if (followedAt !== undefined && followedAt > sevenDaysAgo) {
        // Less than 7 days ago
        return false;
      }
      return true;
    });

    if (eligibleUnfollows.length === 0) {
      console.log('All eligible non-followback users are within the 7-day grace period or were followed manually. Skipping unfollow cleanup.');
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

    console.log(`Sorted ${eligibleUnfollows.length} bot-followed non-followers eligible for unfollow.`);

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
        
        // Find repo ID if exists to log action properly
        const { data: dbRepo } = await supabase
          .from('repos')
          .select('id')
          .eq('owner', username)
          .limit(1)
          .maybeSingle();
        const repoId = dbRepo ? dbRepo.id : null;

        // Update database to unfollowed: true, followed: false
        await supabase
          .from('repos')
          .update({ followed: false, unfollowed: true })
          .eq('owner', username);

        await logAction('UNFOLLOW_RATIO', repoId, 'SUCCESS', `Auto-unfollowed ${username} to balance following/followers ratio.`);
      } else {
        console.error(`Failed to unfollow ${username} during ratio cleanup.`);
      }

      // 2 second delay between unfollow calls to avoid abuse detection
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (err: any) {
    console.error('Error in cleanupNonFollowbacks:', err.message || err);
    await logAction('SYSTEM', null, 'FAILED', `cleanupNonFollowbacks failed: ${err.message || 'Unknown error'}`);
  }
}

async function runCleanupJob() {
  console.log('Starting FollowMe cleanup job...');
  await logAction('SYSTEM', null, 'SUCCESS', 'Cleanup job started');

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: repos, error } = await supabase
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
      await logAction('SYSTEM', null, 'SUCCESS', 'Cleanup job finished: no actions needed');
      return;
    }

    console.log(`Found ${repos.length} users to check for follow-back status.`);

    for (const repo of repos) {
      const followsBack = await checkIfFollowsBack(repo.owner);

      if (followsBack) {
        // Update database
        const { error: updateErr } = await supabase
          .from('repos')
          .update({ follow_back: true })
          .eq('id', repo.id);

        if (updateErr) {
          console.error(`Error updating follow_back for ${repo.owner}:`, updateErr.message);
        } else {
          await logAction('FOLLOW_BACK', repo.id, 'SUCCESS', `Confirmed user ${repo.owner} followed back`);
        }
      } else {
        // Unfollow
        const unfollowedSuccess = await unfollowUser(repo.owner);

        if (unfollowedSuccess) {
          const { error: updateErr } = await supabase
            .from('repos')
            .update({ unfollowed: true, followed: false })
            .eq('id', repo.id);

          if (updateErr) {
            console.error(`Error updating unfollowed status for ${repo.owner}:`, updateErr.message);
          } else {
            await logAction('UNFOLLOW', repo.id, 'SUCCESS', `Unfollowed user ${repo.owner} (no follow-back within 7 days)`);
          }
        } else {
          await logAction('UNFOLLOW', repo.id, 'FAILED', `Failed to unfollow user ${repo.owner}`);
        }
      }

      // Small delay between checks
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log('Cleanup job completed.');
    await logAction('SYSTEM', null, 'SUCCESS', `Cleanup job completed successfully.`);

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

// Start Server
app.listen(PORT, () => {
  console.log(`Worker service is running on port ${PORT}`);
  console.log(`Grade threshold set to: ${GRADE_THRESHOLD}`);
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
