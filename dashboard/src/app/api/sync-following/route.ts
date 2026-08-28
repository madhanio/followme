import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchAllRows } from '@/lib/supabase';

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
      email: data.email || '',
      followers: data.followers || 0,
      following: data.following || 0
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

async function fetchAllFollowers(): Promise<Set<string>> {
  const followers = new Set<string>();
  if (!process.env.GITHUB_TOKEN) return followers;

  let page = 1;
  while (true) {
    const res = await fetch(
      `https://api.github.com/user/followers?per_page=100&page=${page}`,
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) {
      if (page === 1) {
        console.warn(`GitHub API error ${res.status}: Failed to fetch followers list`);
      }
      break;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    data.forEach((u: any) => followers.add(u.login.toLowerCase()));
    if (data.length < 100) break;
    page++;
    await new Promise(r => setTimeout(r, 200));
  }
  return followers;
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
    const [actualFollowing, actualFollowers, userProfile] = await Promise.all([
      fetchAllFollowing(),
      fetchAllFollowers(),
      fetchAuthenticatedUser()
    ]);

    if (actualFollowing.size === 0 && actualFollowers.size === 0) {
      return NextResponse.json({
        synced: false,
        warning: 'GitHub network response was empty or token missing. Aborted database sync to prevent accidental data loss.',
        userProfile,
      });
    }

    // Fetch all profiles from Supabase (paginated)
    const allDbRepos = await fetchAllRows<{ id: number; owner: string; followed: boolean; unfollowed: boolean; follow_back: boolean }>(
      supabase,
      'repos',
      'id, owner, followed, unfollowed, follow_back'
    );

    const toMarkUnfollowed = allDbRepos?.filter(
      (row) => row.followed === true && !actualFollowing.has(row.owner.toLowerCase())
    ) ?? [];

    const toRestoreFollowed = allDbRepos?.filter(
      (row) => actualFollowing.has(row.owner.toLowerCase()) && (row.followed !== true || row.unfollowed === true)
    ) ?? [];

    // Mutuals calculation
    const toMarkFollowBack = allDbRepos?.filter(
      (row) => actualFollowers.has(row.owner.toLowerCase()) && row.follow_back !== true
    ) ?? [];

    const toUnmarkFollowBack = allDbRepos?.filter(
      (row) => !actualFollowers.has(row.owner.toLowerCase()) && row.follow_back === true
    ) ?? [];

    if (toMarkUnfollowed.length > 0) {
      const ids = toMarkUnfollowed.map((r) => r.id);
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        await supabase
          .from('repos')
          .update({ unfollowed: true, followed: false })
          .in('id', chunk);
      }
    }

    if (toRestoreFollowed.length > 0) {
      const ids = toRestoreFollowed.map((r) => r.id);
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        await supabase
          .from('repos')
          .update({ followed: true, unfollowed: false })
          .in('id', chunk);
      }
    }

    if (toMarkFollowBack.length > 0) {
      const ids = toMarkFollowBack.map((r) => r.id);
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        await supabase
          .from('repos')
          .update({ follow_back: true })
          .in('id', chunk);
      }
    }

    if (toUnmarkFollowBack.length > 0) {
      const ids = toUnmarkFollowBack.map((r) => r.id);
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        await supabase
          .from('repos')
          .update({ follow_back: false })
          .in('id', chunk);
      }
    }

    return NextResponse.json({
      synced: true,
      liveFollowingCount: actualFollowing.size,
      liveFollowersCount: actualFollowers.size,
      unfollowedCount: toMarkUnfollowed.length,
      restoredCount: toRestoreFollowed.length,
      followBackUpdated: toMarkFollowBack.length,
      userProfile
    });
  } catch (err: any) {
    return NextResponse.json({ synced: false, error: err.message }, { status: 500 });
  }
}


