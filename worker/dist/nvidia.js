"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FatalAiQuotaError = void 0;
exports.isAiQuotaOrAuthError = isAiQuotaOrAuthError;
exports.gradeCandidateProfile = gradeCandidateProfile;
exports.gradeRepository = gradeRepository;
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!NVIDIA_API_KEY && !GROQ_API_KEY) {
    console.warn('⚠️ Missing both NVIDIA_API_KEY and GROQ_API_KEY. AI grading will fail.');
}
const nvidiaClient = NVIDIA_API_KEY
    ? new openai_1.default({
        apiKey: NVIDIA_API_KEY,
        baseURL: 'https://integrate.api.nvidia.com/v1',
    })
    : null;
const groqClient = GROQ_API_KEY
    ? new openai_1.default({
        apiKey: GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
    })
    : null;
class FatalAiQuotaError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.name = 'FatalAiQuotaError';
        this.statusCode = statusCode;
    }
}
exports.FatalAiQuotaError = FatalAiQuotaError;
function isAiQuotaOrAuthError(err) {
    if (!err)
        return false;
    const status = err.status || err.statusCode || err.response?.status;
    const msg = (err.message || String(err)).toLowerCase();
    return (status === 401 ||
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
        msg.includes('failed to evaluate'));
}
async function tryGradeWithClient(client, model, prompt, providerName) {
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
    }
    else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```(json)?/, '').replace(/```$/, '').trim();
    }
    const raw = JSON.parse(cleanedContent);
    // Extract or clamp the 4 sub-scores (20-99 range)
    let activity = Math.round(Number(raw.activity ?? raw.activity_score ?? 60));
    let codeQuality = Math.round(Number(raw.codeQuality ?? raw.code_quality ?? 60));
    let relevance = Math.round(Number(raw.relevance ?? raw.relevance_score ?? 60));
    let reach = Math.round(Number(raw.reach ?? raw.reach_score ?? 60));
    if (isNaN(activity))
        activity = 60;
    if (isNaN(codeQuality))
        codeQuality = 60;
    if (isNaN(relevance))
        relevance = 60;
    if (isNaN(reach))
        reach = 60;
    activity = Math.max(15, Math.min(99, activity));
    codeQuality = Math.max(15, Math.min(99, codeQuality));
    relevance = Math.max(15, Math.min(99, relevance));
    reach = Math.max(15, Math.min(99, reach));
    // Canonical composite calculation (matching Demo: 30% activity, 35% code quality, 20% relevance, 15% reach)
    let computedGrade = Math.round((activity * 0.30) + (codeQuality * 0.35) + (relevance * 0.20) + (reach * 0.15));
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
let cachedGroqModel = null;
let cachedNvidiaModel = null;
async function getBestModel(client, preferred, isGroq) {
    if (isGroq && cachedGroqModel)
        return cachedGroqModel;
    if (!isGroq && cachedNvidiaModel)
        return cachedNvidiaModel;
    try {
        const list = await client.models.list();
        const modelIds = list.data.map((m) => m.id);
        for (const pref of preferred) {
            if (modelIds.includes(pref)) {
                if (isGroq)
                    cachedGroqModel = pref;
                else
                    cachedNvidiaModel = pref;
                return pref;
            }
        }
        const suitable = modelIds.find((id) => !id.includes('whisper') &&
            !id.includes('guard') &&
            !id.includes('embedding') &&
            !id.includes('tts') &&
            !id.includes('moderation'));
        if (suitable) {
            if (isGroq)
                cachedGroqModel = suitable;
            else
                cachedNvidiaModel = suitable;
            return suitable;
        }
    }
    catch {
        // fallback to preferred list
    }
    return preferred[0];
}
async function gradeCandidateProfile(candidate, customSystemPrompt) {
    if (!nvidiaClient && !groqClient) {
        const loudMsg = 'Neither NVIDIA_API_KEY nor GROQ_API_KEY is configured in worker environment.';
        console.error(`🚨 [FATAL] ${loudMsg}`);
        throw new FatalAiQuotaError(loudMsg, 401);
    }
    const topRepoList = (candidate.top_repos || [])
        .map(r => `• ${r.name} (${r.language || 'Code'}, ${r.stars}★): ${r.description || 'No description'}`)
        .join('\n');
    const langList = (candidate.languages || [])
        .map(l => `${l.name} (${l.pct}%)`)
        .join(', ') || 'Various';
    const prompt = `
You are an expert software developer and peer community evaluator assessing GitHub developers to follow and connect with.
${customSystemPrompt ? `System Focus Guidance: ${customSystemPrompt}\n` : ''}
Evaluate the following GitHub developer candidate across 4 key pillars (scores between 20 and 99 each):
1. **activity** (weight 30%): Does recent velocity, public repo count, and output reflect an active builder?
2. **codeQuality** (weight 35%): Do top repos show genuine, original, well-crafted code, good READMEs, and authentic project intent?
3. **relevance** (weight 20%): How aligned are their languages, stack, and bio to peer software engineering?
4. **reach** (weight 15%): Ratio of followers (${candidate.followers_count}) to following (${candidate.following_count}). Higher scores for authentic peer builders rather than corporate bots or inflated follow-churners.

Calculate the final composite grade (0-100):
grade = round((activity * 0.30) + (codeQuality * 0.35) + (relevance * 0.20) + (reach * 0.15))

Developer Details:
- Username: @${candidate.owner} ${candidate.display_name ? `(${candidate.display_name})` : ''}
- Bio: ${candidate.bio || 'None provided'}
- Stats: ${candidate.followers_count} followers, ${candidate.following_count} following, ${candidate.public_repos_count} public repositories
- Languages: ${langList}
- Top Repositories:
${topRepoList || 'None found'}

Return your evaluation EXACTLY in the following JSON format. Do not add any conversational text or markdown code fence wrappers (like \`\`\`json). Just the raw JSON object.
{
  "activity": <integer between 20 and 99>,
  "codeQuality": <integer between 20 and 99>,
  "relevance": <integer between 20 and 99>,
  "reach": <integer between 20 and 99>,
  "grade": <integer between 0 and 100>,
  "reason": "<short 1-2 sentence editorial explanation of their output, languages, and why they received this score>"
}
`;
    const errors = [];
    if (groqClient) {
        const preferredGroq = [
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant',
            'qwen-2.5-coder-32b',
            'deepseek-r1-distill-llama-70b',
        ];
        try {
            const bestModel = await getBestModel(groqClient, preferredGroq, true);
            return await tryGradeWithClient(groqClient, bestModel, prompt, `Groq (${bestModel})`);
        }
        catch (groqErr) {
            console.warn(`[AI Evaluator] Groq profile evaluation failed:`, groqErr.message);
            errors.push(`Groq: ${groqErr.message}`);
            for (const fallback of preferredGroq) {
                try {
                    return await tryGradeWithClient(groqClient, fallback, prompt, `Groq (${fallback})`);
                }
                catch (fErr) {
                    errors.push(`Groq (${fallback}): ${fErr.message}`);
                }
            }
        }
    }
    if (nvidiaClient) {
        const preferredNvidia = [
            'meta/llama-3.1-70b-instruct',
            'nvidia/llama-3.1-nemotron-70b-instruct',
            'mistralai/mistral-7b-instruct-v0.3',
            'meta/llama-3.3-70b-instruct',
        ];
        try {
            const bestModel = await getBestModel(nvidiaClient, preferredNvidia, false);
            return await tryGradeWithClient(nvidiaClient, bestModel, prompt, `NVIDIA (${bestModel})`);
        }
        catch (nvErr) {
            console.warn(`[AI Evaluator] NVIDIA profile evaluation failed:`, nvErr.message);
            errors.push(`NVIDIA: ${nvErr.message}`);
            for (const fallback of preferredNvidia) {
                try {
                    return await tryGradeWithClient(nvidiaClient, fallback, prompt, `NVIDIA (${fallback})`);
                }
                catch (fErr) {
                    errors.push(`NVIDIA (${fallback}): ${fErr.message}`);
                }
            }
        }
    }
    const combined = errors.join(' | ');
    throw new Error(`All AI providers failed to evaluate candidate @${candidate.owner}: ${combined}`);
}
async function gradeRepository(repo, customSystemPrompt) {
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
        }
        catch (_) { }
    }
    if (nvidiaClient) {
        try {
            return await tryGradeWithClient(nvidiaClient, 'meta/llama-3.1-70b-instruct', prompt, 'NVIDIA');
        }
        catch (_) { }
    }
    return { grade: 60, reason: 'Evaluated default' };
}
