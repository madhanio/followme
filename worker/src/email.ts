/**
 * FollowMe Incident & Digest Email Service
 * Powered by Resend REST API (Zero external SDK dependencies for maximum reliability)
 */

export interface IncidentEmailOptions {
  incidentType: 'GITHUB_AUTH_EXPIRED' | 'AI_QUOTA_EXHAUSTED' | 'GITHUB_RATE_LIMITED' | 'SUPABASE_ERROR' | 'WORKER_UNREACHABLE' | 'TEST_ALERT';
  severity?: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  summary: string;
  details?: Record<string, any>;
  actionUrl?: string;
  actionText?: string;
  recipient: string;
  resendApiKey?: string;
  fromDomain?: string; // Optional custom verified domain
  supabaseClient?: any; // If provided, checks incident_log for dedup
}

// In-memory fallback dedup cache for cases where Supabase itself is unreachable
const memoryDedupMap = new Map<string, number>();
const DEDUP_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function shouldSendIncident(
  incidentType: string,
  supabaseClient?: any
): Promise<boolean> {
  const now = Date.now();

  // Test alerts are always sent
  if (incidentType === 'TEST_ALERT') {
    return true;
  }

  // 1. If Supabase is available, check persistent incident_log table
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('incident_log')
        .select('last_sent_at, status')
        .eq('incident_type', incidentType)
        .maybeSingle();

      if (!error && data?.last_sent_at) {
        const lastSent = new Date(data.last_sent_at).getTime();
        if (now - lastSent < DEDUP_COOLDOWN_MS) {
          console.log(`[Email Alert] Suppressing duplicate incident '${incidentType}': sent ${Math.round((now - lastSent) / 60000)}m ago.`);
          return false;
        }
      }
    } catch (err: any) {
      console.warn(`[Email Alert] Failed to check incident_log, falling back to memory dedup:`, err.message || err);
    }
  }

  // 2. In-memory check (crucial for SUPABASE_ERROR scenario)
  const lastMemoryTime = memoryDedupMap.get(incidentType);
  if (lastMemoryTime && (now - lastMemoryTime < DEDUP_COOLDOWN_MS)) {
    console.log(`[Email Alert] Suppressing in-memory duplicate incident '${incidentType}'.`);
    return false;
  }

  return true;
}

export async function recordIncidentSent(
  incidentType: string,
  metadata: Record<string, any> = {},
  supabaseClient?: any
): Promise<void> {
  const nowIso = new Date().toISOString();
  memoryDedupMap.set(incidentType, Date.now());

  if (incidentType === 'TEST_ALERT') return;

  if (supabaseClient) {
    try {
      await supabaseClient
        .from('incident_log')
        .upsert({
          incident_type: incidentType,
          last_sent_at: nowIso,
          status: 'ACTIVE',
          metadata: metadata || {},
        }, { onConflict: 'incident_type' });
    } catch (err: any) {
      console.warn('[Email Alert] Failed to record incident in incident_log table:', err.message || err);
    }
  }
}

export async function resolveIncidentInDb(
  incidentType: string,
  supabaseClient?: any
): Promise<void> {
  memoryDedupMap.delete(incidentType);
  if (supabaseClient) {
    try {
      await supabaseClient
        .from('incident_log')
        .update({ status: 'RESOLVED' })
        .eq('incident_type', incidentType);
    } catch (_) {}
  }
}

function generateCleanPlainText(options: IncidentEmailOptions): string {
  const severityTag = options.severity || (options.incidentType === 'TEST_ALERT' ? 'INFO' : 'CRITICAL');
  return `[${severityTag}] FOLLOWME SYSTEM ALERT: ${options.title}
================================================================

${options.summary}

Incident Type: ${options.incidentType}
Timestamp: ${new Date().toUTCString()}

${options.details ? 'DIAGNOSTIC DETAILS:\n' + Object.entries(options.details).map(([k, v]) => `• ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n') : ''}

${options.actionUrl ? `Action Required: ${options.actionText || 'Take Action'} at ${options.actionUrl}` : ''}

---
You received this automated notification because this address is configured in FollowMe Settings.
To manage alerts, visit your FollowMe Dashboard.`;
}

function generateExecutiveHtml(options: IncidentEmailOptions): string {
  const severity = options.severity || (options.incidentType === 'TEST_ALERT' ? 'INFO' : 'CRITICAL');
  
  const badgeColor = 
    severity === 'CRITICAL' ? '#e60023' :
    severity === 'WARNING' ? '#f59e0b' : '#3b82f6';
    
  const badgeBg = 
    severity === 'CRITICAL' ? '#fef2f2' :
    severity === 'WARNING' ? '#fffbeb' : '#eff6ff';

  const badgeBorder = 
    severity === 'CRITICAL' ? '#fecaca' :
    severity === 'WARNING' ? '#fde68a' : '#bfdbfe';

  const detailsRows = options.details
    ? Object.entries(options.details)
        .map(([k, v]) => `<tr><td style="padding: 6px 10px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11px; color: #71717a; border-bottom: 1px solid #f4f4f5; text-transform: uppercase;">${k}</td><td style="padding: 6px 10px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; color: #18181b; font-weight: 600; border-bottom: 1px solid #f4f4f5;">${typeof v === 'object' ? JSON.stringify(v) : v}</td></tr>`)
        .join('')
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; line-height: 1.5;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Header -->
    <tr>
      <td style="padding: 28px 32px; background: #09090b; color: #ffffff;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <div style="display: inline-block; background: #e60023; color: #ffffff; font-weight: 800; font-size: 11px; letter-spacing: 0.1em; padding: 4px 8px; border-radius: 6px; text-transform: uppercase; margin-bottom: 8px;">
                FollowMe Ops
              </div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
                ${options.title}
              </h1>
            </td>
            <td align="right" valign="top">
              <span style="display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
                ${severity}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px;">
        <p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.6;">
          ${options.summary}
        </p>

        <!-- Technical Diagnostic Card -->
        ${options.details ? `
        <div style="margin: 24px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px;">
            Diagnostic Telemetry
          </div>
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            ${detailsRows}
          </table>
        </div>
        ` : ''}

        <!-- Action Button -->
        ${options.actionUrl ? `
        <div style="margin: 30px 0 10px 0;">
          <a href="${options.actionUrl}" style="display: inline-block; background: #e60023; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 14px; letter-spacing: -0.01em; box-shadow: 0 2px 4px rgba(230, 0, 35, 0.2);">
            ${options.actionText || 'Resolve Incident Now →'}
          </a>
        </div>
        ` : ''}
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 24px 32px; background: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <strong>FollowMe Automation Service</strong> • Resend High-Priority Incident Pipeline<br>
              <span style="font-size: 11px; color: #94a3b8;">Incident ID: ${options.incidentType} • Timestamp: ${new Date().toISOString()}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendIncidentEmail(options: IncidentEmailOptions): Promise<{ success: boolean; id?: string; error?: string; skipped?: boolean }> {
  const apiKey = options.resendApiKey || process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Email Alert] RESEND_API_KEY not configured. Skipping email dispatch.');
    return { success: false, error: 'RESEND_API_KEY is not configured.' };
  }

  if (!options.recipient || !options.recipient.includes('@')) {
    console.warn(`[Email Alert] Invalid or missing recipient email: "${options.recipient}".`);
    return { success: false, error: 'Recipient email address is invalid.' };
  }

  // Check persistent / in-memory deduplication
  const shouldSend = await shouldSendIncident(options.incidentType, options.supabaseClient);
  if (!shouldSend) {
    return { success: true, skipped: true };
  }

  // Use custom domain if configured, or default to standard verified sender
  // TODO: Update 'fromDomain' to your custom verified domain in Resend (e.g. notifications@yourdomain.com)
  const fromEmail = options.fromDomain 
    ? `FollowMe System <notifications@${options.fromDomain}>` 
    : 'FollowMe System <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [options.recipient.trim()],
        subject: `[${options.severity || 'CRITICAL'}] ${options.title}`,
        html: generateExecutiveHtml(options),
        text: generateCleanPlainText(options),
        headers: {
          'List-Unsubscribe': `<mailto:unsubscribe@${options.fromDomain || 'resend.dev'}>`,
          'X-Entity-Ref-ID': `${options.incidentType}-${Date.now()}`,
          'X-Priority': options.severity === 'CRITICAL' ? '1' : '3',
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[Email Alert] Resend API error:', data);
      return { success: false, error: data.message || `Resend HTTP ${res.status}` };
    }

    // Record that we sent this incident to enforce cooldown
    await recordIncidentSent(options.incidentType, {
      resend_id: data.id,
      recipient: options.recipient,
      details: options.details,
    }, options.supabaseClient);

    console.log(`[Email Alert] Incident email successfully sent (${options.incidentType}) -> ${options.recipient} [ID: ${data.id}]`);
    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('[Email Alert] Network error while calling Resend:', err.message || err);
    return { success: false, error: err.message || 'Network error dispatching email' };
  }
}
