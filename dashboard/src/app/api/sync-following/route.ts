import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function fetchAuthenticatedUser() {
  if (!process.env.GITHUB_TOKEN) return null;
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      login: data.login || 'User',
      name: data.name || data.login || 'User',
      avatar_url: data.avatar_url || `https://github.com/${data.login || 'ghost'}.png`,
      email: data.email || ''
    };
  } catch {
    return null;
  }
}

async function fetchAllFollowing(): Promise<Set<string>> {
  const following = new Set<string>();
  if (!process.env.GITHUB_TOKEN) return following;

  let page = 1;
  while (true) {
    const res = await fetch(
      `https://api.github.com/user/following?per_page=100&page=${page}`,
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) {
      if (page === 1) {
        throw new Error(`GitHub API error ${res.status}: Failed to fetch following list`);
      }
      break;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    data.forEach((u: any) => following.add(u.login.toLowerCase()));
    if (data.length < 100) break;
    page++;
    await new Promise(r => setTimeout(r, 200));
  }
  return following;
}

export async function POST() {
  if (!supabaseUrl || !supabaseKey) {
    return Response.json(
      { error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 }
    );
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const [actualFollowing, userProfile] = await Promise.all([
      fetchAllFollowing(),
      fetchAuthenticatedUser()
    ]);

    if (actualFollowing.size === 0) {
      return NextResponse.json({
        synced: false,
        warning: 'Following list from GitHub was empty or token missing. Aborted database sync to prevent accidental data loss.',
        userProfile,
      });
    }

    // Fetch all profiles from Supabase
    const { data: allDbRepos, error } = await supabase
      .from('repos')
      .select('id, owner, followed, unfollowed');
    if (error) throw error;

    const toMarkUnfollowed = allDbRepos?.filter(
      (row) => row.followed === true && !actualFollowing.has(row.owner.toLowerCase())
    ) ?? [];

    const toRestoreFollowed = allDbRepos?.filter(
      (row) => actualFollowing.has(row.owner.toLowerCase()) && (row.followed !== true || row.unfollowed === true)
    ) ?? [];

    if (toMarkUnfollowed.length > 0) {
      await supabase
        .from('repos')
        .update({ unfollowed: true, followed: false })
        .in('id', toMarkUnfollowed.map((r) => r.id));
    }

    if (toRestoreFollowed.length > 0) {
      await supabase
        .from('repos')
        .update({ followed: true, unfollowed: false })
        .in('id', toRestoreFollowed.map((r) => r.id));
    }

    return NextResponse.json({
      synced: true,
      liveFollowingCount: actualFollowing.size,
      unfollowedCount: toMarkUnfollowed.length,
      restoredCount: toRestoreFollowed.length,
      userProfile
    });
  } catch (err: any) {
    return NextResponse.json({ synced: false, error: err.message }, { status: 500 });
  }
}

