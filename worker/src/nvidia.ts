import OpenAI from 'openai';
import dotenv from 'dotenv';
import { RepoMetadata } from './types';

dotenv.config();

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

if (!NVIDIA_API_KEY) {
  console.warn('Missing NVIDIA_API_KEY. AI grading will fail.');
}

const openai = new OpenAI({
  apiKey: NVIDIA_API_KEY || '',
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

interface GradingResult {
  grade: number;
  reason: string;
}

export async function gradeRepository(repo: RepoMetadata): Promise<GradingResult> {
  if (!NVIDIA_API_KEY) {
    console.error('NVIDIA_API_KEY is not defined. Skipping grading.');
    return { grade: 1, reason: 'NVIDIA API key not configured' };
  }

  const prompt = `
You are an expert software developer and peer community evaluator.
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

    const result = JSON.parse(cleanedContent) as GradingResult;

    // Validate grade range and structure
    let grade = Math.round(Number(result.grade));
    if (isNaN(grade)) grade = 1;
    grade = Math.max(1, Math.min(10, grade));

    return {
      grade,
      reason: result.reason || 'No reason provided by LLM.',
    };
  } catch (err: any) {
    console.error(`Error grading repository ${repo.owner}/${repo.name}:`, err.message || err);
    return {
      grade: 1,
      reason: `Failed to evaluate using NVIDIA NIM: ${err.message || 'Unknown error'}`,
    };
  }
}
