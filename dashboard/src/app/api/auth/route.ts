import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    let systemPassword = process.env.DASHBOARD_PASSWORD;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'dashboard_password')
          .maybeSingle();

        if (data?.value) {
          systemPassword = String(data.value);
        }
      } catch (dbErr) {
        console.warn('Could not read dashboard_password from Supabase settings:', dbErr);
      }
    }

    if (!systemPassword) {
      console.error('DASHBOARD_PASSWORD env var is not set on the server.');
      return NextResponse.json({ error: 'Auth misconfigured' }, { status: 500 });
    }

    if (password === systemPassword) {
      const cookieStore = await cookies();
      cookieStore.set('fm_auth', '1', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('fm_auth');
    cookieStore.delete('fm_user');
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Logout failed' }, { status: 500 });
  }
}
