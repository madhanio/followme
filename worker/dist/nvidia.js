"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FatalAiQuotaError = void 0;
exports.isAiQuotaOrAuthError = isAiQuotaOrAuthError;
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
        max_tokens: 250,
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
    const result = JSON.parse(cleanedContent);
    let grade = Math.round(Number(result.grade));
    if (isNaN(grade))
        grade = 1;
    grade = Math.max(1, Math.min(10, grade));
    return {
        grade,
        reason: result.reason || `Graded by ${providerName}`,
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
        // Fallback to any valid generative text/chat model
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
    catch (err) {
        // models.list may fail if unauthorized or unsupported, fallback to preferred list
    }
    return preferred[0];
}
async function gradeRepository(repo, customSystemPrompt) {
    if (!nvidiaClient && !groqClient) {
        const loudMsg = 'Neither NVIDIA_API_KEY nor GROQ_API_KEY is configured in worker environment.';
        console.error(`🚨 [FATAL] ${loudMsg}`);
        throw new FatalAiQuotaError(loudMsg, 401);
    }
    // Truncate readme to ~2000 chars to prevent 413 Payload Too Large
    const snippet = (repo.readme_snippet || '(No README content available)').slice(0, 2000);
    const prompt = `
You are an expert software developer and peer community evaluator.
${customSystemPrompt ? `System Focus Guidance: ${customSystemPrompt}\n` : ''}
Evaluate the following GitHub repository and grade it on a scale of 1 to 10 based on:
1. **Learning Effort**: Does this show active learning, dedication, and practical coding practice? (e.g., student assignments, personal experiments, build-in-public projects).
2. **Originality**: Is it a genuine personal attempt, interesting hackathon project, or custom tool? Avoid penalizing it for being simple, but do penalize if it is an unchanged 1-to-1 clone/fork.
3. **Usefulness & Clarity**: Is the README helpful? Does it demonstrate a working prototype?

We want to discover and support active builders, students, and peers who are coding and experimenting, rather than exclusively massive corporate libraries or senior celebrity projects. Give higher scores (7+) to active, original peer builders.

Repository Details:
- Name: ${repo.owner}/${repo.name}
- URL: ${repo.github_url}
- Description: ${repo.description}
- Language: ${repo.language}
- Stars: ${repo.stars}
- Topics: ${repo.topics.join(', ')}

README Snippet:
"""
${snippet}
"""

Return your evaluation EXACTLY in the following JSON format. Do not add any conversational text or markdown code fence wrappers (like \`\`\`json). Just the raw JSON object.
{
  "grade": <integer between 1 and 10>,
  "reason": "<short 1-2 sentence explanation of the grade>"
}
`;
    const errors = [];
    // 1. Try Groq with dynamic model discovery and active model fallbacks
    if (groqClient) {
        const preferredGroq = [
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant',
            'qwen-2.5-coder-32b',
            'deepseek-r1-distill-llama-70b',
        ];
        // First attempt dynamic discovered model
        try {
            const bestModel = await getBestModel(groqClient, preferredGroq, true);
            return await tryGradeWithClient(groqClient, bestModel, prompt, `Groq (${bestModel})`);
        }
        catch (groqErr) {
            console.warn(`[AI Evaluator] Groq primary attempt failed:`, groqErr.message);
            errors.push(`Groq: ${groqErr.message}`);
            // Try other fallback models explicitly
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
    // 2. Try NVIDIA NIM with dynamic discovery and wide fallbacks
    if (nvidiaClient) {
        const preferredNvidia = [
            'meta/llama-3.1-70b-instruct',
            'nvidia/llama-3.1-nemotron-70b-instruct',
            'mistralai/mistral-7b-instruct-v0.3',
            'meta/llama-3.3-70b-instruct',
            'meta/llama-3.1-8b-instruct',
            'google/gemma-2-9b-it',
        ];
        try {
            const bestModel = await getBestModel(nvidiaClient, preferredNvidia, false);
            return await tryGradeWithClient(nvidiaClient, bestModel, prompt, `NVIDIA NIM (${bestModel})`);
        }
        catch (nvidiaErr) {
            console.warn(`[AI Evaluator] NVIDIA primary attempt failed:`, nvidiaErr.message);
            errors.push(`NVIDIA: ${nvidiaErr.message}`);
            for (const fallback of preferredNvidia) {
                try {
                    return await tryGradeWithClient(nvidiaClient, fallback, prompt, `NVIDIA NIM (${fallback})`);
                }
                catch (fErr) {
                    errors.push(`NVIDIA (${fallback}): ${fErr.message}`);
                }
            }
        }
    }
    // If ALL providers failed, log details to console for debugging, but throw a clean user-facing error message
    console.error(`🚨 [FATAL AI EVALUATION ERROR] Details: ${errors.join(' | ')}`);
    throw new FatalAiQuotaError('AI evaluation keys (Groq/NVIDIA) expired or unavailable. Please add or update your AI API keys.', 410);
}
