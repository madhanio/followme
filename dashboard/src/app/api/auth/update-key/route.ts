import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: Request) {
  try {
    const { currentKey, newKey } = await request.json();

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase credentials are not configured.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let systemPassword = process.env.DASHBOARD_PASSWORD;
    const { data: dbSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'dashboard_password')
      .maybeSingle();

    if (dbSetting?.value) {
      systemPassword = String(dbSetting.value);
    }

    if (!systemPassword || currentKey !== systemPassword) {
      return NextResponse.json({ error: 'Current security key is incorrect.' }, { status: 401 });
    }

    if (!newKey || newKey.trim().length < 4) {
      return NextResponse.json({ error: 'New security key must be at least 4 characters.' }, { status: 400 });
    }

    const { error: upsertErr } = await supabase.from('settings').upsert({
      key: 'dashboard_password',
      value: newKey.trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    if (upsertErr) {
      console.error('Error saving new security key to settings:', upsertErr.message);
      return NextResponse.json({ error: 'Failed to persist security key.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Security key updated successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
