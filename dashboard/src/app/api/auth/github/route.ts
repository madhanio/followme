import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    console.error('GITHUB_CLIENT_ID environment variable is not configured.');
    return NextResponse.json(
      { error: 'GitHub OAuth is not configured on this instance. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
  const redirectUri = `${appUrl}/api/auth/callback/github`;

  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', clientId);
  githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
  githubAuthUrl.searchParams.set('scope', 'read:user user:follow public_repo');
  githubAuthUrl.searchParams.set('state', crypto.randomUUID());

  return NextResponse.redirect(githubAuthUrl.toString());
}
