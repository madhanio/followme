import dotenv from 'dotenv';
import { RepoMetadata } from './types';

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'FollowMe-Automation-Worker',
};

if (GITHUB_TOKEN) {
  DEFAULT_HEADERS['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
} else {
  console.warn('Missing GITHUB_TOKEN. GitHub API rate limits will be highly restricted.');
}

/**
 * Robust fetch wrapper for GitHub API with rate limit detection, retry with backoff,
 * and header inspection (x-ratelimit-remaining, retry-after, x-ratelimit-reset).
 */
export async function fetchGitHub(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response> {
  const headers = {
    ...DEFAULT_HEADERS,
    ...(options.headers as Record<string, string> || {}),
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { ...options, headers });

      // Inspect rate limit headers
      const remaining = res.headers.get('x-ratelimit-remaining');
      const resetTime = res.headers.get('x-ratelimit-reset');
      const retryAfter = res.headers.get('retry-after');

      if (remaining !== null && parseInt(remaining, 10) < 10) {
        console.warn(`[GitHub RateLimit] Low quota remaining: ${remaining} requests left. Reset epoch: ${resetTime}`);
      }

      // Handle Rate Limit / Abuse Detection (429 or 403 with zero remaining / abuse message)
      if (res.status === 429 || res.status === 403) {
        const bodyText = await res.clone().text().catch(() => '');
        const isRateLimit =
          res.status === 429 ||
          remaining === '0' ||
          bodyText.toLowerCase().includes('rate limit') ||
          bodyText.toLowerCase().includes('secondary rate limit') ||
          bodyText.toLowerCase().includes('abuse');

        if (isRateLimit && attempt < maxRetries) {
          let waitMs = 3000 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 1000);

          if (retryAfter) {
            waitMs = Math.max(waitMs, parseInt(retryAfter, 10) * 1000);
          } else if (remaining === '0' && resetTime) {
            const resetMs = parseInt(resetTime, 10) * 1000 - Date.now() + 1000;
            if (resetMs > 0 && resetMs < 120000) {
              waitMs = resetMs;
            }
          }

          console.warn(`[GitHub RateLimit] Hit rate limit (${res.status}). Waiting ${Math.round(waitMs / 1000)}s before retry ${attempt}/${maxRetries}...`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
      }

      return res;
    } catch (networkErr: any) {
      if (attempt < maxRetries) {
        const waitMs = 2000 * attempt;
        console.warn(`[GitHub Network] Request failed (attempt ${attempt}/${maxRetries}): ${networkErr.message}. Retrying in ${waitMs / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      } else {
        throw networkErr;
      }
    }
  }

  throw new Error(`GitHub API request failed after ${maxRetries} attempts: ${url}`);
}

export interface OwnerProfileResult {
  shouldFollow: boolean;
  skipReason: string | null;
}

/**
 * Checks a GitHub user profile to determine if they should be followed.
 * Two-layer targeting:
 *   Layer 1 (high-profile skip): followers > MAX_OWNER_FOLLOWERS AND following < MIN_OWNER_FOLLOWING
 *   Layer 2 (peer targeting): followers in 20-500 range, following > 20, ratio 0.5-2.0, account > 6 months old
 */
export async function checkOwnerProfile(
  username: string, 
  config?: { maxOwnerFollowers?: number; minOwnerFollowing?: number; maxOwnerAgeDays?: number }
): Promise<OwnerProfileResult> {
  const MAX_OWNER_FOLLOWERS = config?.maxOwnerFollowers ?? parseInt(process.env.MAX_OWNER_FOLLOWERS || '500', 10);
  const MIN_OWNER_FOLLOWING = config?.minOwnerFollowing ?? parseInt(process.env.MIN_OWNER_FOLLOWING || '10', 10);
  const MAX_OWNER_AGE_DAYS = config?.maxOwnerAgeDays ?? parseInt(process.env.MAX_OWNER_AGE_DAYS || '730', 10);

  try {
    const url = `https://api.github.com/users/${username}`;
    const res = await fetchGitHub(url);
    if (!res.ok) {
      console.warn(`Could not fetch profile for ${username}: ${res.status}`);
      return { shouldFollow: false, skipReason: 'profile-fetch-failed' };
    }

    const profile = (await res.json()) as any;
    if (profile.type !== 'User') {
      return { shouldFollow: false, skipReason: `not-a-user (type: ${profile.type})` };
    }

    const followers: number = (profile.followers != null && profile.followers > 0) ? profile.followers : 0;
    const following: number = (profile.following != null && profile.following > 0) ? profile.following : 0;

    if (followers === 0 || following === 0) {
      return { shouldFollow: false, skipReason: 'hidden-or-zero-stats' };
    }
    const createdAt = new Date(profile.created_at || 0);
    const accountAgeDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    // Layer 1: High-profile skip (big name, almost never follows back)
    if (followers > MAX_OWNER_FOLLOWERS && following < MIN_OWNER_FOLLOWING) {
      return { shouldFollow: false, skipReason: 'high-profile' };
    }

    // Layer 2: Peer targeting — active, similar-sized, reciprocal-leaning accounts
    const ratio = following > 0 ? followers / following : 999;

    if (followers < 3) {
      return { shouldFollow: false, skipReason: 'too-new (< 3 followers)' };
    }
    if (followers > MAX_OWNER_FOLLOWERS) {
      return { shouldFollow: false, skipReason: 'too-popular (> ' + MAX_OWNER_FOLLOWERS + ' followers)' };
    }
    if (following < MIN_OWNER_FOLLOWING) {
      return { shouldFollow: false, skipReason: 'low-following (< ' + MIN_OWNER_FOLLOWING + ' following)' };
    }
    if (ratio < 0.1 || ratio > 5.0) {
      return { shouldFollow: false, skipReason: `ratio-mismatch (ratio: ${ratio.toFixed(2)})` };
    }
    if (accountAgeDays < 30) {
      return { shouldFollow: false, skipReason: 'account-too-new (< 30 days)' };
    }
    if (MAX_OWNER_AGE_DAYS > 0 && accountAgeDays > MAX_OWNER_AGE_DAYS) {
      return { shouldFollow: false, skipReason: `account-too-old (> ${MAX_OWNER_AGE_DAYS} days)` };
    }

    // Passed all filters — good follow candidate
    return { shouldFollow: true, skipReason: null };
  } catch (err: any) {
    console.error(`Error checking owner profile for ${username}:`, err.message || err);
    return { shouldFollow: false, skipReason: 'error' };
  }
}

/**
 * Searches repositories created or updated in the last 14 days with specific topics, sorted by updated descending.
 */
export async function searchRecentRepos(topics: string[], page: number = 1): Promise<RepoMetadata[]> {
  const allReposMap = new Map<number, RepoMetadata>();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const dateString = fourteenDaysAgo.toISOString().split('T')[0];

  for (const topic of topics) {
    try {
      const q = `topic:${topic} stars:1..50 pushed:>${dateString}`;
      const searchPage = Math.max(1, page);
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(
        q
      )}&sort=updated&order=desc&per_page=30&page=${searchPage}`;

      console.log(`Searching GitHub repos for topic ${topic} (page ${searchPage})...`);
      const res = await fetchGitHub(url);
      if (!res.ok) {
        const errMsg = await res.text();
        console.error(`GitHub search for topic ${topic} failed: ${res.status} - ${errMsg}`);
        continue;
      }

      const data = (await res.json()) as any;
      const items = data.items || [];

      for (const item of items) {
        allReposMap.set(item.id, {
          id: item.id,
          github_url: item.html_url,
          owner: item.owner.login,
          name: item.name,
          stars: item.stargazers_count,
          language: item.language || 'Unknown',
          topics: item.topics || [],
          readme_snippet: '',
          description: item.description || '',
        });
      }

      // 1.5s pacing pause between searches to respect GitHub Search rate limit (30 req/min)
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (err: any) {
      console.error(`Error searching topic ${topic}:`, err.message || err);
    }
  }

  return Array.from(allReposMap.values());
}

/**
 * Fetches the readme content of a repository and returns a snippet (first 3000 chars).
 */
export async function fetchRepoReadme(owner: string, name: string): Promise<string> {
  try {
    const url = `https://api.github.com/repos/${owner}/${name}/readme`;
    const res = await fetchGitHub(url);

    if (!res.ok) {
      return '';
    }

    const data = (await res.json()) as any;
    if (data.content && data.encoding === 'base64') {
      const decoded = Buffer.from(data.content, 'base64').toString('utf8');
      return decoded.slice(0, 3000);
    }
    return '';
  } catch (err: any) {
    console.warn(`Could not fetch README for ${owner}/${name}:`, err.message || err);
    return '';
  }
}

/**
 * Stars a repository for the authenticated user.
 */
export async function starRepo(owner: string, name: string): Promise<boolean> {
  if (!GITHUB_TOKEN) {
    console.warn('Cannot star repository: GITHUB_TOKEN is missing');
    return false;
  }
  try {
    const url = `https://api.github.com/user/starred/${owner}/${name}`;
    const res = await fetchGitHub(url, {
      method: 'PUT',
      headers: {
        'Content-Length': '0',
      },
    });

    if (res.status === 204 || res.status === 200) {
      console.log(`Successfully starred ${owner}/${name}`);
      return true;
    } else {
      const text = await res.text();
      console.error(`Failed to star ${owner}/${name}: ${res.status} - ${text}`);
      return false;
    }
  } catch (err: any) {
    console.error(`Error starring ${owner}/${name}:`, err.message || err);
    return false;
  }
}

/**
 * Follows a GitHub user.
 */
export async function followUser(username: string): Promise<boolean> {
  if (!GITHUB_TOKEN) {
    console.warn('Cannot follow user: GITHUB_TOKEN is missing');
    return false;
  }
  try {
    const url = `https://api.github.com/user/following/${username}`;
    const res = await fetchGitHub(url, {
      method: 'PUT',
      headers: {
        'Content-Length': '0',
      },
    });

    if (res.status === 204 || res.status === 200) {
      console.log(`Successfully followed ${username}`);
      return true;
    } else {
      const text = await res.text();
      console.error(`Failed to follow ${username}: ${res.status} - ${text}`);
      return false;
    }
  } catch (err: any) {
    console.error(`Error following ${username}:`, err.message || err);
    return false;
  }
}

/**
 * Unfollows a GitHub user.
 */
export async function unfollowUser(username: string): Promise<boolean> {
  if (!GITHUB_TOKEN) {
    console.warn('Cannot unfollow user: GITHUB_TOKEN is missing');
    return false;
  }
  try {
    const url = `https://api.github.com/user/following/${username}`;
    const res = await fetchGitHub(url, {
      method: 'DELETE',
    });

    if (res.status === 204 || res.status === 200) {
      console.log(`Successfully unfollowed ${username}`);
      return true;
    } else {
      const text = await res.text();
      console.error(`Failed to unfollow ${username}: ${res.status} - ${text}`);
      return false;
    }
  } catch (err: any) {
    console.error(`Error unfollowing ${username}:`, err.message || err);
    return false;
  }
}

/**
 * Checks if another user follows the authenticated user.
 */
export async function checkIfFollowsBack(username: string): Promise<boolean> {
  if (!GITHUB_TOKEN || !GITHUB_USERNAME) {
    console.warn('Cannot check follow-back status: GITHUB_TOKEN or GITHUB_USERNAME is missing');
    return false;
  }
  try {
    const url = `https://api.github.com/users/${username}/following/${GITHUB_USERNAME}`;
    const res = await fetchGitHub(url);
    
    // 204 means username follows GITHUB_USERNAME, 404 means they don't
    if (res.status === 204) {
      console.log(`User ${username} follows back ${GITHUB_USERNAME}`);
      return true;
    }
    
    return false;
  } catch (err: any) {
    console.error(`Error checking follow back status for ${username}:`, err.message || err);
    return false;
  }
}

/**
 * Unstars a repository for the authenticated user.
 */
export async function unstarRepo(owner: string, name: string): Promise<boolean> {
  if (!GITHUB_TOKEN) {
    console.warn('Cannot unstar repository: GITHUB_TOKEN is missing');
    return false;
  }
  try {
    const url = `https://api.github.com/user/starred/${owner}/${name}`;
    const res = await fetchGitHub(url, {
      method: 'DELETE',
    });

    if (res.status === 204 || res.status === 200) {
      console.log(`Successfully unstarred ${owner}/${name}`);
      return true;
    } else {
      const text = await res.text();
      console.error(`Failed to unstar ${owner}/${name}: ${res.status} - ${text}`);
      return false;
    }
  } catch (err: any) {
    console.error(`Error unstarring ${owner}/${name}:`, err.message || err);
    return false;
  }
}

/**
 * Fetches the entire list of users the authenticated user is following (paginated).
 */
export async function getGitHubFollowing(): Promise<string[]> {
  if (!GITHUB_TOKEN) {
    console.warn('Cannot fetch following: GITHUB_TOKEN is missing');
    return [];
  }
  const following: string[] = [];
  let page = 1;
  while (true) {
    try {
      const url = `https://api.github.com/user/following?per_page=100&page=${page}`;
      const res = await fetchGitHub(url);
      if (!res.ok) {
        console.error(`Failed to fetch following page ${page}: ${res.status}`);
        throw new Error(`Failed to fetch following page ${page}: status ${res.status}`);
      }
      const data = (await res.json()) as any[];
      if (!data || data.length === 0) {
        break;
      }
      following.push(...data.map(user => user.login));
      if (data.length < 100) {
        break;
      }
      page++;
      // Small pause between pagination requests
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (err: any) {
      console.error(`Error fetching following page ${page}:`, err.message || err);
      throw err;
    }
  }
  return following;
}

export interface GitHubFollowerDetails {
  id: number;
  login: string;
  html_url?: string;
  avatar_url?: string;
}

/**
 * Fetches the entire list of followers for the authenticated user with details (paginated).
 */
export async function getGitHubFollowersDetails(): Promise<GitHubFollowerDetails[]> {
  if (!GITHUB_TOKEN) {
    console.warn('Cannot fetch followers: GITHUB_TOKEN is missing');
    return [];
  }
  const followers: GitHubFollowerDetails[] = [];
  let page = 1;
  while (true) {
    try {
      const url = `https://api.github.com/user/followers?per_page=100&page=${page}`;
      const res = await fetchGitHub(url);
      if (!res.ok) {
        console.error(`Failed to fetch followers page ${page}: ${res.status}`);
        throw new Error(`Failed to fetch followers page ${page}: status ${res.status}`);
      }
      const data = (await res.json()) as any[];
      if (!data || data.length === 0) {
        break;
      }
      followers.push(...data.map(u => ({
        id: u.id,
        login: u.login,
        html_url: u.html_url || `https://github.com/${u.login}`,
        avatar_url: u.avatar_url || `https://github.com/${u.login}.png`
      })));
      if (data.length < 100) {
        break;
      }
      page++;
      // Small pause between pagination requests
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (err: any) {
      console.error(`Error fetching followers page ${page}:`, err.message || err);
      throw err;
    }
  }
  return followers;
}

/**
 * Fetches the entire list of followers for the authenticated user (paginated).
 */
export async function getGitHubFollowers(): Promise<string[]> {
  const details = await getGitHubFollowersDetails();
  return details.map(u => u.login);
}

/**
 * Fetches live followers and following counts for the authenticated user.
 */
export async function getAuthenticatedUserStats(): Promise<{ followers: number; following: number; ratio: number } | null> {
  if (!GITHUB_TOKEN) {
    return null;
  }
  try {
    const url = 'https://api.github.com/user';
    const res = await fetchGitHub(url);
    if (!res.ok) {
      console.error(`Failed to fetch authenticated user profile: ${res.status}`);
      return null;
    }
    const profile = (await res.json()) as any;
    const followers = profile.followers || 0;
    const following = profile.following || 0;
    const ratio = followers > 0 ? following / followers : following;
    return { followers, following, ratio };
  } catch (err: any) {
    console.error('Error fetching authenticated user stats:', err.message || err);
    return null;
  }
}


