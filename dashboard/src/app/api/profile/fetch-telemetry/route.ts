import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: Request) {
  try {
    const { owner } = await request.json();

    if (!owner) {
      return NextResponse.json({ error: 'Owner username is required' }, { status: 400 });
    }

    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'FollowMe-Dashboard',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // 1. Fetch user profile from GitHub
    const userRes = await fetch(`https://api.github.com/users/${owner}`, { headers });
    if (!userRes.ok) {
      return NextResponse.json(
        { error: `GitHub API error fetching profile (${userRes.status})` },
        { status: userRes.status }
      );
    }
    const user = await userRes.json();

    // 2. Fetch user's public repositories (up to 30, sorted by updated)
    const reposRes = await fetch(
      `https://api.github.com/users/${owner}/repos?sort=pushed&per_page=30`,
      { headers }
    );
    let userRepos: any[] = [];
    if (reposRes.ok) {
      userRepos = await reposRes.json();
    }

    // 3. Extract key details
    const bio = user.bio || null;
    const followers = user.followers || 0;
    const following = user.following || 0;
    const accountCreatedAt = user.created_at || null;
    const publicReposCount = user.public_repos || userRepos.length;

    // Determine top repo (most stars or most recently pushed)
    const sortedByStars = [...userRepos].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));
    const topRepo = sortedByStars[0] || userRepos[0] || null;

    const languages = Array.from(
      new Set(userRepos.map((r) => r.language).filter(Boolean))
    ).slice(0, 5);

    const latestPush = userRepos[0]?.pushed_at || null;

    // 4. Save/update telemetry placeholders in Supabase
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase
        .from('repos')
        .update({
          bio,
          followers_count: followers,
          following_count: following,
          account_created_at: accountCreatedAt,
          last_pushed_at: latestPush,
        })
        .ilike('owner', owner);
    }

    return NextResponse.json({
      success: true,
      data: {
        owner,
        bio,
        followers_count: followers,
        following_count: following,
        account_created_at: accountCreatedAt,
        last_pushed_at: latestPush,
        languages,
        public_repos_count: publicReposCount,
        top_repo: topRepo
          ? {
              name: topRepo.name,
              stars: topRepo.stargazers_count,
              language: topRepo.language,
              description: topRepo.description,
            }
          : null,
      },
    });
  } catch (err: any) {
    console.error('Error fetching profile telemetry:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
