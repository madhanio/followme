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

interface FollowerUser {
  id: number;
  login: string;
  html_url: string;
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

async function fetchAllFollowers(): Promise<Map<string, FollowerUser>> {
  const followers = new Map<string, FollowerUser>();
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
    data.forEach((u: any) => {
      followers.set(u.login.toLowerCase(), {
        id: u.id,
        login: u.login,
        html_url: u.html_url || `https://github.com/${u.login}`
      });
    });
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
    const [actualFollowing, actualFollowersMap, userProfile] = await Promise.all([
      fetchAllFollowing(),
      fetchAllFollowers(),
      fetchAuthenticatedUser()
    ]);

    if (actualFollowing.size === 0 && actualFollowersMap.size === 0) {
      return NextResponse.json({
        synced: false,
        warning: 'GitHub network response was empty or token missing. Aborted database sync to prevent accidental data loss.',
        userProfile,
      });
    }

    // Fetch all profiles from Supabase profiles table (paginated)
    const allDbProfiles = await fetchAllRows<{ owner: string; followed: boolean; unfollowed: boolean; follow_back: boolean }>(
      supabase,
      'profiles',
      'owner, followed, unfollowed, follow_back'
    );

    const dbOwnerSet = new Set<string>();
    (allDbProfiles || []).forEach(p => dbOwnerSet.add(p.owner.toLowerCase()));

    const toMarkUnfollowed = allDbProfiles?.filter(
      (row) => row.followed === true && !actualFollowing.has(row.owner.toLowerCase())
    ) ?? [];

    const toRestoreFollowed = allDbProfiles?.filter(
      (row) => actualFollowing.has(row.owner.toLowerCase()) && (row.followed !== true || row.unfollowed === true)
    ) ?? [];

    // Mutuals calculation
    const toMarkFollowBack = allDbProfiles?.filter(
      (row) => actualFollowersMap.has(row.owner.toLowerCase()) && row.follow_back !== true
    ) ?? [];

    const toUnmarkFollowBack = allDbProfiles?.filter(
      (row) => !actualFollowersMap.has(row.owner.toLowerCase()) && row.follow_back === true
    ) ?? [];

    // Identify organic / inbound followers who are not in profiles table at all
    const missingInboundRows: any[] = [];
    for (const [lowerLogin, follower] of actualFollowersMap.entries()) {
      if (!dbOwnerSet.has(lowerLogin)) {
        const isFollowedByUs = actualFollowing.has(lowerLogin);
        missingInboundRows.push({
          owner: follower.login,
          display_name: follower.login,
          avatar_url: `https://github.com/${follower.login}.png`,
          bio: null,
          followers_count: null,
          following_count: null,
          public_repos_count: null,
          grade: 5,
                    followed: isFollowedByUs,
          starred: false,
          followed_at: isFollowedByUs ? new Date().toISOString() : null,
          follow_back: true,
          unfollowed: false,
          follow_skipped: false,
          follow_skip_reason: null,
          whitelisted: false,
          found_by: 'Organic Inbound Follower',
          top_repos: [],
          languages: [],
        });
      }
    }

    if (toMarkUnfollowed.length > 0) {
      const owners = toMarkUnfollowed.map((r) => r.owner);
      for (let i = 0; i < owners.length; i += 200) {
        const chunk = owners.slice(i, i + 200);
        await supabase
          .from('profiles')
          .update({ unfollowed: true, followed: false })
          .in('owner', chunk);
      }
    }

    if (toRestoreFollowed.length > 0) {
      const owners = toRestoreFollowed.map((r) => r.owner);
      for (let i = 0; i < owners.length; i += 200) {
        const chunk = owners.slice(i, i + 200);
        await supabase
          .from('profiles')
          .update({ followed: true, unfollowed: false })
          .in('owner', chunk);
      }
    }

    if (toMarkFollowBack.length > 0) {
      const owners = toMarkFollowBack.map((r) => r.owner);
      for (let i = 0; i < owners.length; i += 200) {
        const chunk = owners.slice(i, i + 200);
        await supabase
          .from('profiles')
          .update({ follow_back: true })
          .in('owner', chunk);
      }
    }

    if (toUnmarkFollowBack.length > 0) {
      const owners = toUnmarkFollowBack.map((r) => r.owner);
      for (let i = 0; i < owners.length; i += 200) {
        const chunk = owners.slice(i, i + 200);
        await supabase
          .from('profiles')
          .update({ follow_back: false })
          .in('owner', chunk);
      }
    }

    if (missingInboundRows.length > 0) {
      for (let i = 0; i < missingInboundRows.length; i += 200) {
        const chunk = missingInboundRows.slice(i, i + 200);
        await supabase
          .from('profiles')
          .upsert(chunk, { onConflict: 'owner' });
      }
    }

    return NextResponse.json({
      synced: true,
      liveFollowingCount: actualFollowing.size,
      liveFollowersCount: actualFollowersMap.size,
      unfollowedCount: toMarkUnfollowed.length,
      restoredCount: toRestoreFollowed.length,
      followBackUpdated: toMarkFollowBack.length,
      inboundFollowersInserted: missingInboundRows.length,
      userProfile
    });
  } catch (err: any) {
    return NextResponse.json({ synced: false, error: err.message }, { status: 500 });
  }
}


