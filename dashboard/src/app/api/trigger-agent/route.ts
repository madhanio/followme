import { NextResponse } from 'next/server';

export async function POST() {
  const workerUrl = process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8000';
  const workerSecret = process.env.WORKER_SECRET;

  try {
    const res = await fetch(`${workerUrl}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(workerSecret ? { 'x-worker-secret': workerSecret } : {})
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ success: false, message: `Worker error: ${res.status} - ${text}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ 
      success: true, 
      message: data.message || 'FollowMe Agent run triggered successfully! The background worker has started processing Github profiles.' 
    });
  } catch (err: any) {
    console.error('Error triggering worker via /api/trigger-agent:', err);
    return NextResponse.json({ success: false, message: err.message || 'Failed to connect to worker' }, { status: 500 });
  }
}
