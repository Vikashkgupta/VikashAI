// File: netlify/functions/adminDashboard.js
// Password-protected Monitoring Dashboard API + Click Analytics Tracker
// Includes full exception handling and clean CORS headers (`status: 200` on OPTIONS).

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-password',
  'Access-Control-Max-Age': '86400'
};

function jsonRes(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

async function supabaseFetch(path, options = {}) {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (err) {
    console.warn('[adminDashboard] Supabase fetch warning:', err?.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonRes(405, { success: false, error: 'Method not allowed' });
  }

  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return jsonRes(400, { success: false, error: 'Invalid JSON' });
    }

    const action = String(body.action || 'stats');

    // 1. Public click tracking (does not require admin password)
    if (action === 'track_click') {
      const eventType = String(body.eventType || 'social_link').slice(0, 40);
      const label = String(body.label || 'Link').slice(0, 120);
      const targetUrl = String(body.targetUrl || '').slice(0, 300);
      const sessionId = String(body.sessionId || '').slice(0, 80);

      await supabaseFetch('personal_click_events', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          session_id: sessionId,
          event_type: eventType,
          label,
          target_url: targetUrl
        })
      });

      return jsonRes(200, { success: true });
    }

    // 2. Password-protected Admin Login / Stats
    const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();
    if (!adminPassword) {
      return jsonRes(500, {
        success: false,
        error: 'Netlify में ADMIN_PASSWORD environment variable सेट नहीं है।'
      });
    }

    const provided = String(body.password || req.headers.get('x-admin-password') || '').trim();
    if (!provided || provided !== adminPassword) {
      return jsonRes(401, { success: false, error: 'गलत पासवर्ड! कृपया सही पासवर्ड डालें।' });
    }

    if (action === 'login') {
      return jsonRes(200, { success: true, authorized: true });
    }

    // 3. Fetch real monitoring data from Supabase + Integration health
    const [sessionsRes, clicksRes] = await Promise.all([
      supabaseFetch(
        'personal_chat_sessions?select=session_id,visitor_name,device_info,city,message_count,conversation,last_active&order=last_active.desc&limit=30'
      ),
      supabaseFetch(
        'personal_click_events?select=id,event_type,label,target_url,created_at&order=created_at.desc&limit=50'
      )
    ]);

    const sessions = Array.isArray(sessionsRes) ? sessionsRes : [];
    const clicks = Array.isArray(clicksRes) ? clicksRes : [];

    const totalSessions = sessions.length;
    const totalMessages = sessions.reduce((acc, s) => acc + Number(s.message_count || 0), 0);

    const clickCounts = {};
    clicks.forEach((c) => {
      const k = c.label || 'Unknown';
      clickCounts[k] = (clickCounts[k] || 0) + 1;
    });

    const topClicks = Object.entries(clickCounts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const integrations = {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      github: Boolean(process.env.GITHUB_USERNAME),
      instagram: Boolean(process.env.IG_ACCESS_TOKEN && process.env.IG_USER_ID),
      supabase: Boolean(
        process.env.SUPABASE_URL &&
          (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
      )
    };

    return jsonRes(200, {
      success: true,
      stats: {
        totalSessions,
        totalMessages,
        totalClicks: clicks.length,
        topClicks
      },
      integrations,
      recentSessions: sessions.slice(0, 15).map((s) => ({
        sessionId: s.session_id,
        visitorName: s.visitor_name || 'Visitor',
        deviceInfo: s.device_info || '',
        city: s.city || '',
        messageCount: s.message_count || 0,
        lastActive: s.last_active,
        lastUserMessage: Array.isArray(s.conversation)
          ? [...s.conversation].reverse().find((m) => m.role === 'user')?.text || ''
          : '',
        conversation: Array.isArray(s.conversation) ? s.conversation.slice(-6) : []
      })),
      recentClicks: clicks.slice(0, 15)
    });
  } catch (err) {
    console.error('[adminDashboard] Fatal exception:', err);
    return jsonRes(500, {
      success: false,
      error: err?.message || 'Admin dashboard server error'
    });
  }
};