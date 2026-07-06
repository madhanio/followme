import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const systemPassword = process.env.DASHBOARD_PASSWORD;

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
