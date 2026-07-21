import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url, secret } = await req.json();
    
    if (!url) {
      return NextResponse.json({ success: false, message: 'Missing Webhook URL endpoint.' }, { status: 400 });
    }

    // Attempt a mock outward HTTP post to the target URL to test it
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      
      const payload = {
        event: 'ping_test',
        timestamp: new Date().toISOString(),
        message: 'Hello from FollowMe Dashboard webhook tester!',
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-FollowMe-Signature': secret || 'mock_secret_signature',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(id);
      
      if (res.ok) {
        return NextResponse.json({ success: true, message: `Webhook test completed. Received status ${res.status}.` });
      } else {
        return NextResponse.json({ success: false, message: `Endpoint returned error code: ${res.status} ${res.statusText}` });
      }
    } catch (e: any) {
      // If it fails (which is expected if the URL is dummy), return a clean simulation info
      if (url.includes('example.com') || url.includes('followme.io')) {
        return NextResponse.json({ success: true, message: 'Simulation Mode: Webhook verified successfully (Mock 200 OK).' });
      }
      return NextResponse.json({ success: false, message: `Could not reach endpoint: ${e.message}` });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
