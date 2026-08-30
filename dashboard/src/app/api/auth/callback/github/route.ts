import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

function renderHtmlResponse(success: boolean, message: string, redirectUrl: string, username?: string) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${success ? 'Authentication Successful' : 'Authentication Failed'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0d0d0d;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      text-align: center;
    }
    .card {
      background: #18181c;
      border: 1px solid ${success ? '#22c55e33' : '#ef444433'};
      padding: 30px;
      border-radius: 20px;
      max-width: 400px;
    }
    .spinner {
      border: 3px solid rgba(255,255,255,0.1);
      border-top: 3px solid ${success ? '#22c55e' : '#ef4444'};
      border-radius: 50%;
      width: 28px;
      height: 28px;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px auto;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h3 style="margin: 0 0 8px 0; font-size: 16px;">${success ? 'Connected Successfully!' : 'Authentication Failed'}</h3>
    <p style="margin: 0; font-size: 12px; color: #a1a1aa;">${message}</p>
  </div>
  <script>
    (function() {
      var isSuccess = ${JSON.stringify(success)};
      var msg = ${JSON.stringify(message)};
      var user = ${JSON.stringify(username || '')};
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({
            type: isSuccess ? 'GITHUB_OAUTH_SUCCESS' : 'GITHUB_OAUTH_ERROR',
            error: isSuccess ? null : msg,
            username: user
          }, '*');
          setTimeout(function() { window.close(); }, 400);
          return;
        } catch (e) {}
      }
      window.location.href = ${JSON.stringify(redirectUrl)};
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  if (error || !code) {
    const errorMsg = error || 'GitHub authorization was denied.';
    return renderHtmlResponse(false, errorMsg, `${appUrl}/login?error=${encodeURIComponent(errorMsg)}`);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET on server.');
    return renderHtmlResponse(false, 'OAuth credentials not configured on server.', `${appUrl}/login?error=OAuth%20not%20configured`);
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
      return renderHtmlResponse(false, 'Failed to exchange code with GitHub.', `${appUrl}/login?error=Token%20exchange%20failed`);
    }

    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      const errorMsg = tokenData.error_description || 'Invalid token response from GitHub.';
      return renderHtmlResponse(false, errorMsg, `${appUrl}/login?error=${encodeURIComponent(errorMsg)}`);
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
      return renderHtmlResponse(false, 'Failed to fetch GitHub user profile.', `${appUrl}/login?error=Profile%20fetch%20failed`);
    }

    const userData = await userRes.json();
    const authorizedUsername = process.env.GITHUB_USERNAME;

    // 3. Security check: if GITHUB_USERNAME is configured, ensure only the owner can log in
    if (authorizedUsername && userData.login.toLowerCase() !== authorizedUsername.toLowerCase()) {
      console.warn(`Unauthorized login attempt by GitHub user: ${userData.login}. Expected: ${authorizedUsername}`);
      return renderHtmlResponse(false, `Unauthorized account (@${userData.login}). Expected @${authorizedUsername}.`, `${appUrl}/login?error=Unauthorized%20account`);
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

    cookieStore.set('fm_user', userData.login, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
      sameSite: 'lax',
    });

    return renderHtmlResponse(true, `Signed in as @${userData.login}. Redirecting...`, `${appUrl}/`, userData.login);
  } catch (err: any) {
    console.error('Error in GitHub OAuth callback:', err);
    return renderHtmlResponse(false, err.message || 'OAuth authentication failed.', `${appUrl}/login?error=OAuth%20failed`);
  }
}
