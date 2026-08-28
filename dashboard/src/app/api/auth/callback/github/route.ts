import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(error || 'GitHub authorization was denied.')}`);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET on server.');
    return NextResponse.redirect(`${appUrl}/login?error=OAuth%20not%20configured%20on%20server`);
  }

  try {
    // 1. Exchange authorization code for GitHub access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'FollowMe-Dashboard'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${appUrl}/login?error=Failed%20to%20exchange%20code%20with%20GitHub`);
    }

    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(tokenData.error_description || 'Invalid token response from GitHub')}`);
    }

    const accessToken = tokenData.access_token;

    // 2. Fetch authenticated GitHub user details
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'FollowMe-Dashboard'
      },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${appUrl}/login?error=Failed%20to%20fetch%20GitHub%20user%20profile`);
    }

    const userData = await userRes.json();
    const authorizedUsername = process.env.GITHUB_USERNAME;

    // 3. Security check: if GITHUB_USERNAME is configured, ensure only the owner can log in
    if (authorizedUsername && userData.login.toLowerCase() !== authorizedUsername.toLowerCase()) {
      console.warn(`Unauthorized login attempt by GitHub user: ${userData.login}. Expected: ${authorizedUsername}`);
      return NextResponse.redirect(`${appUrl}/login?error=Unauthorized%20account%20(${encodeURIComponent(userData.login)})`);
    }

    // 4. Set session cookies
    const cookieStore = await cookies();
    cookieStore.set('fm_auth', '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
      sameSite: 'lax',
    });

    // Optional user session identification
    cookieStore.set('fm_user', userData.login, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
      sameSite: 'lax',
    });

    return NextResponse.redirect(`${appUrl}/`);
  } catch (err: any) {
    console.error('Error in GitHub OAuth callback:', err);
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(err.message || 'OAuth authentication failed')}`);
  }
}
