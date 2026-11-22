// File: netlify/functions/personalChat.js
// Vikash AI — Fast, Timeout-Safe Personal Assistant Backend (Netlify Functions 2.0 SSE)
// Fixes 504 Gateway Timeout:
// 1. Strict fetchWithTimeout() on EVERY external call (Gemini, GitHub, Instagram, Supabase)
// 2. Parallel pre-fetching (Models + GitHub + Instagram run together in < 1.8s)
// 3. buildValidGeminiContents() fixes HTTP 400 caused by leading welcome (model) turn
// 4. Uses `x-goog-api-key` header for Google AI Studio `AQ.` keys (same as working aiChat.js)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

let cachedModels = null;
let cachedModelsAt = 0;
let cachedWorkingModel = null;

let cachedGithub = null;
let cachedGithubAt = 0;

let cachedInstagram = null;
let cachedInstagramAt = 0;

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getISTDateTime() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  return { dateStr, timeStr };
}

function extractVisibleTextFromParts(parts) {
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p) => p && typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');
}

async function discoverGeminiModels(apiKey) {
  const now = Date.now();
  if (cachedModels && now - cachedModelsAt < 10 * 60 * 1000) {
    return cachedWorkingModel
      ? [cachedWorkingModel, ...cachedModels.filter((m) => m !== cachedWorkingModel)]
      : cachedModels;
  }

  try {
    const res = await fetchWithTimeout(
      'https://generativelanguage.googleapis.com/v1beta/models',
      { headers: { 'x-goog-api-key': apiKey } },
      1600
    );
    if (res.ok) {
      const data = await res.json();
      const valid = (data.models || [])
        .filter(
          (m) =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent')
        )
        .map((m) => m.name.replace(/^models\//, ''))
        .filter(
          (name) =>
            !/embedding|imagen|veo|aqa|tts|audio|robotics|thinking|learnlm|2\.5-pro|2\.5-flash|exp/i.test(name) &&
            /gemini/i.test(name)
        );

      const rankModel = (n) => {
        const low = n.toLowerCase();
        if (low.startsWith('gemini-3') && low.includes('flash-lite')) return 100;
        if (low.startsWith('gemini-3') && low.includes('flash') && !low.includes('preview')) return 96;
        if (low.startsWith('gemini-3') && low.includes('flash')) return 92;
        if (low === 'gemini-flash-lite-latest') return 88;
        if (low === 'gemini-flash-latest') return 85;
        if (low.startsWith('gemini-2.0-flash-lite')) return 80;
        if (low.startsWith('gemini-2.0-flash')) return 75;
        return 50;
      };

      const prioritized = valid.sort((a, b) => rankModel(b) - rankModel(a));
      if (prioritized.length > 0) {
        cachedModels = prioritized;
        cachedModelsAt = now;
        return cachedWorkingModel
          ? [cachedWorkingModel, ...prioritized.filter((m) => m !== cachedWorkingModel)]
          : prioritized;
      }
    }
  } catch {}

  const fallbackList = [
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-2.0-flash-lite'
  ];
  return cachedWorkingModel
    ? [cachedWorkingModel, ...fallbackList.filter((m) => m !== cachedWorkingModel)]
    : fallbackList;
}

async function fetchGitHubData() {
  const username = String(process.env.GITHUB_USERNAME || '').trim();
  if (!username) return null;

  const now = Date.now();
  if (cachedGithub && now - cachedGithubAt < 5 * 60 * 1000) {
    return cachedGithub;
  }

  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Vikash-AI-Assistant'
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN.trim()}`;
  }

  try {
    const [profileRes, reposRes, readmeRes] = await Promise.all([
      fetchWithTimeout(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers }, 1800).catch(() => null),
      fetchWithTimeout(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=15`, { headers }, 1800).catch(() => null),
      fetchWithTimeout(`https://raw.githubusercontent.com/${encodeURIComponent(username)}/${encodeURIComponent(username)}/main/README.md`, {}, 1200).catch(() => null)
    ]);

    const profile = profileRes && profileRes.ok ? await profileRes.json() : null;
    const rawRepos = reposRes && reposRes.ok ? await reposRes.json() : [];
    const readmeText = readmeRes && readmeRes.ok ? (await readmeRes.text()).slice(0, 1200) : '';

    const repos = Array.isArray(rawRepos)
      ? rawRepos
          .filter((r) => !r.fork)
          .slice(0, 10)
          .map((r) => ({
            id: String(r.id),
            name: r.name,
            description: r.description || 'Full-stack / coding project on GitHub.',
            tags: [r.language, ...(Array.isArray(r.topics) ? r.topics.slice(0, 2) : [])].filter(Boolean),
            stars: Number(r.stargazers_count || 0),
            githubUrl: r.html_url,
            liveUrl: r.homepage && /^https?:\/\//i.test(r.homepage) ? r.homepage : ''
          }))
      : [];

    if (profile || repos.length > 0) {
      cachedGithub = {
        username,
        name: profile?.name || username,
        bio: profile?.bio || '',
        avatarUrl: profile?.avatar_url || '',
        followers: profile?.followers ?? 0,
        publicRepos: profile?.public_repos ?? repos.length,
        htmlUrl: profile?.html_url || `https://github.com/${username}`,
        twitterUsername: profile?.twitter_username || '',
        blog: profile?.blog || '',
        location: profile?.location || '',
        repos,
        readmeSnippet: readmeText
      };
      cachedGithubAt = now;
    }
    return cachedGithub;
  } catch {
    return cachedGithub;
  }
}

async function fetchInstagramData() {
  const token = String(process.env.IG_ACCESS_TOKEN || '').trim();
  const userId = String(process.env.IG_USER_ID || '').trim();
  if (!token || !userId) return null;

  const now = Date.now();
  if (cachedInstagram && now - cachedInstagramAt < 5 * 60 * 1000) {
    return cachedInstagram;
  }

  try {
    const profileUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(userId)}?fields=username,name,biography,followers_count,follows_count,media_count&access_token=${encodeURIComponent(token)}`;
    const mediaUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(userId)}/media?fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&limit=10&access_token=${encodeURIComponent(token)}`;

    const [pRes, mRes] = await Promise.all([
      fetchWithTimeout(profileUrl, {}, 1800).catch(() => null),
      fetchWithTimeout(mediaUrl, {}, 1800).catch(() => null)
    ]);
    if (!pRes || !pRes.ok) return cachedInstagram;
    const profile = await pRes.json();
    const mediaJson = mRes && mRes.ok ? await mRes.json() : { data: [] };

    cachedInstagram = {
      username: profile.username || '',
      name: profile.name || '',
      bio: profile.biography || '',
      followersCount: profile.followers_count ?? 0,
      followsCount: profile.follows_count ?? 0,
      mediaCount: profile.media_count ?? 0,
      posts: Array.isArray(mediaJson.data)
        ? mediaJson.data.map((p, idx) => ({
            index: idx + 1,
            caption: (p.caption || '').slice(0, 120),
            type: p.media_type,
            likes: p.like_count ?? 0,
            comments: p.comments_count ?? 0,
            permalink: p.permalink || '',
            timestamp: p.timestamp || ''
          }))
        : []
    };
    cachedInstagramAt = now;
    return cachedInstagram;
  } catch {
    return cachedInstagram;
  }
}

function getSocialLinks(ghData, igData) {
  const ghUrl =
    process.env.GITHUB_URL ||
    ghData?.htmlUrl ||
    (process.env.GITHUB_USERNAME ? `https://github.com/${process.env.GITHUB_USERNAME}` : '');
  const igUrl = process.env.IG_URL || (igData?.username ? `https://instagram.com/${igData.username}` : '');
  const twitterUrl =
    process.env.TWITTER_URL ||
    (ghData?.twitterUsername ? `https://x.com/${ghData.twitterUsername}` : '');
  const discordUrl = process.env.DISCORD_URL || '';
  const facebookUrl = process.env.FACEBOOK_URL || '';
  const whatsappRaw = String(process.env.WHATSAPP_NUMBER || '').replace(/[^\d]/g, '');
  const whatsappUrl = whatsappRaw ? `https://wa.me/${whatsappRaw}` : '';
  const phoneRaw = String(process.env.PUBLIC_PHONE || '').trim();
  const phoneUrl = phoneRaw ? `tel:${phoneRaw.replace(/\s+/g, '')}` : '';
  const email = String(process.env.CONTACT_EMAIL || '').trim();

  return {
    github: ghUrl,
    instagram: igUrl,
    twitter: twitterUrl,
    discord: discordUrl,
    facebook: facebookUrl,
    whatsapp: whatsappUrl,
    phone: phoneRaw,
    phoneUrl,
    email
  };
}

async function supabaseRequest(path, options = {}, timeoutMs = 1500) {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return null;
  try {
    const res = await fetchWithTimeout(
      `${url.replace(/\/$/, '')}/rest/v1/${path}`,
      {
        ...options,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      },
      timeoutMs
    );
    if (!res.ok) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function saveChatTurnToSupabase({ sessionId, visitorName, deviceInfo, city, userMsg, botReply }) {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  if (!sessionId || !url || !key) return;

  const existing = await supabaseRequest(
    `personal_chat_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=conversation,message_count`,
    {},
    1200
  );
  const prevConv = Array.isArray(existing?.[0]?.conversation) ? existing[0].conversation : [];
  const nowIso = new Date().toISOString();
  const updatedConv = [
    ...prevConv,
    { role: 'user', text: userMsg, ts: nowIso },
    { role: 'model', text: botReply, ts: nowIso }
  ].slice(-40);

  await supabaseRequest(
    'personal_chat_sessions?on_conflict=session_id',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        session_id: sessionId,
        visitor_name: visitorName || 'Visitor',
        device_info: deviceInfo || '',
        city: city || '',
        message_count: (existing?.[0]?.message_count || 0) + 1,
        conversation: updatedConv,
        last_active: nowIso
      })
    },
    1200
  );
}

// Ensures Gemini `contents` ALWAYS starts with `role: "user"` and strictly alternates user/model
function buildValidGeminiContents(rawHistory, userMessage) {
  const cleaned = [];
  const list = Array.isArray(rawHistory) ? rawHistory.slice(-8) : [];

  for (const h of list) {
    if (!h) continue;
    const role = h.role === 'user' ? 'user' : 'model';
    const text = String(h.text || h.content || '').trim();
    if (!text) continue;
    if (text.includes('Something went wrong')) continue;

    // Gemini rejects histories starting with `model` (like welcome message)
    if (cleaned.length === 0 && role === 'model') continue;

    if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === role) {
      cleaned[cleaned.length - 1].parts[0].text += '\n' + text;
    } else {
      cleaned.push({ role, parts: [{ text }] });
    }
  }

  const finalText = String(userMessage || 'Hi').trim();
  if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === 'user') {
    if (cleaned[cleaned.length - 1].parts[0].text !== finalText) {
      cleaned[cleaned.length - 1].parts[0].text += '\n' + finalText;
    }
  } else {
    cleaned.push({ role: 'user', parts: [{ text: finalText }] });
  }

  return cleaned;
}

function shouldEnableGoogleSearch(message) {
  const m = String(message || '').toLowerCase();
  return /news|ताज़ा|समाचार|खबर|weather|मौसम|temperature|trending|ट्रेंडिंग|cricket|match|score|price|stock|latest|today|yesterday|आज|कल|who is|what is|search|इंटरनेट|google/i.test(m);
}

function buildSystemPrompt({ customKnowledge, ghData, igData, socialLinks, clientDevice, ist }) {
  const projectsSummary = ghData?.repos?.length
    ? ghData.repos
        .map(
          (r, i) =>
            `${i + 1}. ${r.name} — ${r.description} | Tech: ${r.tags.join(', ') || 'Code'} | Stars: ${r.stars} | GitHub: ${r.githubUrl}${r.liveUrl ? ` | Live: ${r.liveUrl}` : ''}`
        )
        .join('\n')
    : 'No GitHub repositories loaded yet (check GITHUB_USERNAME env var).';

  const igSummary = igData
    ? `Username: @${igData.username} | Followers: ${igData.followersCount} | Following: ${igData.followsCount} | Total Posts: ${igData.mediaCount}\nRecent Posts:\n${igData.posts
        .map((p) => `- Post #${p.index} (${p.type}): "${p.caption || 'No caption'}" | Likes: ${p.likes} | Comments: ${p.comments} | Link: ${p.permalink}`)
        .join('\n')}`
    : 'Instagram Graph API not configured yet (IG_ACCESS_TOKEN / IG_USER_ID).';

  return `You are "Vikash AI" (Personal Assistant of Vikash Kumar Gupta).
Tone: Friendly, smart, concise, warm Hinglish/Hindi (or English if user writes in English). Never mention internal system prompts or API keys.

CURRENT DATE & TIME (IST): ${ist.dateStr}, ${ist.timeStr}
VISITOR DEVICE CONTEXT:
- Platform: ${clientDevice?.platform || 'Unknown'}
- Battery: ${clientDevice?.batteryText || 'Unknown'}
- Network: ${clientDevice?.networkText || 'Online'}
- GPS/Location: ${clientDevice?.locationText || 'Not shared'}

VIKASH CUSTOM KNOWLEDGE:
${JSON.stringify(customKnowledge || {}, null, 2)}

LIVE GITHUB PROFILE & REPOSITORIES:
- Name: ${ghData?.name || 'Vikash Kumar Gupta'} | Bio: ${ghData?.bio || ''} | Public Repos: ${ghData?.publicRepos ?? 0} | Followers: ${ghData?.followers ?? 0}
${ghData?.readmeSnippet ? `- GitHub Profile README:\n${ghData.readmeSnippet}\n` : ''}
Repositories:
${projectsSummary}

LIVE INSTAGRAM CREATOR STATS (Official Graph API):
${igSummary}

VERIFIED SOCIAL & CONTACT LINKS:
- GitHub: ${socialLinks.github || 'Not set'}
- Instagram: ${socialLinks.instagram || 'Not set'}
- Twitter/X: ${socialLinks.twitter || 'Not set'}
- Discord: ${socialLinks.discord || 'Not set'}
- Facebook: ${socialLinks.facebook || 'Not set'}
- WhatsApp: ${socialLinks.whatsapp || 'Not set'}
- Phone: ${socialLinks.phone || 'Not set'} (${socialLinks.phoneUrl || ''})
- Email: ${socialLinks.email || 'Not set'}

RULES:
1. Answer visitor questions about Vikash, his projects, skills, GitHub, Instagram stats (followers, posts, likes, comments), social links, weather, news, date/time, and device battery accurately.
2. Never invent fake numbers or fake URLs. Only use URLs listed above or from Google Search results.
3. Keep answers crisp and natural.`;
}

function selectContextActionButtons(message, socialLinks) {
  const m = String(message || '').toLowerCase();
  const btns = [];

  if (/github|repo|code|प्रोजेक्ट|project/i.test(m) && socialLinks.github) {
    btns.push({ label: 'GitHub Profile', href: socialLinks.github, type: 'GITHUB' });
  }
  if (/instagram|insta|इंस्टा|follower|post|like|comment/i.test(m) && socialLinks.instagram) {
    btns.push({ label: 'Instagram', href: socialLinks.instagram, type: 'INSTAGRAM' });
  }
  if (/twitter|x\.com|ट्विटर/i.test(m) && socialLinks.twitter) {
    btns.push({ label: 'Twitter (X)', href: socialLinks.twitter, type: 'TWITTER' });
  }
  if (/discord|डिस्कॉर्ड/i.test(m) && socialLinks.discord) {
    btns.push({ label: 'Discord', href: socialLinks.discord, type: 'DISCORD' });
  }
  if (/facebook|fb|फेसबुक/i.test(m) && socialLinks.facebook) {
    btns.push({ label: 'Facebook', href: socialLinks.facebook, type: 'FACEBOOK' });
  }
  if (/whatsapp|व्हाट्सएप|contact|संपर्क|बात|hire|freelance|collab/i.test(m) && socialLinks.whatsapp) {
    btns.push({ label: 'WhatsApp पर मैसेज करें', href: socialLinks.whatsapp, type: 'WHATSAPP' });
  }
  if (/call|phone|number|मोबाइल|नंबर|फ़ोन/i.test(m) && socialLinks.phoneUrl) {
    btns.push({ label: `Call ${socialLinks.phone}`, href: socialLinks.phoneUrl, type: 'CALL' });
  }
  if (/social|लिंक|link|सब|all|जुड़/i.test(m) && btns.length === 0) {
    if (socialLinks.github) btns.push({ label: 'GitHub', href: socialLinks.github, type: 'GITHUB' });
    if (socialLinks.instagram) btns.push({ label: 'Instagram', href: socialLinks.instagram, type: 'INSTAGRAM' });
    if (socialLinks.whatsapp) btns.push({ label: 'WhatsApp', href: socialLinks.whatsapp, type: 'WHATSAPP' });
  }

  return btns.slice(0, 3);
}

function selectRelevantProjects(message, ghData) {
  const m = String(message || '').toLowerCase();
  if (!ghData?.repos?.length) return [];
  if (!/project|projects|प्रोजेक्ट|काम|work|portfolio|repo|github|बनाया/i.test(m)) return [];

  const filtered = ghData.repos.filter((r) => {
    const hay = `${r.name} ${r.description} ${r.tags.join(' ')}`.toLowerCase();
    if (/react/i.test(m)) return hay.includes('react') || hay.includes('javascript') || hay.includes('jsx');
    if (/ai|gemini/i.test(m)) return hay.includes('ai') || hay.includes('gemini') || hay.includes('bot');
    return true;
  });

  return (filtered.length > 0 ? filtered : ghData.repos).slice(0, 4);
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: CORS_HEADERS });
  }

  // GET: Health Check (?health=1) or Restore Session History (?sessionId=...)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('health') === '1') {
      const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
      const [models, gh] = await Promise.all([
        apiKey ? discoverGeminiModels(apiKey) : Promise.resolve([]),
        fetchGitHubData()
      ]);
      return jsonResponse(200, {
        ok: true,
        hasGeminiKey: Boolean(apiKey),
        topModels: models.slice(0, 4),
        githubReposLoaded: gh?.repos?.length ?? 0,
        instagramConfigured: Boolean(process.env.IG_ACCESS_TOKEN && process.env.IG_USER_ID),
        supabaseConfigured: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY))
      });
    }

    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) return jsonResponse(400, { success: false, error: 'Missing sessionId' });

    const rows = await supabaseRequest(
      `personal_chat_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=conversation,visitor_name`,
      {},
      1500
    );
    return jsonResponse(200, {
      success: true,
      session: rows?.[0] || null
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Method not allowed' });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { success: false, error: 'Invalid JSON body' });
  }

  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return jsonResponse(500, { success: false, isError: true, error: 'GEMINI_API_KEY is missing in Netlify env.' });
  }

  const ist = getISTDateTime();

  // Fast 1-line dynamic server welcome (strict 3.5s cap so it never times out)
  if (body.isWelcomeGreeting) {
    const models = await discoverGeminiModels(apiKey);
    const seed = Math.floor(1000 + Math.random() * 9000);
    const prompt = `Generate a fresh, warm, 1-line Hindi/Hinglish welcome greeting (max 12 words, seed ${seed}) for "Vikash AI" (Personal Assistant of Vikash Kumar Gupta). Today is ${ist.dateStr}, ${ist.timeStr}. No markdown, just 1 crisp friendly line.`;

    for (const model of models.slice(0, 2)) {
      try {
        const res = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.95, maxOutputTokens: 60 }
            })
          },
          3500
        );
        if (res.ok) {
          const data = await res.json();
          const welcome = extractVisibleTextFromParts(data?.candidates?.[0]?.content?.parts).trim();
          if (welcome) {
            cachedWorkingModel = model;
            return jsonResponse(200, { success: true, welcome });
          }
        }
      } catch {}
    }
    return jsonResponse(200, {
      success: true,
      welcome: 'नमस्ते! मैं Vikash AI हूँ — बताइए, आज क्या जानना है?'
    });
  }

  const userMessage = String(body.message || '').trim();
  if (!userMessage) {
    return jsonResponse(400, { success: false, isError: true, error: 'Empty message' });
  }

  // Run Models discovery + GitHub + Instagram IN PARALLEL (max ~1.8s total!)
  const [models, ghData, igData] = await Promise.all([
    discoverGeminiModels(apiKey),
    fetchGitHubData(),
    fetchInstagramData()
  ]);

  const socialLinks = getSocialLinks(ghData, igData);
  const systemInstruction = buildSystemPrompt({
    customKnowledge: body.customKnowledge,
    ghData,
    igData,
    socialLinks,
    clientDevice: body.clientDevice,
    ist
  });

  // Always start with role: 'user' and strictly alternate user/model
  const contents = buildValidGeminiContents(body.history, userMessage);
  const useSearch = shouldEnableGoogleSearch(userMessage);

  const actionButtons = selectContextActionButtons(userMessage, socialLinks);
  const recommendedProjects = selectRelevantProjects(userMessage, ghData);
  const quickFollowUps = [
    '🚀 Vikash के प्रोजेक्ट्स दिखाओ',
    '📸 Instagram स्टेटस और पोस्ट लाइक्स बताओ',
    '🔗 सारे Social Links दो'
  ];

  // Open SSE response immediately so Netlify sends headers fast and never hits 504
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (obj) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      // Send an immediate SSE comment ping so the gateway receives the first byte right away
      controller.enqueue(encoder.encode(': ping\n\n'));

      let fullReply = '';
      let succeeded = false;
      const debugErrors = [];

      // Try up to 2 top models for true SSE streaming (with strict connect timeout)
      for (const model of models.slice(0, 2)) {
        const attempts = useSearch ? [true, false] : [false];

        for (const withSearch of attempts) {
          const payload = {
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents,
            generationConfig: { temperature: withSearch ? 0.3 : 0.65, maxOutputTokens: 1024 }
          };
          if (withSearch) {
            payload.tools = [{ google_search: {} }];
          }

          try {
            const gRes = await fetchWithTimeout(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-goog-api-key': apiKey
                },
                body: JSON.stringify(payload)
              },
              withSearch ? 6500 : 5000
            );

            if (!gRes.ok || !gRes.body) {
              const errTxt = await gRes.text().catch(() => '');
              debugErrors.push(`${model}(${gRes.status}): ${errTxt.slice(0, 80)}`);
              continue;
            }

            const reader = gRes.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const chunks = buf.split('\n\n');
              buf = chunks.pop() || '';

              for (const chunk of chunks) {
                const line = chunk.split('\n').find((l) => l.startsWith('data:'));
                if (!line) continue;
                const raw = line.replace(/^data:\s*/, '').trim();
                if (!raw || raw === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(raw);
                  const textPart = extractVisibleTextFromParts(parsed?.candidates?.[0]?.content?.parts);
                  if (textPart) {
                    fullReply += textPart;
                    sendEvent({ type: 'delta', text: textPart });
                  }
                } catch {}
              }
            }

            if (fullReply.trim().length > 0) {
              cachedWorkingModel = model;
              succeeded = true;
              break;
            }
          } catch (err) {
            debugErrors.push(`${model}: ${err.message}`);
          }
        }
        if (succeeded) break;
      }

      // Single fast buffered rescue if SSE failed
      if (!succeeded && models[0]) {
        try {
          const rRes = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/${models[0]}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
              },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents,
                generationConfig: { temperature: 0.6, maxOutputTokens: 1024 }
              })
            },
            4500
          );
          if (rRes.ok) {
            const rData = await rRes.json();
            const rText = extractVisibleTextFromParts(rData?.candidates?.[0]?.content?.parts).trim();
            if (rText) {
              fullReply = rText;
              cachedWorkingModel = models[0];
              succeeded = true;
              sendEvent({ type: 'delta', text: fullReply });
            }
          }
        } catch (err) {
          debugErrors.push(`rescue: ${err.message}`);
        }
      }

      if (!succeeded) {
        sendEvent({
          type: 'done',
          isError: true,
          reply: 'Something went wrong, please try again.',
          debug: debugErrors.join(' | ').slice(0, 220)
        });
        controller.close();
        return;
      }

      await saveChatTurnToSupabase({
        sessionId: body.sessionId,
        visitorName: body.visitorName || 'Visitor',
        deviceInfo: body.clientDevice?.platform || '',
        city: body.clientDevice?.locationText || '',
        userMsg: userMessage,
        botReply: fullReply
      }).catch(() => null);

      sendEvent({
        type: 'done',
        isError: false,
        reply: fullReply,
        recommendedProjects,
        actionButtons,
        quickFollowUps
      });
      controller.close();
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      ...CORS_HEADERS
    }
  });
};