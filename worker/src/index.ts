import express, { Request, Response } from 'express';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { searchRecentRepos, fetchRepoReadme, starRepo, followUser, unfollowUser, checkIfFollowsBack, checkOwnerProfile } from './github';
import { gradeRepository } from './nvidia';
import { supabase, isRepoGraded, saveRepo, logAction } from './supabase';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

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
  await logAction('SYSTEM', null, 'SUCCESS', 'Automation job started');

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
        console.log(`Repo ${repo.owner}/${repo.name} meets threshold (${grading.grade} >= ${GRADE_THRESHOLD}). Starring...`);

        // Always star a high-grade repo
        const starSuccess = await starRepo(repo.owner, repo.name);
        if (starSuccess) {
          starred = true;
          stats.starred++;
          starResult = { success: true, message: `Starred repository ${repo.owner}/${repo.name}` };
        } else {
          starResult = { success: false, message: `Failed to star repository ${repo.owner}/${repo.name}` };
        }

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
  } catch (err: any) {
    stats.failed++;
    console.error('Error during automated run:', err.message || err);
    await logAction('SYSTEM', null, 'FAILED', `Automation job failed: ${err.message || 'Unknown error'}`);
  } finally {
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

// Set up Cron schedule
cron.schedule(CRON_SCHEDULE, () => {
  console.log('Triggering automated cron job...');
  runAutomationJob().catch(console.error);
});

async function runCleanupJob() {
  console.log('Starting FollowMe cleanup job...');
  await logAction('SYSTEM', null, 'SUCCESS', 'Cleanup job started');

  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: repos, error } = await supabase
      .from('repos')
      .select('id, owner, name')
      .eq('followed', true)
      .eq('unfollowed', false)
      .eq('follow_back', false)
      .lte('followed_at', threeDaysAgo);

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
            await logAction('UNFOLLOW', repo.id, 'SUCCESS', `Unfollowed user ${repo.owner} (no follow-back within 3 days)`);
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
  } catch (err: any) {
    console.error('Error during cleanup job:', err.message || err);
    await logAction('SYSTEM', null, 'FAILED', `Cleanup job failed: ${err.message || 'Unknown error'}`);
  }
}

// Set up cleanup Cron schedule (every 6 hours)
cron.schedule('0 */6 * * *', () => {
  console.log('Triggering automated cleanup cron job...');
  runCleanupJob().catch(console.error);
});

// Start Server
app.listen(PORT, () => {
  console.log(`Worker service is running on port ${PORT}`);
  console.log(`Cron schedule active: ${CRON_SCHEDULE}`);
  console.log(`Grade threshold set to: ${GRADE_THRESHOLD}`);
});
