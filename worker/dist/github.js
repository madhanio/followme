"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchRecentRepos = searchRecentRepos;
exports.fetchRepoReadme = fetchRepoReadme;
exports.starRepo = starRepo;
exports.followUser = followUser;
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
