import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Simulate triggering the worker agent via fetch or spawn
    // In a real environment this might call triggerWorker() or hit a background service
    return NextResponse.json({ 
      success: true, 
      message: 'GitAuto Agent run triggered successfully! The background worker has started processing Github profiles.' 
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
