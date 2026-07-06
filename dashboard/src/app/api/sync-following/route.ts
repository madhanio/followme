import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAllFollowing(): Promise<Set<string>> {
  const following = new Set<string>();
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://api.github.com/users/${process.env.GITHUB_USERNAME}/following?per_page=100&page=${page}`,
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    data.forEach((u: any) => following.add(u.login.toLowerCase()));
    if (data.length < 100) break;
    page++;
  }
  return following;
}

export async function POST() {
  try {
    const actualFollowing = await fetchAllFollowing();
    const { data: dbFollowed, error } = await supabase
      .from('repos')
      .select('id, owner')
      .eq('followed', true)
      .eq('unfollowed', false);
    if (error) throw error;

    const toMarkUnfollowed = dbFollowed?.filter(
      (row) => !actualFollowing.has(row.owner.toLowerCase())
    ) ?? [];

    if (toMarkUnfollowed.length > 0) {
      await supabase
        .from('repos')
        .update({ unfollowed: true, followed: false })
        .in('id', toMarkUnfollowed.map((r) => r.id));
    }

    return NextResponse.json({ synced: true, unfollowedCount: toMarkUnfollowed.length });
  } catch (err: any) {
    return NextResponse.json({ synced: false, error: err.message }, { status: 500 });
  }
}
