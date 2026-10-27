import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { searchRecentRepos, fetchRepoReadme, starRepo, followUser, unfollowUser, checkIfFollowsBack, checkOwnerProfile, unstarRepo, getGitHubFollowing, getGitHubFollowers, getGitHubFollowersDetails, getAuthenticatedUserStats, FatalGitHubAuthError, FatalGitHubRateLimitError, setRuntimeGitHubCredentials, fetchCandidateDetails } from './github';
import { gradeCandidateProfile, calculateDemoEquivalentScore, FatalAiQuotaError, isAiQuotaOrAuthError } from './nvidia';
import { supabase, isProfileGraded, saveProfile, logAction, fetchSystemSettings, SystemRuntimeConfig, fetchAllRows, DEFAULT_RUNTIME_CONFIG, getFollowsTodayCount } from './supabase';
import { sendIncidentEmail } from './email';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;
const WORKER_SECRET = process.env.WORKER_SECRET;
if (!WORKER_SECRET || WORKER_SECRET === 'dev_secret') {
  console.error('FATAL: WORKER_SECRET env var is missing or still set to dev_secret. Set a strong secret and restart.');
  process.exit(1);
}
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;

const TOPICS = ['ai', 'machine-learning', 'llm', 'flutter', 'nodejs', 'python'];

let isJobRunning = false;
let lastRun: string | null = null;
let nextScheduledRunTime: string | null = null;
let consecutiveFailures = 0;
const SCHEDULER_INTERVAL_MINUTES = 60;

function updateNextRunTime() {
  const next = new Date(Date.now() + SCHEDULER_INTERVAL_MINUTES * 60 * 1000);
  nextScheduledRunTime = next.toISOString();
}

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



async function runAutomationJob(isManual: boolean = false) {
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
    const config = await fetchSystemSettings();
    if (!isManual && config.is_paused) {
      console.log('Worker is currently paused via system settings. Skipping automated run.');
      await logAction('SYSTEM', null, 'SUCCESS', 'Worker is paused via settings. Skipped automated cycle.');
      return { status: 'skipped', reason: 'worker_paused' };
    }
    console.log(`Loaded runtime settings: maxProfilesPerRun=${config.maxProfilesPerRun}, gradeThreshold=${config.gradeThreshold}, activeWorkingHours=${config.activeWorkingHours}, cronFrequency=${config.cronFrequency}h`);

    // Dynamic Cron Frequency Gating: Check interval since last run (unless manual trigger)
    if (!isManual && config.cronFrequency && config.cronFrequency > 0) {
      try {
        const { data: lastRunEntry } = await supabase
          .from('run_summary')
          .select('ran_at')
          .order('ran_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastRunEntry && lastRunEntry.ran_at) {
          const msSinceLastRun = Date.now() - new Date(lastRunEntry.ran_at).getTime();
          const requiredIntervalMs = config.cronFrequency * 60 * 60 * 1000 - (5 * 60 * 1000); // 5 min clock-drift tolerance
          if (msSinceLastRun < requiredIntervalMs) {
            const hoursElapsed = (msSinceLastRun / (60 * 60 * 1000)).toFixed(1);
            console.log(`Frequency gate: Last run was ${hoursElapsed}h ago. Configured frequency is every ${config.cronFrequency}h. Skipping cycle.`);
            return { status: 'skipped', reason: 'frequency_gated', hoursElapsed };
          }
        }
      } catch (gateErr: any) {
        console.warn('Could not verify last run timestamp for frequency gating:', gateErr.message || gateErr);
      }
    }

    // Synchronize dynamic credentials from DB settings if provided
    if (config.githubToken) {
      setRuntimeGitHubCredentials(config.githubToken);
    }

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
          await logAction('SYSTEM', null, 'SUCCESS', `Skipped scheduled run — outside active operating window (${config.activeWorkingHours})`);
          return { status: 'skipped', reason: 'outside_working_hours' };
        }
      }
    }

    await logAction('SYSTEM', null, 'SUCCESS', `Automation job started (${isManual ? 'Manual' : 'Scheduled'})`);

    const liveFollowingList = await getGitHubFollowing().catch((err: any) => {
      if (err instanceof FatalGitHubAuthError) throw err;
      return [];
    });
    const liveFollowingSet = new Set(liveFollowingList.map(u => u.toLowerCase()));

    const repos = await searchRecentRepos(TOPICS);
    stats.discovered = repos.length;

    // Deduplicate candidate owners discovered from repos search
    const uniqueCandidatesMap = new Map<string, { topic: string; repoName: string }>();
    for (const r of repos) {
      const lower = r.owner.toLowerCase();
      if (!uniqueCandidatesMap.has(lower)) {
        uniqueCandidatesMap.set(lower, {
          topic: r.topics?.[0] || 'open-source',
          repoName: r.name,
        });
      }
    }

    console.log(`Discovered ${uniqueCandidatesMap.size} unique candidate owners across ${repos.length} search hits.`);

    for (const [candidateOwnerLower, meta] of uniqueCandidatesMap.entries()) {
      // 1. Check if user is self
      if (GITHUB_USERNAME && candidateOwnerLower === GITHUB_USERNAME.toLowerCase()) {
        console.log(`Skipping profile @${candidateOwnerLower} — own account.`);
        stats.skipped++;
        continue;
      }

      // 2. Check if user is already followed on GitHub
      if (liveFollowingSet.has(candidateOwnerLower)) {
        console.log(`Skipping profile @${candidateOwnerLower} — already followed on GitHub.`);
        stats.skipped++;
        continue;
      }

      // 3. Check 7-day evaluation cooldown in profiles table
      const graded = await isProfileGraded(candidateOwnerLower);
      if (graded) {
        console.log(`Skipping profile @${candidateOwnerLower} — already evaluated within 7-day cooldown.`);
        stats.alreadyGraded++;
        continue;
      }

      // 4. Enforce run caps & daily limits before evaluating
      const followsToday = await getFollowsTodayCount();
      const effectiveFollowsToday = followsToday + stats.followed;
      if (effectiveFollowsToday >= config.dailyFollowLimit) {
        console.log('Daily follow limit reached (' + effectiveFollowsToday + ' follows today, limit: ' + config.dailyFollowLimit + '). Stopping worker run.');
        await logAction('SYSTEM', null, 'SUCCESS', 'Daily follow limit reached (' + effectiveFollowsToday + ' followed today, limit: ' + config.dailyFollowLimit + '). Halted.');
        break;
      }
      if (stats.followed >= config.maxProfilesPerRun) {
        console.log('Follow limit reached for this run (' + stats.followed + '/' + config.maxProfilesPerRun + '). Stopping evaluation.');
        break;
      }

      // Check if profile exists and was previously followed or unfollowed
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('owner, followed, follow_back, unfollowed')
        .ilike('owner', candidateOwnerLower.replace(/[_%]/g, '\\$&'))
        .maybeSingle();

      if (existingProfile) {
        if (existingProfile.followed || existingProfile.follow_back) {
          console.log(`Skipping profile @${candidateOwnerLower} — already active/mutual in database.`);
          stats.skipped++;
          continue;
        }
        if (existingProfile.unfollowed) {
          console.log(`Skipping profile @${candidateOwnerLower} — previously unfollowed. Respecting cooldown.`);
          stats.skipped++;
          continue;
        }
      }

      // 5. Pre-filter owner targeting before spending LLM tokens
      const profileCheck = await checkOwnerProfile(candidateOwnerLower, config);
      if (!profileCheck.shouldFollow) {
        console.log(`Skipping profile @${candidateOwnerLower} — filter: ${profileCheck.skipReason}`);
        stats.skipped++;
        const skipReason = `Targeting filter: ${profileCheck.skipReason}`;
        await logAction('SKIP_FOLLOW', candidateOwnerLower, 'SUCCESS', `Skipped @${candidateOwnerLower}: ${profileCheck.skipReason}`);
        await saveProfile(
          {
            owner: candidateOwnerLower,
            bio: profileCheck.profile?.bio ?? null,
            followers_count: profileCheck.profile?.followers ?? 0,
            following_count: profileCheck.profile?.following ?? 0,
            account_created_at: profileCheck.profile?.created_at ?? null,
            found_by: `topic:${meta.topic}`,
            grade: 0,
            reason: skipReason,
          },
          false,
          true,
          skipReason
        );
        continue;
      }

      // 6. Fetch full candidate telemetry (top 3 repos, languages, recent activity)
      console.log(`Fetching full telemetry for candidate @${candidateOwnerLower}...`);
      const telemetry = await fetchCandidateDetails(candidateOwnerLower);
      if (!telemetry) {
        console.warn(`Could not retrieve telemetry for @${candidateOwnerLower}. Skipping.`);
        stats.skipped++;
        continue;
      }

      // 7. AI Profile Evaluation (Llama 3.3 / Groq / NVIDIA)
      let grading: { grade: number; reason: string };
      try {
        grading = await gradeCandidateProfile(
          {
            owner: telemetry.owner,
            display_name: telemetry.display_name,
            bio: telemetry.bio,
            followers_count: telemetry.followers_count,
            following_count: telemetry.following_count,
            public_repos_count: telemetry.public_repos_count,
            languages: telemetry.languages,
            top_repos: telemetry.top_repos,
          },
          config.systemPrompt
        );
        stats.graded++;
      } catch (aiErr: any) {
        if (aiErr instanceof FatalAiQuotaError || isAiQuotaOrAuthError(aiErr)) {
          const loudMsg = `AI evaluation paused: ${aiErr.message || 'API keys expired or quota exceeded'}. Continuing with unfollow cleanup.`;
          console.warn(`[AI EVALUATION NOTICE] ${loudMsg}`);
          await logFatalErrorOrWarn(loudMsg, 'ERROR');
          await logAction('SYSTEM', null, 'ERROR', loudMsg);
          break;
        }
        console.error(`Unexpected grading error for @${candidateOwnerLower}:`, aiErr.message || aiErr);
        continue;
      }

      console.log(`Candidate @${telemetry.owner} | Score: ${grading.grade}/100 | Reason: ${grading.reason}`);

      let followed = false;

      // 8. Follow candidate only if score >= 60 (strictly threshold based evaluation)
      const effectiveThreshold = config.gradeThreshold <= 10 ? config.gradeThreshold * 10 : config.gradeThreshold;
      const passesThreshold = grading.grade >= Math.max(60, effectiveThreshold);

      if (passesThreshold) {
        const followsToday = await getFollowsTodayCount();
        const effectiveFollowsToday = followsToday + stats.followed;
        if (effectiveFollowsToday >= config.dailyFollowLimit) {
          console.log(`Daily follow limit of ${config.dailyFollowLimit} reached (${effectiveFollowsToday} follows today). Stopping follows.`);
          await logAction('SYSTEM', null, 'SUCCESS', `Daily follow limit of ${config.dailyFollowLimit} reached (${effectiveFollowsToday} follows today). Stopping.`);
          break;
        }
        if (stats.followed >= config.maxProfilesPerRun) {
          console.log(`Run limit of ${config.maxProfilesPerRun} reached (${stats.followed} followed). Stopping follows.`);
          break;
        }

        console.log(`Following user @${telemetry.owner} (Score: ${grading.grade})...`);
        const followSuccess = await followUser(telemetry.owner);
        if (followSuccess) {
          followed = true;
          stats.followed++;
          // Single unified follow log immediately after evaluation & follow execution
          await logAction(
            'FOLLOW',
            telemetry.owner,
            'SUCCESS',
            `evaluated and followed @${telemetry.owner} (Score: ${grading.grade}/100)`
          );

          // Star candidate's top repository only if followed
          if (telemetry.top_repos && telemetry.top_repos.length > 0 && stats.starred < config.maxProfilesPerRun) {
            const topProject = telemetry.top_repos[0];
            try {
              // Gentle pause before starring
              await new Promise((resolve) => setTimeout(resolve, 1000));
              const starSuccess = await starRepo(telemetry.owner, topProject.name);
              if (starSuccess) {
                stats.starred++;
                await logAction(
                  'STAR',
                  telemetry.owner,
                  'SUCCESS',
                  `starred @${telemetry.owner} repo's (${topProject.name})`
                );
              }
            } catch (starErr: any) {
              console.debug(`Could not star top repo for ${telemetry.owner}:`, starErr.message || starErr);
            }
          }
        } else {
          console.warn(`Failed to follow user @${telemetry.owner}`);
          await logAction(
            'FOLLOW',
            telemetry.owner,
            'FAILED',
            `evaluated and failed to follow @${telemetry.owner} (Score: ${grading.grade}/100)`
          );
        }
      } else {
        // Score is less than 60 / threshold -> evaluated and skipped
        console.log(`Skipping candidate @${telemetry.owner} — score ${grading.grade} < 60 threshold`);
        await logAction(
          'SKIP_FOLLOW',
          telemetry.owner,
          'SUCCESS',
          `evaluated and skipped @${telemetry.owner} (Score: ${grading.grade}/100)`
        );
      }

      // 9. Save candidate profile to profiles table
      const isCandidateSkipped = !followed;
      const skipReason = isCandidateSkipped
        ? `Grade ${grading.grade} < 60: ${grading.reason}`
        : null;

      await saveProfile(
        {
          owner: telemetry.owner,
          display_name: telemetry.display_name,
          avatar_url: telemetry.avatar_url,
          bio: telemetry.bio,
          followers_count: telemetry.followers_count,
          following_count: telemetry.following_count,
          public_repos_count: telemetry.public_repos_count,
          account_created_at: telemetry.account_created_at,
          account_age_years: telemetry.account_age_years,
          last_pushed_at: telemetry.last_pushed_at,
          top_repos: telemetry.top_repos,
          languages: telemetry.languages,
          found_by: `topic:${meta.topic}`,
          grade: grading.grade,
          reason: isCandidateSkipped ? skipReason : grading.reason,
          ai_evaluation: {
            grade: grading.grade,
            reason: grading.reason,
            evaluated_at: new Date().toISOString(),
          },
        },
        followed,
        isCandidateSkipped,
        skipReason
      );

      // Pacing pause between candidate evaluations
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log('FollowMe job completed successfully.', stats);
    await logAction(
      'SYSTEM',
      null,
      'SUCCESS',
      `Automation job finished. Graded ${stats.graded} candidates. Followed: ${stats.followed}, Skipped: ${stats.skipped}`
    );

    // Run mutuals sync first so follow_back flags are fresh before recording summary & cleanup
    let newMutualsFound = 0;
    try {
      const syncRes = await syncMutuals();
      if (syncRes) {
        newMutualsFound = syncRes.inboundCount || 0;
      }
    } catch (syncErr: any) {
      console.error('Error running mutuals sync before cleanup:', syncErr.message || syncErr);
    }

    // Write to run_summary at the end of the main evaluation job
    try {
      await supabase.from('run_summary').insert({
        profiles_followed: stats.followed,
        profiles_unfollowed: 0,
        repos_starred: stats.starred,
        mutuals_found: newMutualsFound,
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
  } catch (err: any) {
    stats.failed++;
    console.error('Error during automated run:', err.message || err);

    const config = await fetchSystemSettings().catch(() => DEFAULT_RUNTIME_CONFIG);
    const recipient = config.recipientEmail || process.env.NOTIFICATION_EMAIL || process.env.RECIPIENT_EMAIL;

    // SCENARIO 1: GITHUB PAT EXPIRED OR INVALID (401 Bad credentials)
    if (err instanceof FatalGitHubAuthError || (err.message && err.message.toLowerCase().includes('bad credentials')) || err.statusCode === 401) {
      console.error('[CRITICAL] GitHub Personal Access Token expired or invalid. Exiting run cleanly without retrying.');
      await logFatalErrorOrWarn(`GitHub PAT expired/invalid: ${err.message}`, 'ERROR');

      if (recipient) {
        await sendIncidentEmail({
          incidentType: 'GITHUB_AUTH_EXPIRED',
          severity: 'CRITICAL',
          title: 'GitHub Personal Access Token Expired',
          summary: 'FollowMe has detected that your configured GitHub Personal Access Token (PAT) has expired or been revoked. As a defensive measure, all automated background actions (repository discovery, grading, starring, and following) have been immediately suspended to prevent errors.',
          details: {
            'Service Status': 'Suspended (Awaiting Valid Credentials)',
            'HTTP Response': '401 Unauthorized / Bad credentials',
            'Worker Host': process.env.RENDER_SERVICE_NAME || 'Render Worker',
            'Action Needed': 'Regenerate token with scopes: public_repo, user:follow, read:user',
          },
          actionUrl: 'https://github.com/settings/tokens/new',
          actionText: 'Generate New GitHub Token →',
          recipient,
          resendApiKey: config.resendApiKey,
          fromDomain: config.fromDomain,
          supabaseClient: supabase,
        });
      }

      // Exit cleanly: no retry storm, no crash
      return { status: 'failed_auth', error: 'GitHub PAT expired' };
    }

    // SCENARIO 2: AI MODEL QUOTA OR CREDITS EXHAUSTED (402, 429, FatalAiQuotaError)
    if (err instanceof FatalAiQuotaError || isAiQuotaOrAuthError(err)) {
      console.error('[CRITICAL] AI Model credits exhausted or quota exceeded. Ceasing AI operations cleanly.');
      await logFatalErrorOrWarn(`AI Quota/Auth exhausted: ${err.message}`, 'ERROR');

      if (recipient) {
        await sendIncidentEmail({
          incidentType: 'AI_QUOTA_EXHAUSTED',
          severity: 'CRITICAL',
          title: 'AI LLM API Quota Exhausted',
          summary: 'FollowMe was unable to grade repositories because your NVIDIA NIM or Groq API key has run out of credits, exceeded its rate limit, or expired. Background evaluation has been safely paused.',
          details: {
            'Service Status': 'Grading Paused (Quota Exceeded)',
            'Error Detail': err.message,
            'Provider': process.env.NVIDIA_API_KEY ? 'NVIDIA NIM' : 'Groq',
          },
          actionUrl: 'https://build.nvidia.com/',
          actionText: 'Review NVIDIA NIM Quota →',
          recipient,
          resendApiKey: config.resendApiKey,
          fromDomain: config.fromDomain,
          supabaseClient: supabase,
        });
      }

      // Exit cleanly: no infinite retry storm
      return { status: 'failed_ai_quota', error: 'AI credits exhausted' };
    }

    // SCENARIO 3: GITHUB RATE LIMIT REACHED (403 Abuse / Secondary rate limit)
    if (err instanceof FatalGitHubRateLimitError || (err.message && err.message.toLowerCase().includes('rate limit'))) {
      console.warn('[WARNING] GitHub secondary rate limit hit. Pausing worker until reset.');
      await logFatalErrorOrWarn(`GitHub rate limit hit: ${err.message}`, 'WARN');

      if (recipient) {
        await sendIncidentEmail({
          incidentType: 'GITHUB_RATE_LIMITED',
          severity: 'WARNING',
          title: 'GitHub API Rate Limit Wall Hit',
          summary: 'FollowMe has reached the GitHub API rate limit threshold or encountered a secondary anti-abuse restriction. Background calls have been throttled until the quota window resets.',
          details: {
            'Service Status': 'Throttled (Temporary)',
            'Reset Epoch': err.resetTime || 'Within 60 minutes',
            'Recommendation': 'Ensure maxProfilesPerRun and dailyFollowLimit are within safe thresholds.',
          },
          recipient,
          resendApiKey: config.resendApiKey,
          fromDomain: config.fromDomain,
          supabaseClient: supabase,
        });
      }

      return { status: 'rate_limited', error: 'GitHub rate limit exceeded' };
    }

    // GENERAL RECOVERABLE ERROR (Network blip, DB blip)
    consecutiveFailures++;
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

  // Run asynchronously so endpoint doesn't timeout (with isManual = true to bypass schedule hours)
  runAutomationJob(true).catch(console.error);

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
      
      // Chunk deletions by 200 to prevent HTTP 414 URI Too Long errors
      for (let i = 0; i < idsToDelete.length; i += 200) {
        const chunk = idsToDelete.slice(i, i + 200);
        const { error: delErr } = await supabase
          .from('logs')
          .delete()
          .in('id', chunk);

        if (delErr) {
          console.error('Error deleting old logs chunk:', delErr.message);
          return res.status(500).json({ success: false, error: delErr.message });
        }
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
      .from('profiles')
      .delete()
      .eq('followed', false)
      .eq('unfollowed', false)
      .eq('follow_back', false)
      .eq('follow_skipped', true)
      .select('owner');

    if (error) {
      console.error('Error clearing stale profiles:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    const count = data ? data.length : 0;
    await logAction('SYSTEM', null, 'SUCCESS', 'Cleared ' + count + ' stale profiles.');
    return res.json({ success: true, message: 'Successfully cleared ' + count + ' stale profiles.' });
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
      const escapedOwner = owner.replace(/[_%]/g, '\\$&');
      const { error } = await supabase
        .from('profiles')
        .update({ starred: true })
        .ilike('owner', escapedOwner);

      if (error) {
        console.error(`Error updating DB after star for ${owner}/${repo}:`, error.message);
      }

      await logAction('STAR', owner, 'SUCCESS', `Manually starred repository ${owner}/${repo}`);
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
    const escapedUsername = username.replace(/[_%]/g, '\\$&');
    const { data, error } = await supabase
      .from('profiles')
      .delete()
      .ilike('owner', escapedUsername);

    if (error) {
      console.error(`Error deleting profile ${username}:`, error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    await logAction('SYSTEM', username, 'SUCCESS', `Manually deleted profile for ${username}`);
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
      const escapedOwner = owner.replace(/[_%]/g, '\\$&');
      const { error } = await supabase
        .from('profiles')
        .update({ starred: false })
        .ilike('owner', escapedOwner);

      if (error) {
        console.error(`Error updating DB after unstar for ${owner}/${repo}:`, error.message);
      }

      await logAction('UNSTAR', owner, 'SUCCESS', `Manually unstarred repository ${owner}/${repo}`);
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
      const escapedUsername = username.replace(/[_%]/g, '\\$&');
      const { error } = await supabase
        .from('profiles')
        .update({ followed: true, unfollowed: false, followed_at: new Date().toISOString() })
        .ilike('owner', escapedUsername);

      if (error) {
        console.error(`Error updating DB after follow for ${username}:`, error.message);
      }

      await logAction('FOLLOW', username, 'SUCCESS', `Manually followed user ${username}`);
      return res.json({ success: true, message: `Successfully followed ${username}` });
    } else {
      return res.status(500).json({ success: false, error: `Failed to follow user ${username}` });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error manual following' });
  }
});

// POST /unfollow

// POST /rescore - AI Re-score an existing candidate on demand
app.post('/rescore', async (req: Request, res: Response) => {
  const authHeader = req.headers['x-worker-secret'] || req.body?.secret;
  if (authHeader !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
  }

  const { owner } = req.body;
  if (!owner) {
    return res.status(400).json({ error: 'Missing owner parameter' });
  }

  try {
    const telemetry = await fetchCandidateDetails(owner.toLowerCase());
    if (!telemetry) {
      return res.status(404).json({ error: 'Could not fetch candidate telemetry from GitHub' });
    }

    // Strict deterministic re-scoring synchronized with demo algorithm
    const candidateInput = {
      owner: telemetry.owner,
      display_name: telemetry.display_name,
      bio: telemetry.bio,
      followers_count: telemetry.followers_count,
      following_count: telemetry.following_count,
      public_repos_count: telemetry.public_repos_count,
      languages: telemetry.languages,
      top_repos: telemetry.top_repos,
    };
    const grading = calculateDemoEquivalentScore(candidateInput);

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        grade: grading.grade,
        reason: grading.reason,
        ai_evaluation: {
          grade: grading.grade,
          reason: grading.reason,
          subs: grading.subs,
          evaluated_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .ilike('owner', owner.replace(/[_%]/g, '\\$&'));

    if (updateErr) {
      return res.status(500).json({ error: updateErr.message });
    }

    await logAction('GRADE', owner, 'SUCCESS', `Re-scored @${owner} with AI. New Score: ${grading.grade}/100. ${grading.reason}`);

    return res.json({
      success: true,
      grade: grading.grade,
      reason: grading.reason,
      subs: grading.subs,
    });
  } catch (err: any) {
    console.error('Error during AI rescore:', err);
    return res.status(500).json({ error: err.message || 'Internal AI rescore error' });
  }
});

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
      const escapedUsername = username.replace(/[_%]/g, '\\$&');
      const { error } = await supabase
        .from('profiles')
        .update({ followed: false, unfollowed: true })
        .ilike('owner', escapedUsername);

      if (error) {
        console.error(`Error updating DB after unfollow for ${username}:`, error.message);
      }

      await logAction('UNFOLLOW', username, 'SUCCESS', `Manually unfollowed user ${username}`);
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
    // 1. Fetch all GitHub followers with details (paginated)
    const followers = await getGitHubFollowersDetails();
    const followerSet = new Set(followers.map(u => u.login.toLowerCase()));
    console.log(`Fetched ${followers.length} GitHub followers for mutuals sync.`);

    // 2. Fetch all profiles in Supabase profiles table (paginated)
    const allProfiles = await fetchAllRows<{ owner: string }>('profiles', 'owner');

    const dbOwnerSet = new Set<string>();
    (allProfiles || []).forEach(p => dbOwnerSet.add(p.owner.toLowerCase()));

    // 3. Separate into mutual (follows back) vs non-mutual
    const mutualOwners: string[] = [];
    const nonMutualOwners: string[] = [];

    for (const profile of (allProfiles || [])) {
      if (followerSet.has(profile.owner.toLowerCase())) {
        mutualOwners.push(profile.owner);
      } else {
        nonMutualOwners.push(profile.owner);
      }
    }

    // 4. Batch update follow_back = true for mutual owners (chunked by 200)
    for (let i = 0; i < mutualOwners.length; i += 200) {
      const chunk = mutualOwners.slice(i, i + 200);
      const { error: mutualErr } = await supabase
        .from('profiles')
        .update({ follow_back: true })
        .in('owner', chunk);

      if (mutualErr) {
        console.error('Error updating follow_back=true for mutuals chunk:', mutualErr.message);
      }
    }

    // 5. Batch update follow_back = false for non-mutual owners (chunked by 200)
    for (let i = 0; i < nonMutualOwners.length; i += 200) {
      const chunk = nonMutualOwners.slice(i, i + 200);
      const { error: nonMutualErr } = await supabase
        .from('profiles')
        .update({ follow_back: false })
        .in('owner', chunk);

      if (nonMutualErr) {
        console.error('Error updating follow_back=false for non-mutuals chunk:', nonMutualErr.message);
      }
    }

    // 6. Discover missing organic/inbound followers and insert them
    const missingInboundRows: any[] = [];
    for (const follower of followers) {
      if (!dbOwnerSet.has(follower.login.toLowerCase())) {
        missingInboundRows.push({
          owner: follower.login,
          display_name: follower.login,
          avatar_url: follower.avatar_url || `https://github.com/${follower.login}.png`,
          bio: null,
          followers_count: null,
          following_count: null,
          public_repos_count: null,
          grade: 5,
                    followed: false,
          starred: false,
          followed_at: null,
          follow_back: true,
          unfollowed: false,
          follow_skipped: false,
          follow_skip_reason: null,
          whitelisted: false,
          found_by: 'Organic Inbound Follower',
          top_repos: [],
          languages: [],
        });
      }
    }

    if (missingInboundRows.length > 0) {
      for (let i = 0; i < missingInboundRows.length; i += 200) {
        const chunk = missingInboundRows.slice(i, i + 200);
        await supabase
          .from('profiles')
          .upsert(chunk, { onConflict: 'owner' });
      }
      console.log(`Inserted ${missingInboundRows.length} missing inbound followers into profiles.`);
    }

    await logAction('SYSTEM', null, 'SUCCESS', `Mutuals sync complete. Mutuals: ${mutualOwners.length}, Inbound added: ${missingInboundRows.length}`);
    console.log('Mutuals sync completed successfully.');
    return { mutualsCount: mutualOwners.length, inboundCount: missingInboundRows.length };
  } catch (err: any) {
    console.error('Error in syncMutuals:', err.message || err);
    await logAction('SYSTEM', null, 'FAILED', `syncMutuals failed: ${err.message || 'Unknown error'}`);
    return { mutualsCount: 0, inboundCount: 0 };
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

    // Fetch followed profiles from Supabase profiles table
    const dbProfiles = await fetchAllRows<{ owner: string; followed_at: string | null; whitelisted?: boolean }>(
      'profiles',
      'owner, followed_at, whitelisted',
      q => q.eq('followed', true)
    );

    const followedAtMap = new Map<string, number>();
    const isFollowedByBot = new Set<string>();
    const whitelistedSet = new Set<string>();
    if (dbProfiles) {
      for (const p of dbProfiles) {
        const o = p.owner.toLowerCase();
        isFollowedByBot.add(o);
        if (p.whitelisted) {
          whitelistedSet.add(o);
        }
        if (p.followed_at) {
          followedAtMap.set(o, new Date(p.followed_at).getTime());
        }
      }
    }

    // Dynamic grace period cutoff from settings
    const graceDays = config.unfollowGracePeriod && config.unfollowGracePeriod > 0 ? config.unfollowGracePeriod : 7;
    const gracePeriodCutoff = Date.now() - graceDays * 24 * 60 * 60 * 1000;

    // Filter: allow non-followers who are past the grace period AND were followed by the bot (excluding whitelisted)
    const eligibleUnfollows = nonFollowbacks.filter(user => {
      const lower = user.toLowerCase();
      // Shield whitelisted profiles explicitly saved by user
      if (whitelistedSet.has(lower)) {
        return false;
      }
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

        const escapedUsername = username.replace(/[_%]/g, '\\$&');
        // Update database to unfollowed: true, followed: false
        await supabase
          .from('profiles')
          .update({ followed: false, unfollowed: true })
          .ilike('owner', escapedUsername);

        await logAction('UNFOLLOW_RATIO', username, 'SUCCESS', `Auto-unfollowed ${username} to balance following/followers ratio.`);
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

    const eligibleProfiles = await fetchAllRows<any>(
      'profiles',
      '*',
      q => q
        .eq('follow_back', false)
        .eq('unfollowed', false)
        .eq('followed', true)
        .neq('whitelisted', true)
        .lt('followed_at', cutoffDate)
    );

    if (!eligibleProfiles || eligibleProfiles.length === 0) {
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

    console.log(`Found ${eligibleProfiles.length} unique users past the ${graceDays}-day grace period to unfollow.`);

    for (const candidate of eligibleProfiles) {
      const username = candidate.owner;

      // Unfollow on GitHub
      const unfollowedSuccess = await unfollowUser(username);

      if (unfollowedSuccess) {
        unfollowedCount++;
        const escapedOwner = username.replace(/[_%]/g, '\\$&');
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ unfollowed: true, followed: false })
          .ilike('owner', escapedOwner);

        if (updateErr) {
          console.error(`Error updating unfollowed status for ${username}:`, updateErr.message);
        } else {
          await logAction('UNFOLLOW', username, 'SUCCESS', `Unfollowed user ${username} (no follow-back within ${graceDays} days)`);
        }
      } else {
        await logAction('UNFOLLOW', username, 'FAILED', `Failed to unfollow user ${username}`);
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
    const allDbProfiles = await fetchAllRows<{ owner: string; followed: boolean; unfollowed: boolean }>(
      'profiles',
      'owner, followed, unfollowed'
    );

    const dbOwnerSet = new Set<string>();
    (allDbProfiles || []).forEach(p => dbOwnerSet.add(p.owner.toLowerCase()));

    const ownersToMarkUnfollowed: string[] = [];
    const ownersToRestoreFollowed: string[] = [];
    const missingFollowingRows: any[] = [];

    // 1. Identify users you follow on GitHub who aren't in the database yet
    for (const login of actualFollowingList) {
      const lower = login.toLowerCase();
      if (!dbOwnerSet.has(lower)) {
        missingFollowingRows.push({
          owner: login,
          display_name: login,
          avatar_url: `https://github.com/${login}.png`,
          bio: null,
          followers_count: null,
          following_count: null,
          public_repos_count: null,
          grade: 60,
          followed: true,
          starred: false,
          followed_at: new Date().toISOString(),
          follow_back: false,
          unfollowed: false,
          follow_skipped: false,
          follow_skip_reason: null,
          whitelisted: false,
          found_by: 'Existing GitHub Following',
          top_repos: [],
          languages: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    for (const p of (allDbProfiles || [])) {
      const isActuallyFollowed = actualFollowingSet.has(p.owner.toLowerCase());
      if (!isActuallyFollowed) {
        if (p.followed) ownersToMarkUnfollowed.push(p.owner);
      } else {
        if (!p.followed || p.unfollowed) {
          ownersToRestoreFollowed.push(p.owner);
        }
      }
    }

    console.log(`Reconciliation: ${missingFollowingRows.length} missing to insert, ${ownersToMarkUnfollowed.length} to mark unfollowed, ${ownersToRestoreFollowed.length} to restore to active followed.`);

    // Insert missing following profiles into database
    if (missingFollowingRows.length > 0) {
      for (let i = 0; i < missingFollowingRows.length; i += 200) {
        const chunk = missingFollowingRows.slice(i, i + 200);
        const { error: insertErr } = await supabase
          .from('profiles')
          .upsert(chunk, { onConflict: 'owner' });

        if (insertErr) {
          console.error('Error inserting missing following chunk during reconciliation:', insertErr.message);
        }
      }
      console.log(`Successfully inserted ${missingFollowingRows.length} existing following into profiles table.`);
    }

    if (ownersToMarkUnfollowed.length > 0) {
      for (let i = 0; i < ownersToMarkUnfollowed.length; i += 200) {
        const chunk = ownersToMarkUnfollowed.slice(i, i + 200);
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ followed: false, unfollowed: true })
          .in('owner', chunk);

        if (updateErr) {
          console.error('Error updating unfollowed during reconciliation chunk:', updateErr.message);
        }
      }
      console.log(`Successfully marked ${ownersToMarkUnfollowed.length} profiles as unfollowed.`);
    }

    if (ownersToRestoreFollowed.length > 0) {
      for (let i = 0; i < ownersToRestoreFollowed.length; i += 200) {
        const chunk = ownersToRestoreFollowed.slice(i, i + 200);
        const { error: restoreErr } = await supabase
          .from('profiles')
          .update({ followed: true, unfollowed: false })
          .in('owner', chunk);

        if (restoreErr) {
          console.error('Error restoring profiles during reconciliation chunk:', restoreErr.message);
        }
      }
      console.log(`Successfully restored ${ownersToRestoreFollowed.length} profiles to followed = true, unfollowed = false.`);
    }

    await logAction('SYSTEM', null, 'SUCCESS', `Reconciliation complete. Live following: ${actualFollowingList.length}. Marked unfollowed: ${ownersToMarkUnfollowed.length}, Restored active: ${ownersToRestoreFollowed.length}`);
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
