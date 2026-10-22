import OpenAI from 'openai';
import dotenv from 'dotenv';
import { RepoMetadata } from './types';

dotenv.config();

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!NVIDIA_API_KEY && !GROQ_API_KEY) {
  console.warn('⚠️ Missing both NVIDIA_API_KEY and GROQ_API_KEY. AI grading will fail.');
}

const nvidiaClient = NVIDIA_API_KEY
  ? new OpenAI({
      apiKey: NVIDIA_API_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    })
  : null;

const groqClient = GROQ_API_KEY
  ? new OpenAI({
      apiKey: GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    })
  : null;

export interface ProfilePillars {
  activity: number;
  codeQuality: number;
  relevance: number;
  reach: number;
}

export interface GradingResult {
  grade: number; // 0-100 composite score
  reason: string;
  subs?: ProfilePillars;
}

export class FatalAiQuotaError extends Error {
  public statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'FatalAiQuotaError';
    this.statusCode = statusCode;
  }
}

export function isAiQuotaOrAuthError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.statusCode || err.response?.status;
  const msg = (err.message || String(err)).toLowerCase();
  return (
    status === 401 ||
    status === 402 ||
    status === 403 ||
    status === 404 ||
    status === 410 ||
    status === 429 ||
    msg.includes('410') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('429') ||
    msg.includes('invalid_api_key') ||
    msg.includes('incorrect api key') ||
    msg.includes('credit') ||
    msg.includes('quota') ||
    msg.includes('unauthorized') ||
    msg.includes('payment required') ||
    msg.includes('payment_required') ||
    msg.includes('billing') ||
    msg.includes('no body') ||
    msg.includes('model not found') ||
    msg.includes('model deprecated') ||
    msg.includes('failed to evaluate')
  );
}

async function tryGradeWithClient(
  client: OpenAI,
  model: string,
  prompt: string,
  providerName: string
): Promise<GradingResult> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.1,
    max_tokens: 350,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error(`${providerName} (${model}) returned an empty response.`);
  }

  // Resilient JSON extraction: strip <think>...</think> tags and find outermost { ... }
  let cleanedContent = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanedContent = jsonMatch[0];
  } else if (cleanedContent.startsWith('```')) {
    cleanedContent = cleanedContent.replace(/^```(json)?/, '').replace(/```$/, '').trim();
  }

  const raw = JSON.parse(cleanedContent) as any;

  // Extract or clamp the 4 sub-scores (20-99 range)
  let activity = Math.round(Number(raw.activity ?? raw.activity_score ?? 60));
  let codeQuality = Math.round(Number(raw.codeQuality ?? raw.code_quality ?? 60));
  let relevance = Math.round(Number(raw.relevance ?? raw.relevance_score ?? 60));
  let reach = Math.round(Number(raw.reach ?? raw.reach_score ?? 60));

  if (isNaN(activity)) activity = 60;
  if (isNaN(codeQuality)) codeQuality = 60;
  if (isNaN(relevance)) relevance = 60;
  if (isNaN(reach)) reach = 60;

  activity = Math.max(15, Math.min(99, activity));
  codeQuality = Math.max(15, Math.min(99, codeQuality));
  relevance = Math.max(15, Math.min(99, relevance));
  reach = Math.max(15, Math.min(99, reach));

  // Canonical composite calculation (matching Demo: 30% activity, 35% code quality, 20% relevance, 15% reach)
  let computedGrade = Math.round(
    (activity * 0.30) + (codeQuality * 0.35) + (relevance * 0.20) + (reach * 0.15)
  );

  // If LLM returned raw grade, respect it within 0-100 range
  if (raw.grade !== undefined && !isNaN(Number(raw.grade))) {
    let parsedGrade = Number(raw.grade);
    // If LLM returned legacy 1-10, scale to 0-100
    if (parsedGrade <= 10 && parsedGrade > 0) {
      parsedGrade = parsedGrade * 10;
    }
    computedGrade = Math.max(0, Math.min(100, Math.round(parsedGrade)));
  }

  return {
    grade: computedGrade,
    reason: raw.reason || `Graded by ${providerName}`,
    subs: {
      activity,
      codeQuality,
      relevance,
      reach,
    },
  };
}

let cachedGroqModel: string | null = null;
let cachedNvidiaModel: string | null = null;

async function getBestModel(client: OpenAI, preferred: string[], isGroq: boolean): Promise<string> {
  if (isGroq && cachedGroqModel) return cachedGroqModel;
  if (!isGroq && cachedNvidiaModel) return cachedNvidiaModel;

  try {
    const list = await client.models.list();
    const modelIds = list.data.map((m) => m.id);
    for (const pref of preferred) {
      if (modelIds.includes(pref)) {
        if (isGroq) cachedGroqModel = pref;
        else cachedNvidiaModel = pref;
        return pref;
      }
    }
    const suitable = modelIds.find(
      (id) =>
        !id.includes('whisper') &&
        !id.includes('guard') &&
        !id.includes('embedding') &&
        !id.includes('tts') &&
        !id.includes('moderation')
    );
    if (suitable) {
      if (isGroq) cachedGroqModel = suitable;
      else cachedNvidiaModel = suitable;
      return suitable;
    }
  } catch {
    // fallback to preferred list
  }

  return preferred[0];
}

export interface CandidateEvaluationInput {
  owner: string;
  display_name?: string | null;
  bio?: string | null;
  followers_count: number;
  following_count: number;
  public_repos_count: number;
  last_pushed_at?: string | null;
  languages?: Array<{ name: string; pct: number }>;
  top_repos?: Array<{
    name: string;
    stars: number;
    language: string | null;
    description: string | null;
    pushed_at?: string | null;
  }>;
}

/**
 * Exact deterministic evaluation logic from Demo Dashboard (Check your GitHub score feature).
 * Evaluates candidate across:
 * - Activity (30% weight): push recency, public repository volume
 * - Code Quality (35% weight): stars, descriptions, top project craftsmanship
 * - Relevance (20% weight): bio clarity & verified languages
 * - Reach (15% weight): organic follower count & follower-to-following ratio
 */
export function calculateDemoEquivalentScore(candidate: CandidateEvaluationInput): GradingResult {
  const repos = candidate.top_repos || [];
  const totalStars = repos.reduce((acc, r) => acc + (r.stars || 0), 0);
  const realBio = (candidate.bio || '').trim();

  // Days since last push
  const now = Date.now();
  let latestPushTs = candidate.last_pushed_at ? new Date(candidate.last_pushed_at).getTime() : 0;
  repos.forEach(r => {
    if (r.pushed_at) {
      const t = new Date(r.pushed_at).getTime();
      if (t > latestPushTs) latestPushTs = t;
    }
  });

  let daysSinceLastPush = 999;
  if (latestPushTs > 0) {
    daysSinceLastPush = Math.max(0, Math.floor((now - latestPushTs) / (1000 * 60 * 60 * 24)));
  }

  // 1. Activity (30% weight)
  let activity = 20;
  if (daysSinceLastPush <= 2) activity += 32;
  else if (daysSinceLastPush <= 7) activity += 24;
  else if (daysSinceLastPush <= 21) activity += 16;
  else if (daysSinceLastPush <= 45) activity += 8;

  const repoCount = candidate.public_repos_count || repos.length;
  if (repoCount >= 30) activity += 40;
  else if (repoCount >= 15) activity += 30;
  else if (repoCount >= 5) activity += 20;
  else if (repoCount >= 2) activity += 10;
  activity = Math.min(96, Math.max(15, activity));

  // 2. Code Quality (35% weight)
  let codeQuality = 25;
  if (totalStars >= 300) codeQuality += 42;
  else if (totalStars >= 100) codeQuality += 34;
  else if (totalStars >= 40) codeQuality += 25;
  else if (totalStars >= 15) codeQuality += 16;
  else if (totalStars >= 3) codeQuality += 8;

  const descCount = repos.filter(r => r.description && r.description.trim().length > 15).length;
  const descRatio = repos.length ? descCount / repos.length : 0;
  if (descRatio >= 0.7) codeQuality += 14;
  else if (descRatio >= 0.4) codeQuality += 7;

  if (repos.length >= 3) codeQuality += 12;
  else if (repos.length <= 1 && totalStars < 5) codeQuality -= 8;
  codeQuality = Math.min(96, Math.max(15, codeQuality));

  // 3. Relevance (20% weight)
  const langList = (candidate.languages || []).map(l => l.name);
  const dynamicLanguages = langList.length > 0 ? langList : ['Code'];

  let relevance = 30;
  if (realBio.length >= 50) relevance += 25;
  else if (realBio.length >= 15) relevance += 15;

  if (dynamicLanguages.length >= 2 && dynamicLanguages.length <= 5) relevance += 20;
  else if (dynamicLanguages.length === 1 && dynamicLanguages[0] !== 'Code') relevance += 10;

  if (repoCount >= 5) relevance += 15;
  else if (repoCount <= 1) relevance -= 8;
  relevance = Math.min(92, Math.max(20, relevance));

  // 4. Reach (15% weight)
  const followers = candidate.followers_count || 0;
  const following = candidate.following_count || 0;
  let reach = 20;
  if (followers >= 1000) reach += 58;
  else if (followers >= 400) reach += 46;
  else if (followers >= 150) reach += 35;
  else if (followers >= 40) reach += 24;
  else if (followers >= 10) reach += 14;
  else if (followers >= 2) reach += 6;

  if (following > 0) {
    const fRatio = followers / following;
    if (fRatio >= 2.0 && followers >= 40) reach += 14;
    else if (fRatio >= 1.0) reach += 8;
    else if (fRatio < 0.3 && following > 80) reach -= 14;
  }
  reach = Math.min(94, Math.max(15, reach));

  const grade = Math.round((activity * 0.3) + (codeQuality * 0.35) + (relevance * 0.2) + (reach * 0.15));

  // Generate short, instant scannable reason (matching Demo Dashboard)
  const isStudent = /student|learning|b\.?tech|college|university|learner/i.test(realBio);
  const isML = /ml|machine learning|data science|ai|analytics|deep learning/i.test(realBio) || dynamicLanguages.includes('Jupyter Notebook');
  const isWeb = /full-stack|frontend|backend|next\.js|react|vue|web/i.test(realBio);
  const mainLangs = dynamicLanguages.filter(l => l !== 'Jupyter Notebook').slice(0, 2).join(' and ') || dynamicLanguages[0] || 'code';

  let reason = '';
  if (grade < 60) {
    if (repoCount === 0) {
      reason = 'No public repositories found; account is currently inactive.';
    } else if (daysSinceLastPush > 60) {
      reason = `No recent public commits in 90 days (${daysSinceLastPush}d since last push).`;
    } else if (following > 100 && followers < 10) {
      reason = 'Asymmetric follow ratio with low public repository engagement.';
    } else if (totalStars === 0) {
      reason = `Early-stage ${mainLangs} exercises with limited original commits or stars.`;
    } else if (daysSinceLastPush > 25) {
      reason = `Infrequent push cadence (${daysSinceLastPush}d ago); below the threshold for queueing.`;
    } else {
      reason = 'Early-stage profile with low community traction and sparse original output.';
    }
  } else if (grade >= 90 || totalStars >= 100) {
    reason = `High-impact open-source contributor with ${totalStars} stars and consistent repo hygiene.`;
  } else if (isStudent && isML) {
    reason = daysSinceLastPush <= 21
      ? `Data science student building active ${mainLangs} projects with steady commits.`
      : `Data science student portfolio; solid fundamentals across ${mainLangs}.`;
  } else if (isStudent) {
    reason = `Student builder actively learning in public across ${mainLangs} repos.`;
  } else if (isML) {
    reason = 'Applied ML and data tooling portfolio with reproducible repositories.';
  } else if (isWeb && totalStars >= 10) {
    reason = `Full-stack portfolio with steady ${mainLangs} commits and clean documentation.`;
  } else if (totalStars >= 15 && daysSinceLastPush <= 21) {
    reason = `Consistent builder with ${totalStars} stars across ${mainLangs} repositories.`;
  } else if (daysSinceLastPush <= 14) {
    reason = 'Active open-source developer with steady commits and healthy repo hygiene.';
  } else if (daysSinceLastPush > 35) {
    reason = 'Solid fundamentals and clean repos, though activity has slowed recently.';
  } else {
    reason = `Active ${mainLangs} developer portfolio with promising original projects.`;
  }

  return {
    grade,
    reason,
    subs: {
      activity,
      codeQuality,
      relevance,
      reach,
    },
  };
}

export async function gradeCandidateProfile(
  candidate: CandidateEvaluationInput,
  customSystemPrompt?: string
): Promise<GradingResult> {
  const topRepoList = (candidate.top_repos || [])
    .map(r => `• ${r.name} (${r.language || 'Code'}, ${r.stars}★): ${r.description || 'No description'}`)
    .join('\n');

  const langList = (candidate.languages || [])
    .map(l => `${l.name} (${l.pct}%)`)
    .join(', ') || 'Various';

  const prompt = `You are an expert software developer assessing GitHub developers.
Evaluate the candidate across 4 key pillars (scores between 20 and 99 each):
1. activity (30%) 2. codeQuality (35%) 3. relevance (20%) 4. reach (15%)
Composite: grade = round((activity * 0.30) + (codeQuality * 0.35) + (relevance * 0.20) + (reach * 0.15))

Developer Details:
- Username: @${candidate.owner}
- Bio: ${candidate.bio || 'None provided'}
- Stats: ${candidate.followers_count} followers, ${candidate.following_count} following, ${candidate.public_repos_count} public repositories
- Languages: ${langList}
- Top Repositories:
${topRepoList || 'None found'}

Return EXACTLY JSON:
{
  "activity": <20-99>,
  "codeQuality": <20-99>,
  "relevance": <20-99>,
  "reach": <20-99>,
  "grade": <0-100>,
  "reason": "<1 short punchy scannable sentence under 12 words>"
}`;

  const errors: string[] = [];

  if (groqClient) {
    const preferredGroq = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
    try {
      const bestModel = await getBestModel(groqClient, preferredGroq, true);
      return await tryGradeWithClient(groqClient, bestModel, prompt, `Groq (${bestModel})`);
    } catch (groqErr: any) {
      errors.push(`Groq: ${groqErr.message}`);
      for (const fallback of preferredGroq) {
        try {
          return await tryGradeWithClient(groqClient, fallback, prompt, `Groq (${fallback})`);
        } catch (fErr: any) {
          errors.push(`Groq (${fallback}): ${fErr.message}`);
        }
      }
    }
  }

  if (nvidiaClient) {
    const preferredNvidia = ['meta/llama-3.1-70b-instruct', 'meta/llama-3.3-70b-instruct'];
    try {
      const bestModel = await getBestModel(nvidiaClient, preferredNvidia, false);
      return await tryGradeWithClient(nvidiaClient, bestModel, prompt, `NVIDIA (${bestModel})`);
    } catch (nvErr: any) {
      errors.push(`NVIDIA: ${nvErr.message}`);
      for (const fallback of preferredNvidia) {
        try {
          return await tryGradeWithClient(nvidiaClient, fallback, prompt, `NVIDIA (${fallback})`);
        } catch (fErr: any) {
          errors.push(`NVIDIA (${fallback}): ${fErr.message}`);
        }
      }
    }
  }

  // Exact demo benchmark synchronization fallback
  console.log(`[AI Evaluator] Using synchronized Demo benchmark scoring for @${candidate.owner}`);
  return calculateDemoEquivalentScore(candidate);
}

export async function gradeRepository(repo: RepoMetadata, customSystemPrompt?: string): Promise<GradingResult> {
  const prompt = `
You are an expert developer evaluating repository ${repo.owner}/${repo.name}.
Grade the project on a scale of 0 to 100 based on originality, usefulness, and README clarity.

Return JSON:
{
  "grade": <integer between 0 and 100>,
  "reason": "<short explanation>"
}
`;

  if (groqClient) {
    try {
      return await tryGradeWithClient(groqClient, 'llama-3.3-70b-versatile', prompt, 'Groq');
    } catch (_) {}
  }
  if (nvidiaClient) {
    try {
      return await tryGradeWithClient(nvidiaClient, 'meta/llama-3.1-70b-instruct', prompt, 'NVIDIA');
    } catch (_) {}
  }
  return { grade: 60, reason: 'Evaluated default' };
}
