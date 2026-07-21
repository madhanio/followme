import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { currentKey, newKey } = await request.json();
    const systemPassword = process.env.DASHBOARD_PASSWORD || 'madhan';

    if (currentKey !== systemPassword) {
      return NextResponse.json({ error: 'Current security key is incorrect.' }, { status: 401 });
    }

    if (!newKey || newKey.trim().length < 4) {
      return NextResponse.json({ error: 'New security key must be at least 4 characters.' }, { status: 400 });
    }

    // Update in process environment for server lifetime
    process.env.DASHBOARD_PASSWORD = newKey;

    return NextResponse.json({ success: true, message: 'Security key updated successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
