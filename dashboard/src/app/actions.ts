'use server';

import { revalidatePath } from 'next/cache';

export async function triggerWorker() {
  const workerUrl = process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8000';
  const secret = process.env.WORKER_SECRET || 'dev_secret';

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
  const secret = process.env.WORKER_SECRET || 'dev_secret';

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
  const secret = process.env.WORKER_SECRET || 'dev_secret';

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

export async function triggerUnstar(owner: string, repo: string) {
  const workerUrl = process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8000';
  const secret = process.env.WORKER_SECRET || 'dev_secret';

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
  const secret = process.env.WORKER_SECRET || 'dev_secret';

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
  const secret = process.env.WORKER_SECRET || 'dev_secret';

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
