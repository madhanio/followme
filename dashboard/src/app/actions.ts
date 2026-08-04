'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

function getWorkerSecret(): string {
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerSecret) throw new Error('WORKER_SECRET is not set. Set it in your environment variables.');
  return workerSecret;
}

export async function triggerWorker() {
  const workerUrl = process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8000';
  const secret = getWorkerSecret();

  try {
    const res = await fetch(`${workerUrl}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': secret,
      },
      // Since it runs asynchronously on the worker, we don't need to wait for it to fully complete
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
  // Call the Next.js API route that handles sync-following.
  // Next.js API routes are internal, but since we are executing on the server (Server Action),
  // we can also call it or execute its logic. To trigger the endpoint itself:
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
  if (!process.env.GITHUB_TOKEN) return null;
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { 
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json'
      },
      next: { revalidate: 3600 }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      login: data.login || '',
      name: data.name || data.login || '',
      avatar_url: data.avatar_url || '',
      email: data.email || ''
    };
  } catch (err) {
    return null;
  }
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

export async function getSystemSettings(): Promise<Record<string, any> | null> {
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
      settingsMap[row.key] = row.value;
    }
    return settingsMap;
  } catch (err) {
    return null;
  }
}
