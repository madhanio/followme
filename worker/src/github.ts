import dotenv from 'dotenv';
import { RepoMetadata } from './types';

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;

const HEADERS: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'FollowMe-Automation-Worker',
};

if (GITHUB_TOKEN) {
  HEADERS['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
} else {
  console.warn('Missing GITHUB_TOKEN. GitHub API rate limits will be highly restricted.');
}

/**
 * Searches repositories created in the last 7 days with specific topics, sorted by stars descending.
 */
export async function searchRecentRepos(topics: string[]): Promise<RepoMetadata[]> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateString = thirtyDaysAgo.toISOString().split('T')[0];

    // Search query: created in last 30 days, stars > 10
    const q = `created:>=${dateString} stars:>10`;
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(
      q
    )}&sort=stars&order=desc&per_page=20`;

    console.log(`Searching GitHub repos with URL: ${url}`);
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      const errMsg = await res.text();
      throw new Error(`GitHub search failed: ${res.status} ${res.statusText} - ${errMsg}`);
    }

    const data = (await res.json()) as any;
    const items = data.items || [];

    const repos: RepoMetadata[] = items.map((item: any) => ({
      id: item.id,
      github_url: item.html_url,
      owner: item.owner.login,
      name: item.name,
      stars: item.stargazers_count,
      language: item.language || 'Unknown',
      topics: item.topics || [],
      readme_snippet: '', // To be fetched per repo
      description: item.description || '',
    }));

    return repos;
  } catch (err: any) {
    console.error('Error during GitHub search:', err.message || err);
    throw err;
  }
}

/**
 * Fetches the readme content of a repository and returns a snippet (first 3000 chars).
 */
export async function fetchRepoReadme(owner: string, name: string): Promise<string> {
  try {
    const url = `https://api.github.com/repos/${owner}/${name}/readme`;
    const res = await fetch(url, { headers: HEADERS });

    if (!res.ok) {
      // If README doesn't exist or failed, return empty string
      return '';
    }

    const data = (await res.json()) as any;
    if (data.content && data.encoding === 'base64') {
      const decoded = Buffer.from(data.content, 'base64').toString('utf8');
      return decoded.slice(0, 3000); // Send up to 3000 chars to avoid prompt token overflow
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
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        ...HEADERS,
        'Content-Length': '0',
      },
    });

    if (res.status === 204) {
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
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        ...HEADERS,
        'Content-Length': '0',
      },
    });

    if (res.status === 204) {
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
    const res = await fetch(url, {
      method: 'DELETE',
      headers: HEADERS,
    });

    if (res.status === 204) {
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
    const res = await fetch(url, { headers: HEADERS });
    
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
