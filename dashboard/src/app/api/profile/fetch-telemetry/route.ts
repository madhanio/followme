import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    // Language distribution percentages matching demo
    const langCounts: Record<string, number> = {};
    let totalLangs = 0;
    userRepos.forEach(r => {
      if (r.language && r.language !== 'Profile') {
        langCounts[r.language] = (langCounts[r.language] || 0) + 1;
        totalLangs++;
      }
    });
    const languages = Object.entries(langCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang, count]) => ({
        name: lang,
        pct: Math.round((count / Math.max(1, totalLangs)) * 100),
      }));

    const latestPush = userRepos[0]?.pushed_at || null;
    const accountAgeYears = accountCreatedAt 
      ? Math.max(1, Math.round((Date.now() - new Date(accountCreatedAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
      : 1;

    // 4. Save/update telemetry placeholders in Supabase
    const { data: updatedRows, error: dbErr } = await supabase
      .from('repos')
      .update({
        bio,
        followers_count: followers,
        following_count: following,
        account_created_at: accountCreatedAt,
        last_pushed_at: latestPush,
      })
      .ilike('owner', owner)
      .select('id, owner');

    if (dbErr) {
      console.error('[Telemetry] Supabase update error:', dbErr.message);
    } else {
      console.log(`[Telemetry] Updated ${updatedRows?.length || 0} rows for ${owner}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        owner,
        bio,
        followers_count: followers,
        following_count: following,
        account_created_at: accountCreatedAt,
        account_age_years: accountAgeYears,
        last_pushed_at: latestPush,
        languages,
        public_repos_count: publicReposCount,
        top_repos: userRepos.slice(0, 3).map(r => ({
          name: r.name,
          stars: r.stargazers_count || 0,
          language: r.language,
          description: r.description,
          pushed_at: r.pushed_at,
        })),
        top_repo: topRepo
          ? {
              name: topRepo.name,
              stars: topRepo.stargazers_count || 0,
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
