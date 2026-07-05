import express, { Request, Response } from 'express';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { searchRecentRepos, fetchRepoReadme, starRepo, followUser } from './github';
import { gradeRepository } from './nvidia';
import { isRepoGraded, saveRepo, logAction } from './supabase';

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

      // 4. Auto follow / star if grade is above or equal to threshold
      if (grading.grade >= GRADE_THRESHOLD) {
        console.log(`Repo ${repo.owner}/${repo.name} meets threshold (${grading.grade} >= ${GRADE_THRESHOLD}). Starring and following...`);
        
        // Star repo
        const starSuccess = await starRepo(repo.owner, repo.name);
        if (starSuccess) {
          starred = true;
          stats.starred++;
          await logAction('STAR', repo.id, 'SUCCESS', `Starred repository ${repo.owner}/${repo.name}`);
        } else {
          await logAction('STAR', repo.id, 'FAILED', `Failed to star repository ${repo.owner}/${repo.name}`);
        }

        // Follow owner
        const followSuccess = await followUser(repo.owner);
        if (followSuccess) {
          followed = true;
          stats.followed++;
          await logAction('FOLLOW', repo.id, 'SUCCESS', `Followed user ${repo.owner}`);
        } else {
          await logAction('FOLLOW', repo.id, 'FAILED', `Failed to follow user ${repo.owner}`);
        }
      }

      // Save repository to database
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
        starred
      );

      await logAction(
        'GRADE',
        repo.id,
        'SUCCESS',
        `Graded repo: ${repo.owner}/${repo.name}. Score: ${grading.grade}. Reason: ${grading.reason}`
      );

      // Sleep 1.5 seconds between repositories to be respectful to APIs and limit rates
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log('FollowMe job completed successfully.', stats);
    await logAction(
      'SYSTEM',
      null,
      'SUCCESS',
      `Automation job finished. Graded ${stats.graded} new repos. Followed: ${stats.followed}, Starred: ${stats.starred}`
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

// Start Server
app.listen(PORT, () => {
  console.log(`Worker service is running on port ${PORT}`);
  console.log(`Cron schedule active: ${CRON_SCHEDULE}`);
  console.log(`Grade threshold set to: ${GRADE_THRESHOLD}`);
});
