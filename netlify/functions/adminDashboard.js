// File: netlify/functions/adminDashboard.js
// Vikash AI — Password-Protected Monitoring Dashboard API + Click Analytics + Session Management
// Features:
// - Full conversation history per visitor session (for click-to-expand view)
// - One-click Delete Session (`action: 'delete_session'`) to clean spam/test chats
// - Top Asked Topics / Keywords extraction across all visitor messages
// - Active Now status calculation & Click Analytics

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
  const keys = [
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    String(process.env.SUPABASE_ANON_KEY || '').trim()
  ].filter(Boolean);

  if (!url || keys.length === 0) return { ok: false, data: null };

  for (const key of keys) {
    const authHeaders = {
      apikey: key,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (key.startsWith('eyJ')) {
      authHeaders.Authorization = `Bearer ${key}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3200);
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
        ...options,
        signal: controller.signal,
        headers: authHeaders
      });
      const text = await res.text().catch(() => '');
      if (res.ok) {
        return { ok: true, data: text ? JSON.parse(text) : null };
      }
      console.error(`[adminDashboard] Supabase HTTP ${res.status}:`, text.slice(0, 160));
    } catch (err) {
      console.warn('[adminDashboard] Supabase fetch warning:', err?.message);
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, data: null };
}

function extractTopTopics(sessions) {
  const topicRules = [
    { label: 'Projects & Code', rx: /project|github|repo|code|mern|react|portfolio|प्रोजेक्ट/i },
    { label: 'Instagram Stats', rx: /instagram|insta|follower|like|post|इंस्टा/i },
    { label: 'Hiring / Internship', rx: /hire|intern|job|resume|cv|freelance|work|बात करनी/i },
    { label: 'Contact & Socials', rx: /whatsapp|contact|number|phone|linkedin|facebook|twitter|link/i },
    { label: 'Education & Skills', rx: /btech|aiml|college|diploma|skill|study|पढ़ाई/i },
    { label: 'Weather & News', rx: /weather|news|मौसम|न्यूज़|खबर/i }
  ];

  const counts = {};
  sessions.forEach((s) => {
    const conv = Array.isArray(s.conversation) ? s.conversation : [];
    conv.forEach((turn) => {
      if (turn.role !== 'user' || !turn.text) return;
      for (const rule of topicRules) {
        if (rule.rx.test(turn.text)) {
          counts[rule.label] = (counts[rule.label] || 0) + 1;
        }
      }
    });
  });

  return Object.entries(counts)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
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

    // 1. Public click tracking (no admin password required)
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

    // 2. Password-protected Admin endpoints
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

    // 3. Delete a visitor session (`action: 'delete_session'`)
    if (action === 'delete_session') {
      const targetId = String(body.sessionId || '').trim();
      if (!targetId) {
        return jsonRes(400, { success: false, error: 'Missing sessionId' });
      }
      const delRes = await supabaseFetch(
        `personal_chat_sessions?session_id=eq.${encodeURIComponent(targetId)}`,
        { method: 'DELETE' }
      );
      return jsonRes(200, { success: delRes.ok });
    }

    // 4. Fetch full monitoring stats & complete visitor conversations
    const [sessionsRes, clicksRes] = await Promise.all([
      supabaseFetch(
        'personal_chat_sessions?select=session_id,visitor_name,device_info,city,message_count,conversation,last_active&order=last_active.desc&limit=50'
      ),
      supabaseFetch(
        'personal_click_events?select=id,event_type,label,target_url,created_at&order=created_at.desc&limit=80'
      )
    ]);

    const sessions = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
    const clicks = Array.isArray(clicksRes.data) ? clicksRes.data : [];

    const totalSessions = sessions.length;
    const totalMessages = sessions.reduce((acc, s) => acc + Number(s.message_count || 0), 0);
    const nowMs = Date.now();

    const clickCounts = {};
    clicks.forEach((c) => {
      const k = c.label || 'Unknown';
      clickCounts[k] = (clickCounts[k] || 0) + 1;
    });

    const topClicks = Object.entries(clickCounts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const topTopics = extractTopTopics(sessions);

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
        topClicks,
        topTopics
      },
      integrations,
      recentSessions: sessions.map((s) => {
        const conv = Array.isArray(s.conversation) ? s.conversation : [];
        const lastActiveMs = s.last_active ? new Date(s.last_active).getTime() : 0;
        const isActiveNow = lastActiveMs > 0 && nowMs - lastActiveMs < 5 * 60 * 1000;
        const lastUserTurn = [...conv].reverse().find((m) => m.role === 'user');

        return {
          sessionId: s.session_id,
          visitorName: s.visitor_name || 'Visitor',
          deviceInfo: s.device_info || '',
          city: s.city || '',
          messageCount: s.message_count || Math.ceil(conv.length / 2),
          lastActive: s.last_active,
          isActiveNow,
          lastUserMessage: lastUserTurn?.text || '',
          conversation: conv
        };
      }),
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