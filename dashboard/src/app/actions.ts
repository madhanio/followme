'use server';

import { revalidatePath } from 'next/cache';
import { headers, cookies } from 'next/headers';
import { sendIncidentEmail } from '@/lib/email';

export interface SystemHealthState {
  isGitHubValid: boolean;
  gitHubError: string | null;
  gitHubUsername: string | null;
  isDbConnected: boolean;
  dbError: string | null;
  isWorkerOnline: boolean;
  workerError: string | null;
  lastChecked: string;
}

async function verifyAuthSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const auth = cookieStore.get('fm_auth')?.value;
  return auth === '1';
}

function getWorkerSecret(): string {
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerSecret) throw new Error('WORKER_SECRET is not set. Set it in your environment variables.');
  return workerSecret;
}

/**
 * Validates active credentials against GitHub, Supabase DB, and Worker.
 * When GitHub 401 is encountered, immediately dispatches an incident email (deduplicated).
 */
export async function checkSystemHealth(): Promise<SystemHealthState> {
  const now = new Date().toISOString();
  let isGitHubValid = true;
  let gitHubError: string | null = null;
  let gitHubUsername: string | null = null;
  let isDbConnected = true;
  let dbError: string | null = null;
  let isWorkerOnline = true;
  let workerError: string | null = null;

  // 1. Fetch settings from DB using service role to retrieve secure keys
  let dbSettings: Record<string, any> | null = null;
  let supabaseServiceClient: any = null;
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseServiceKey) {
      const { createClient } = await import('@supabase/supabase-js');
      supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data, error } = await supabaseServiceClient.from('settings').select('key, value');
      if (error) {
        isDbConnected = false;
        dbError = error.message;
      } else if (data) {
        dbSettings = {};
        for (const row of data) {
          dbSettings[row.key] = row.value;
        }
      }
    }
  } catch (err: any) {
    isDbConnected = false;
    dbError = err.message || 'Database connection error';
  }

  // 2. Validate GitHub Token
  const effectiveToken = dbSettings?.github_token || process.env.GITHUB_TOKEN;
  if (!effectiveToken) {
    isGitHubValid = false;
    gitHubError = 'No GitHub Personal Access Token configured.';
  } else {
    try {
      const ghRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'FollowMe-Dashboard-HealthCheck',
        },
        cache: 'no-store',
      });

      if (!ghRes.ok) {
        isGitHubValid = false;
        if (ghRes.status === 401) {
          gitHubError = 'GitHub PAT expired or invalid (401 Bad credentials).';

          // Trigger email alert via Resend (deduplicated via incident_log table)
          const recipient = dbSettings?.recipientEmail || process.env.NOTIFICATION_EMAIL || process.env.RECIPIENT_EMAIL;
          const resendKey = dbSettings?.resend_api_key || dbSettings?.resendApiKey || process.env.RESEND_API_KEY;

          if (recipient && resendKey) {
            sendIncidentEmail({
              incidentType: 'GITHUB_AUTH_EXPIRED',
              severity: 'CRITICAL',
              title: 'GitHub Personal Access Token Expired',
              summary: 'FollowMe has detected that your configured GitHub Personal Access Token (PAT) has expired or been revoked. As a defensive measure, the dashboard has entered Offline Snapshot Mode and live mutations are disabled.',
              details: {
                'Service Status': 'Offline Snapshot Mode',
                'HTTP Response': '401 Unauthorized / Bad credentials',
                'Action Needed': 'Regenerate token with scopes: public_repo, user:follow, read:user',
              },
              actionUrl: 'https://github.com/settings/tokens/new',
              actionText: 'Generate New GitHub Token →',
              recipient,
              resendApiKey: resendKey,
              fromDomain: dbSettings?.fromDomain || process.env.RESEND_FROM_DOMAIN,
              supabaseClient: supabaseServiceClient,
            }).catch(console.error);
          }
        } else if (ghRes.status === 403) {
          gitHubError = 'GitHub API rate limit exceeded or access forbidden (403).';
        } else {
          gitHubError = `GitHub API returned HTTP ${ghRes.status}`;
        }
      } else {
        const userData = await ghRes.json();
        gitHubUsername = userData.login || null;
      }
    } catch (err: any) {
      isGitHubValid = false;
      gitHubError = err.message || 'Failed to reach GitHub API';
    }
  }

  // 3. Validate Worker Online State
  const workerUrl = process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8000';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const workerRes = await fetch(`${workerUrl}/health`, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeoutId);
    if (!workerRes.ok) {
      isWorkerOnline = false;
      workerError = `Worker HTTP ${workerRes.status}`;
    }
  } catch (err: any) {
    isWorkerOnline = false;
    workerError = 'Worker unreachable or timed out';
  }

  return {
    isGitHubValid,
    gitHubError,
    gitHubUsername,
    isDbConnected,
    dbError,
    isWorkerOnline,
    workerError,
    lastChecked: now,
  };
}

/**
 * Sends a test alert email to verify Resend delivery
 */
export async function sendTestAlertEmail(targetEmail?: string, customApiKey?: string, customSenderName?: string) {
  const isAuth = await verifyAuthSession();
  if (!isAuth) {
    return { success: false, error: 'Unauthorized: Please log in to perform this action.' };
  }

  const settings = await getSystemSettings();
  const recipient = targetEmail || settings?.recipientEmail || process.env.NOTIFICATION_EMAIL || process.env.RECIPIENT_EMAIL;
  const apiKey = customApiKey || settings?.resend_api_key || settings?.resendApiKey || process.env.RESEND_API_KEY;

  if (!recipient) {
    return { success: false, error: 'No recipient email configured. Please enter an email address in Settings.' };
  }
  if (!apiKey) {
    return { success: false, error: 'No Resend API Key configured. Please enter your RESEND_API_KEY in Settings.' };
  }

  // Dynamically inspect request host so the dashboard link always points to the live app
  let appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || appUrl.includes('localhost')) {
    try {
      const headerList = await headers();
      const host = headerList.get('x-forwarded-host') || headerList.get('host');
      const proto = headerList.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
      if (host) {
        appUrl = `${proto}://${host}`;
      }
    } catch (_) {}
  }
  if (!appUrl) appUrl = 'http://localhost:3000';

  const result = await sendIncidentEmail({
    incidentType: 'TEST_ALERT',
    severity: 'INFO',
    title: 'Test Notification: FollowMe Ops Delivery Verified',
    summary: 'This is a test notification dispatched from your FollowMe Dashboard. If you are reading this in your primary inbox, your Resend integration and anti-spam deliverability configurations are operating flawlessly.',
    details: {
      'Integration': 'Resend REST API',
      'Delivery State': 'Verified',
      'Target Recipient': recipient,
      'Environment': process.env.NODE_ENV || 'production',
    },
    actionUrl: appUrl,
    actionText: 'Return to Dashboard →',
    recipient,
    resendApiKey: apiKey,
    senderName: customSenderName || settings?.senderName || process.env.EMAIL_SENDER_NAME,
  });

  return result;
}

export async function triggerWorker() {
  const isAuth = await verifyAuthSession();
  if (!isAuth) return { success: false, error: 'Unauthorized: Session invalid.' };

  const health = await checkSystemHealth();
  if (!health.isGitHubValid) {
    return { success: false, error: `Action Blocked: ${health.gitHubError || 'GitHub PAT is expired'}. Please update your token in Settings.` };
  }

  const workerUrl = process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8000';
  const secret = getWorkerSecret();

  try {
    const res = await fetch(`${workerUrl}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': secret,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Worker error: ${res.status} - ${text}` };
    }

    const data = await res.json();
    revalidatePath('/');
    return { success: true, message: data.message || 'Worker triggered successfully.' };
  } catch (err: any) {
    console.error('Error triggering worker:', err);
    return { success: false, error: err.message || 'Failed to connect to worker' };
  }
}

export async function triggerCleanup() {
  const workerUrl = process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8000';
  const secret = getWorkerSecret();

  try {
    const res = await fetch(`${workerUrl}/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': secret,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Worker error: ${res.status} - ${text}` };
    }

    const data = await res.json();
    revalidatePath('/');
    return { success: true, message: data.message || 'Cleanup triggered successfully.' };
  } catch (err: any) {
    console.error('Error triggering cleanup:', err);
    return { success: false, error: err.message || 'Failed to connect to worker' };
  }
}

export async function triggerLogCleanup() {
  const workerUrl = process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8000';
  const secret = getWorkerSecret();

  try {
    const res = await fetch(`${workerUrl}/cleanlogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': secret,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Worker error: ${res.status} - ${text}` };
    }

    const data = await res.json();
    revalidatePath('/');
    return { success: true, message: data.message || 'Log cleanup completed.' };
  } catch (err: any) {
    console.error('Error triggering log cleanup:', err);
    return { success: false, error: err.message || 'Failed to connect to worker' };
  }
}

export async function triggerStar(owner: string, repo: string) {
  const isAuth = await verifyAuthSession();
  if (!isAuth) return { success: false, error: 'Unauthorized: Session invalid.' };

  const health = await checkSystemHealth();
  if (!health.isGitHubValid) {
    return { success: false, error: `Action Blocked: ${health.gitHubError || 'GitHub PAT is expired'}. Please update your token in Settings.` };
  }

  const workerUrl = process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8000';
  const secret = getWorkerSecret();

  try {
    const res = await fetch(`${workerUrl}/star`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': secret,
      },
      body: JSON.stringify({ owner, repo }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Worker error: ${res.status} - ${text}` };
    }

    const data = await res.json();
    revalidatePath('/');
    return { success: true, message: data.message || 'Star triggered successfully.' };
  } catch (err: any) {
    console.error('Error triggering star:', err);
    return { success: false, error: err.message || 'Failed to connect to worker' };
  }
}

export async function triggerUnstar(owner: string, repo: string) {
  const isAuth = await verifyAuthSession();
  if (!isAuth) return { success: false, error: 'Unauthorized: Session invalid.' };

  const health = await checkSystemHealth();
  if (!health.isGitHubValid) {
    return { success: false, error: `Action Blocked: ${health.gitHubError || 'GitHub PAT is expired'}. Please update your token in Settings.` };
  }

  const workerUrl = process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8000';
  const secret = getWorkerSecret();

  try {
    const res = await fetch(`${workerUrl}/unstar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': secret,
      },
      body: JSON.stringify({ owner, repo }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Worker error: ${res.status} - ${text}` };
    }

    const data = await res.json();
    revalidatePath('/');
    return { success: true, message: data.message || 'Unstar triggered successfully.' };
  } catch (err: any) {
    console.error('Error triggering unstar:', err);
    return { success: false, error: err.message || 'Failed to connect to worker' };
  }
}

export async function triggerUnfollow(username: string) {
  const isAuth = await verifyAuthSession();
  if (!isAuth) return { success: false, error: 'Unauthorized: Session invalid.' };

  const health = await checkSystemHealth();
  if (!health.isGitHubValid) {
    return { success: false, error: `Action Blocked: ${health.gitHubError || 'GitHub PAT is expired'}. Please update your token in Settings.` };
  }

  const workerUrl = process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8000';
  const secret = getWorkerSecret();

  try {
    const res = await fetch(`${workerUrl}/unfollow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': secret,
      },
      body: JSON.stringify({ username }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Worker error: ${res.status} - ${text}` };
    }

    const data = await res.json();
    revalidatePath('/');
    return { success: true, message: data.message || 'Unfollow triggered successfully.' };
  } catch (err: any) {
    console.error('Error triggering unfollow:', err);
    return { success: false, error: err.message || 'Failed to connect to worker' };
  }
}

export async function triggerFollow(username: string) {
  const isAuth = await verifyAuthSession();
  if (!isAuth) return { success: false, error: 'Unauthorized: Session invalid.' };

  const health = await checkSystemHealth();
  if (!health.isGitHubValid) {
    return { success: false, error: `Action Blocked: ${health.gitHubError || 'GitHub PAT is expired'}. Please update your token in Settings.` };
  }

  const workerUrl = process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8000';
  const secret = getWorkerSecret();

  try {
    const res = await fetch(`${workerUrl}/follow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': secret,
      },
      body: JSON.stringify({ username }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Worker error: ${res.status} - ${text}` };
    }

    const data = await res.json();
    revalidatePath('/');
    return { success: true, message: data.message || 'Follow triggered successfully.' };
  } catch (err: any) {
    console.error('Error triggering follow:', err);
    return { success: false, error: err.message || 'Failed to connect to worker' };
  }
}


export async function getWorkerStatus() {
  const workerUrl = process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8000';

  try {
    const res = await fetch(`${workerUrl}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return { success: false, error: `Failed to fetch status: ${res.statusText}` };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err: any) {
    console.error('Error getting status:', err);
    return { success: false, error: err.message || 'Failed to connect to worker' };
  }
}

export async function triggerClearStale() {
  const workerUrl = process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8000';
  const secret = getWorkerSecret();

  try {
    const res = await fetch(`${workerUrl}/clearstale`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': secret,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Worker error: ${res.status} - ${text}` };
    }

    const data = await res.json();
    revalidatePath('/');
    return { success: true, message: data.message || 'Stale profiles cleanup triggered.' };
  } catch (err: any) {
    console.error('Error clearing stale profiles:', err);
    return { success: false, error: err.message || 'Failed to connect to worker' };
  }
}

export async function triggerDeleteProfile(username: string) {
  const workerUrl = process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8000';
  const secret = getWorkerSecret();

  try {
    const res = await fetch(`${workerUrl}/deleteprofile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': secret,
      },
      body: JSON.stringify({ username }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Worker error: ${res.status} - ${text}` };
    }

    const data = await res.json();
    revalidatePath('/');
    return { success: true, message: data.message || `Profile ${username} deleted successfully.` };
  } catch (err: any) {
    console.error('Error deleting profile:', err);
    return { success: false, error: err.message || 'Failed to connect to worker' };
  }
}

export async function triggerSyncMutuals() {
  const workerUrl = process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8000';
  const secret = getWorkerSecret();

  try {
    const res = await fetch(`${workerUrl}/sync-mutuals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': secret,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Worker error: ${res.status} - ${text}` };
    }

    const data = await res.json();
    revalidatePath('/');
    return { success: true, message: data.message || 'Mutuals sync triggered successfully.' };
  } catch (err: any) {
    console.error('Error triggering mutuals sync:', err);
    return { success: false, error: err.message || 'Failed to connect to worker' };
  }
}

export async function triggerSyncFollowing() {
  const isAuth = await verifyAuthSession();
  if (!isAuth) return { success: false, error: 'Unauthorized: Session invalid.' };

  const health = await checkSystemHealth();
  if (!health.isGitHubValid) {
    return { success: false, error: `Action Blocked: ${health.gitHubError || 'GitHub PAT is expired'}. Please update your token in Settings.` };
  }

  // Call the Next.js API route that handles sync-following.
  let dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL;
  if (!dashboardUrl) {
    try {
      const host = (await headers()).get('host') || 'localhost:3000';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      dashboardUrl = `${protocol}://${host}`;
    } catch (e) {
      dashboardUrl = 'http://localhost:3000';
    }
  }
  
  try {
    const res = await fetch(`${dashboardUrl}/api/sync-following`, {
      method: 'POST',
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Sync following error: ${res.status} - ${text}` };
    }

    const data = await res.json();
    revalidatePath('/');
    return { success: true, data };
  } catch (err: any) {
    console.error('Error triggering sync-following:', err);
    return { success: false, error: err.message || 'Failed to run sync-following' };
  }
}

export async function getUserProfile() {
  let token = process.env.GITHUB_TOKEN;
  try {
    const settings = await getSystemSettings();
    if (settings?.github_token) {
      token = settings.github_token;
    }
  } catch (_) {}

  if (token) {
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { 
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'FollowMe-Dashboard'
        },
        next: { revalidate: 3600 }
      });
      if (res.ok) {
        const data = await res.json();
        return {
          login: data.login || '',
          name: data.name || data.login || '',
          avatar_url: data.avatar_url || '',
          email: data.email || ''
        };
      }
    } catch (_) {}
  }

  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const cookieUser = cookieStore.get('fm_user')?.value;
  const username = process.env.GITHUB_USERNAME || cookieUser;

  if (username) {
    try {
      const res = await fetch(`https://api.github.com/users/${username}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'FollowMe-Dashboard'
        },
        next: { revalidate: 3600 }
      });
      if (res.ok) {
        const data = await res.json();
        return {
          login: data.login || username,
          name: data.name || data.login || username,
          avatar_url: data.avatar_url || `https://github.com/${username}.png`,
          email: data.email || ''
        };
      }
    } catch (_) {}
    return {
      login: username,
      name: username,
      avatar_url: `https://github.com/${username}.png`,
      email: ''
    };
  }

  return null;
}

export async function saveSystemSettings(settings: Record<string, any>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return { success: false, error: 'Supabase URL or Key not configured' };
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const rows = Object.entries(settings).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
    if (error) throw error;
    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    console.error('Error saving settings to DB:', err);
    return { success: false, error: err.message || 'Failed to save settings' };
  }
}

export async function getSystemSettings(includeSensitive: boolean = false): Promise<Record<string, any> | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase.from('settings').select('key, value');
    if (error || !data) return null;
    const settingsMap: Record<string, any> = {};
    for (const row of data) {
      // Never expose github_token, resend_api_key, or dashboard_password unless explicitly requested server-side
      if (!includeSensitive && (row.key === 'github_token' || row.key === 'resend_api_key' || row.key === 'dashboard_password')) {
        // Expose a boolean flag so UI knows key exists without exposing the raw secret
        settingsMap[`has_${row.key}`] = Boolean(row.value);
        continue;
      }
      settingsMap[row.key] = row.value;
    }
    return settingsMap;
  } catch (err) {
    return null;
  }
}

export interface GitHubRateLimitData {
  core: {
    limit: number;
    used: number;
    remaining: number;
    reset: number;
  };
  search: {
    limit: number;
    used: number;
    remaining: number;
    reset: number;
  };
}

export async function getGitHubRateLimit(): Promise<{ success: boolean; data?: GitHubRateLimitData; error?: string }> {
  let token = process.env.GITHUB_TOKEN;

  // If no env token, attempt to check DB settings
  if (!token) {
    try {
      const settings = await getSystemSettings();
      if (settings?.github_token) {
        token = settings.github_token;
      }
    } catch (_) {}
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'FollowMe-Dashboard'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch('https://api.github.com/rate_limit', {
      headers,
      cache: 'no-store'
    });

    if (!res.ok) {
      return {
        success: false,
        error: `GitHub rate limit API returned status ${res.status}`
      };
    }

    const json = await res.json();
    const core = json.resources?.core || { limit: token ? 5000 : 60, used: 0, remaining: token ? 5000 : 60, reset: 0 };
    const search = json.resources?.search || { limit: token ? 30 : 10, used: 0, remaining: token ? 30 : 10, reset: 0 };

    const coreLimit = core.limit ?? (token ? 5000 : 60);
    const coreRemaining = core.remaining ?? coreLimit;
    const coreUsed = typeof core.used === 'number' ? core.used : (coreLimit - coreRemaining);

    const searchLimit = search.limit ?? (token ? 30 : 10);
    const searchRemaining = search.remaining ?? searchLimit;
    const searchUsed = typeof search.used === 'number' ? search.used : (searchLimit - searchRemaining);

    return {
      success: true,
      data: {
        core: {
          limit: coreLimit,
          used: coreUsed,
          remaining: coreRemaining,
          reset: core.reset ?? 0,
        },
        search: {
          limit: searchLimit,
          used: searchUsed,
          remaining: searchRemaining,
          reset: search.reset ?? 0,
        }
      }
    };
  } catch (err: any) {
    console.error('Error fetching GitHub rate limit:', err);
    return {
      success: false,
      error: err.message || 'Failed to fetch GitHub rate limit.'
    };
  }
}

