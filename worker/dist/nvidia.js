"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gradeRepository = gradeRepository;
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
if (!NVIDIA_API_KEY) {
    console.warn('Missing NVIDIA_API_KEY. AI grading will fail.');
}
const openai = new openai_1.default({
    apiKey: NVIDIA_API_KEY || '',
    baseURL: 'https://integrate.api.nvidia.com/v1',
});
async function gradeRepository(repo) {
    if (!NVIDIA_API_KEY) {
        console.error('NVIDIA_API_KEY is not defined. Skipping grading.');
        return { grade: 1, reason: 'NVIDIA API key not configured' };
    }
    const prompt = `
You are an expert software engineer and open-source evaluator.
Evaluate the following GitHub repository and grade it on a scale of 1 to 10 based on:
1. **Quality**: How well-written, documented, and structured it appears.
2. **Originality**: Whether it is a novel tool, a creative approach, or just another boilerplate/fork.
3. **Usefulness**: How valuable it is to developers or the general community.

Repository Details:
- Name: ${repo.owner}/${repo.name}
- URL: ${repo.github_url}
- Description: ${repo.description}
- Language: ${repo.language}
- Stars: ${repo.stars}
- Topics: ${repo.topics.join(', ')}

README Snippet:
"""
${repo.readme_snippet || '(No README content available)'}
"""

Return your evaluation EXACTLY in the following JSON format. Do not add any conversational text or markdown code fence wrappers (like \`\`\`json). Just the raw JSON object.
{
  "grade": <integer between 1 and 10>,
  "reason": "<short 1-2 sentence explanation of the grade>"
}
`;
    try {
        const response = await openai.chat.completions.create({
            model: 'meta/llama-3.1-8b-instruct',
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
            throw new Error('NVIDIA NIM API returned an empty response.');
        }
        // Clean up possible markdown code block format if the model ignores instruction
        let cleanedContent = content;
        if (cleanedContent.startsWith('```')) {
            cleanedContent = cleanedContent.replace(/^```(json)?/, '').replace(/```$/, '').trim();
        }
        const result = JSON.parse(cleanedContent);
        // Validate grade range and structure
        let grade = Math.round(Number(result.grade));
        if (isNaN(grade))
            grade = 1;
        grade = Math.max(1, Math.min(10, grade));
        return {
            grade,
            reason: result.reason || 'No reason provided by LLM.',
        };
    }
    catch (err) {
        console.error(`Error grading repository ${repo.owner}/${repo.name}:`, err.message || err);
        return {
            grade: 1,
            reason: `Failed to evaluate using NVIDIA NIM: ${err.message || 'Unknown error'}`,
        };
    }
}
