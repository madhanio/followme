"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkOwnerProfile = checkOwnerProfile;
exports.searchRecentRepos = searchRecentRepos;
exports.fetchRepoReadme = fetchRepoReadme;
exports.starRepo = starRepo;
exports.followUser = followUser;
exports.unfollowUser = unfollowUser;
exports.checkIfFollowsBack = checkIfFollowsBack;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const HEADERS = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'FollowMe-Automation-Worker',
};
if (GITHUB_TOKEN) {
    HEADERS['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
}
else {
    console.warn('Missing GITHUB_TOKEN. GitHub API rate limits will be highly restricted.');
}
/**
 * Checks a GitHub user profile to determine if they should be followed.
 * Two-layer targeting:
 *   Layer 1 (high-profile skip): followers > MAX_OWNER_FOLLOWERS AND following < MIN_OWNER_FOLLOWING
 *   Layer 2 (peer targeting): followers in 20-500 range, following > 20, ratio 0.5-2.0, account > 6 months old
 */
async function checkOwnerProfile(username) {
    const MAX_OWNER_FOLLOWERS = parseInt(process.env.MAX_OWNER_FOLLOWERS || '500', 10);
    const MIN_OWNER_FOLLOWING = parseInt(process.env.MIN_OWNER_FOLLOWING || '10', 10);
    const MAX_OWNER_AGE_DAYS = parseInt(process.env.MAX_OWNER_AGE_DAYS || '730', 10);
    try {
        const url = `https://api.github.com/users/${username}`;
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) {
            console.warn(`Could not fetch profile for ${username}: ${res.status}`);
            return { shouldFollow: false, skipReason: 'profile-fetch-failed' };
        }
        const profile = (await res.json());
        const followers = profile.followers || 0;
        const following = profile.following || 0;
        const createdAt = new Date(profile.created_at || 0);
        const accountAgeDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        // Layer 1: High-profile skip (big name, almost never follows back)
        if (followers > MAX_OWNER_FOLLOWERS && following < MIN_OWNER_FOLLOWING) {
            return { shouldFollow: false, skipReason: 'high-profile' };
        }
        // Layer 2: Peer targeting — active, similar-sized, reciprocal-leaning accounts
        const ratio = following > 0 ? followers / following : 999;
        if (followers < 20) {
            return { shouldFollow: false, skipReason: 'too-new (< 20 followers)' };
        }
        if (followers > MAX_OWNER_FOLLOWERS) {
            return { shouldFollow: false, skipReason: 'too-popular (> ' + MAX_OWNER_FOLLOWERS + ' followers)' };
        }
        if (following < 20) {
            return { shouldFollow: false, skipReason: 'low-following (< 20 following)' };
        }
        if (ratio < 0.5 || ratio > 2.0) {
            return { shouldFollow: false, skipReason: `ratio-mismatch (ratio: ${ratio.toFixed(2)})` };
        }
        if (accountAgeDays < 180) {
            return { shouldFollow: false, skipReason: 'account-too-new (< 6 months)' };
        }
        // Passed all filters — good follow candidate
        return { shouldFollow: true, skipReason: null };
    }
    catch (err) {
        console.error(`Error checking owner profile for ${username}:`, err.message || err);
        return { shouldFollow: false, skipReason: 'error' };
    }
}
/**
 * Searches repositories created in the last 7 days with specific topics, sorted by stars descending.
 */
async function searchRecentRepos(topics) {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const dateString = thirtyDaysAgo.toISOString().split('T')[0];
        // Search query: created in last 30 days, stars > 10
        const q = `created:>=${dateString} stars:>10`;
        const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=20`;
        console.log(`Searching GitHub repos with URL: ${url}`);
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) {
            const errMsg = await res.text();
            throw new Error(`GitHub search failed: ${res.status} ${res.statusText} - ${errMsg}`);
        }
        const data = (await res.json());
        const items = data.items || [];
        const repos = items.map((item) => ({
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
    }
    catch (err) {
        console.error('Error during GitHub search:', err.message || err);
        throw err;
    }
}
/**
 * Fetches the readme content of a repository and returns a snippet (first 3000 chars).
 */
async function fetchRepoReadme(owner, name) {
    try {
        const url = `https://api.github.com/repos/${owner}/${name}/readme`;
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) {
            // If README doesn't exist or failed, return empty string
            return '';
        }
        const data = (await res.json());
        if (data.content && data.encoding === 'base64') {
            const decoded = Buffer.from(data.content, 'base64').toString('utf8');
            return decoded.slice(0, 3000); // Send up to 3000 chars to avoid prompt token overflow
        }
        return '';
    }
    catch (err) {
        console.warn(`Could not fetch README for ${owner}/${name}:`, err.message || err);
        return '';
    }
}
/**
 * Stars a repository for the authenticated user.
 */
async function starRepo(owner, name) {
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
        }
        else {
            const text = await res.text();
            console.error(`Failed to star ${owner}/${name}: ${res.status} - ${text}`);
            return false;
        }
    }
    catch (err) {
        console.error(`Error starring ${owner}/${name}:`, err.message || err);
        return false;
    }
}
/**
 * Follows a GitHub user.
 */
async function followUser(username) {
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
        }
        else {
            const text = await res.text();
            console.error(`Failed to follow ${username}: ${res.status} - ${text}`);
            return false;
        }
    }
    catch (err) {
        console.error(`Error following ${username}:`, err.message || err);
        return false;
    }
}
/**
 * Unfollows a GitHub user.
 */
async function unfollowUser(username) {
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
        }
        else {
            const text = await res.text();
            console.error(`Failed to unfollow ${username}: ${res.status} - ${text}`);
            return false;
        }
    }
    catch (err) {
        console.error(`Error unfollowing ${username}:`, err.message || err);
        return false;
    }
}
/**
 * Checks if another user follows the authenticated user.
 */
async function checkIfFollowsBack(username) {
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
    }
    catch (err) {
        console.error(`Error checking follow back status for ${username}:`, err.message || err);
        return false;
    }
}
