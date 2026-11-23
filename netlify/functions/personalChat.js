// File: netlify/functions/personalChat.js
// Vikash AI — 0ms Intent-Based Smart Router & Ultra-Fast Streaming Backend (Netlify Functions 2.0 SSE)
// Architecture:
// - 0ms Synchronous Intent Router (CASUAL_CHAT, SOCIAL_LINKS, INSTAGRAM_STATS, GITHUB_PROJECTS, LIVE_SEARCH, FULL_BIO)
// - Zero Pre-Flight Model Discovery (fires directly on gemini-flash-lite-latest; discovers /models only on failure)
// - Dynamic Slim Modular System Prompts (minimal input tokens per intent = 2x faster first token)
// - Non-blocking Background GitHub Cache Warmup during Casual Chat streams

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-password',
  'Access-Control-Max-Age': '86400'
};

const FAST_DEFAULT_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest'
];

let cachedWorkingModel = 'gemini-flash-lite-latest';
let cachedModels = null;
let cachedModelsAt = 0;
const quotaBlockedModels = new Set();

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

async function fetchWithTimeout(url, options = {}, timeoutMs = 3500) {
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

function isSupportedTextModel(name) {
  const n = String(name || '').toLowerCase();
  if (
    n.includes('tts') ||
    n.includes('image') ||
    n.includes('imagen') ||
    n.includes('veo') ||
    n.includes('embedding') ||
    n.includes('aqa') ||
    n.includes('audio') ||
    n.includes('robotics') ||
    n.includes('thinking') ||
    n.includes('learnlm') ||
    n.includes('2.5-pro') ||
    n.includes('2.5-flash') ||
    n.includes('exp')
  ) {
    return false;
  }
  return n.includes('gemini');
}

function rankModel(name) {
  const n = String(name || '').toLowerCase();
  if (quotaBlockedModels.has(name)) return -100;
  if (n === 'gemini-flash-lite-latest') return 100;
  if (n.startsWith('gemini-2.0-flash-lite')) return 96;
  if (n.startsWith('gemini-2.0-flash') && !n.includes('lite')) return 92;
  if (n.startsWith('gemini-3') && n.includes('flash-lite')) return 88;
  if (n === 'gemini-flash-latest') return 84;
  if (n.startsWith('gemini-3') && n.includes('flash')) return 60;
  return 40;
}

function buildDiverseModelOrder(list) {
  const usable = list.filter((m) => !quotaBlockedModels.has(m));
  const pool = usable.length > 0 ? usable : list;
  const base =
    cachedWorkingModel && !quotaBlockedModels.has(cachedWorkingModel)
      ? [cachedWorkingModel, ...pool.filter((m) => m !== cachedWorkingModel)]
      : [...pool];

  const distinct = [];
  const usedFamilies = new Set();
  for (const m of base) {
    const family = m.includes('2.0-flash-lite')
      ? '2.0-lite'
      : m.includes('2.0-flash')
      ? '2.0-flash'
      : m.includes('3.1-flash-lite')
      ? '3.1-lite'
      : m.includes('flash-lite-latest')
      ? 'lite-latest'
      : m;
    if (!usedFamilies.has(family)) {
      usedFamilies.add(family);
      distinct.push(m);
    }
  }
  for (const m of base) {
    if (!distinct.includes(m)) distinct.push(m);
  }
  return distinct;
}

function getFastModelCandidates() {
  return buildDiverseModelOrder(FAST_DEFAULT_MODELS);
}

// Lazy fallback only — never called on healthy requests
async function discoverGeminiModelsLazy(apiKey) {
  const now = Date.now();
  if (cachedModels && now - cachedModelsAt < 15 * 60 * 1000) {
    return buildDiverseModelOrder(cachedModels);
  }

  try {
    const res = await fetchWithTimeout(
      'https://generativelanguage.googleapis.com/v1beta/models',
      { headers: { 'x-goog-api-key': apiKey } },
      1800
    );
    if (res.ok) {
      const data = await res.json();
      const found = (data.models || [])
        .filter(
          (m) =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent')
        )
        .map((m) => m.name.replace(/^models\//, ''))
        .filter(isSupportedTextModel)
        .sort((a, b) => rankModel(b) - rankModel(a));

      if (found.length > 0) {
        cachedModels = found;
        cachedModelsAt = now;
        return buildDiverseModelOrder(found);
      }
    }
  } catch (err) {
    console.warn('[personalChat] Lazy model discovery warning:', err?.message);
  }

  return getFastModelCandidates();
}

function extractVisibleText(parts) {
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p) => p && typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');
}

async function fetchGitHubData() {
  const username = String(process.env.GITHUB_USERNAME || 'Vikashkgupta').trim();
  if (!username) return null;

  const now = Date.now();
  if (cachedGithub && now - cachedGithubAt < 10 * 60 * 1000) {
    return cachedGithub;
  }

  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Vikash-AI-Assistant'
  };
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN.trim()}`;
  }

  try {
    const [profileRes, reposRes, readmeRes] = await Promise.all([
      fetchWithTimeout(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers }, 2000),
      fetchWithTimeout(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=15`,
        { headers },
        2000
      ),
      fetchWithTimeout(
        `https://raw.githubusercontent.com/${encodeURIComponent(username)}/${encodeURIComponent(username)}/main/README.md`,
        {},
        1500
      ).catch(() => null)
    ]);

    const profile = profileRes.ok ? await profileRes.json() : null;
    const rawRepos = reposRes.ok ? await reposRes.json() : [];
    const readmeText = readmeRes && readmeRes.ok ? (await readmeRes.text()).slice(0, 1400) : '';

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
            updatedAt: r.pushed_at || r.updated_at || '',
            githubUrl: r.html_url,
            liveUrl: r.homepage && /^https?:\/\//i.test(r.homepage) ? r.homepage : ''
          }))
      : [];

    cachedGithub = {
      username,
      name: profile?.name || 'Vikash Kumar Gupta',
      bio: profile?.bio || '',
      avatarUrl: profile?.avatar_url || '',
      followers: profile?.followers ?? 0,
      publicRepos: profile?.public_repos ?? repos.length,
      htmlUrl: profile?.html_url || `https://github.com/${username}`,
      twitterUsername: profile?.twitter_username || '_VikashkGupta',
      blog: profile?.blog || 'https://vikashkumargupta.netlify.app',
      location: profile?.location || 'Bihar / UP, India',
      repos,
      readmeSnippet: readmeText
    };
    cachedGithubAt = now;
    return cachedGithub;
  } catch (err) {
    console.warn('[personalChat] GitHub fetch warning:', err?.message);
    return cachedGithub;
  }
}

async function fetchInstagramData() {
  const token = String(process.env.IG_ACCESS_TOKEN || '').trim();
  const userId = String(process.env.IG_USER_ID || '').trim();
  if (!token || !userId) return null;

  const now = Date.now();
  if (cachedInstagram && now - cachedInstagramAt < 10 * 60 * 1000) {
    return cachedInstagram;
  }

  try {
    const profileUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(userId)}?fields=username,name,biography,followers_count,follows_count,media_count&access_token=${encodeURIComponent(token)}`;
    const mediaUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(userId)}/media?fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&limit=10&access_token=${encodeURIComponent(token)}`;

    const [pRes, mRes] = await Promise.all([
      fetchWithTimeout(profileUrl, {}, 2000),
      fetchWithTimeout(mediaUrl, {}, 2000)
    ]);
    if (!pRes.ok) return null;

    const profile = await pRes.json();
    const mediaJson = mRes.ok ? await mRes.json() : { data: [] };

    cachedInstagram = {
      username: profile.username || '_vikashkgupta',
      name: profile.name || 'Vikash Kumar Gupta',
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
  } catch (err) {
    console.warn('[personalChat] Instagram fetch warning:', err?.message);
    return cachedInstagram;
  }
}

function getSocialLinks(ghData, igData) {
  const ghUsername = (process.env.GITHUB_USERNAME || 'Vikashkgupta').trim();
  const ghUrl = process.env.GITHUB_URL || ghData?.htmlUrl || `https://github.com/${ghUsername}`;
  const igUrl = process.env.IG_URL || `https://instagram.com/${igData?.username || '_vikashkgupta'}`;
  const twitterUrl =
    process.env.TWITTER_URL || `https://x.com/${ghData?.twitterUsername || '_VikashkGupta'}`;
  const discordUrl = String(process.env.DISCORD_URL || '').trim();
  const facebookUrl = String(
    process.env.FACEBOOK_URL || 'https://www.facebook.com/vikash.kumar.gupta.289183'
  ).trim();
  const whatsappRaw = String(process.env.WHATSAPP_NUMBER || '919931890824').replace(/[^\d]/g, '');
  const whatsappUrl = whatsappRaw ? `https://wa.me/${whatsappRaw}` : '';
  const phoneRaw = String(process.env.PUBLIC_PHONE || '+919931890824').trim();
  const phoneUrl = phoneRaw ? `tel:${phoneRaw.replace(/\s+/g, '')}` : '';
  const email = String(process.env.CONTACT_EMAIL || 'vikashkumargupta1000@gmail.com').trim();
  const linkedinUrl = String(
    process.env.LINKEDIN_URL || 'https://www.linkedin.com/in/vikash-kumar-gupta-505899295'
  ).trim();
  const portfolioUrl = String(
    process.env.PORTFOLIO_URL || ghData?.blog || 'https://vikashkumargupta.netlify.app'
  ).trim();
  const linktreeUrl = String(process.env.LINKTREE_URL || 'https://linktr.ee/vikashgupta').trim();

  return {
    github: ghUrl,
    instagram: igUrl,
    twitter: twitterUrl,
    discord: discordUrl,
    facebook: facebookUrl,
    linkedin: linkedinUrl,
    portfolio: portfolioUrl,
    linktree: linktreeUrl,
    whatsapp: whatsappUrl,
    phone: phoneRaw,
    phoneUrl,
    email
  };
}

function detectVisitorNameFromText(message, currentName) {
  const text = String(message || '').trim();
  const patterns = [
    /(?:mera naam|my name is|i am|i'm|main|mai)\s+([A-Za-z\u0900-\u097F]{2,20})(?:\s+(?:hai|hoon|hu|bol raha|speaking))?/i,
    /(?:मेरा नाम|मैं)\s+([\u0900-\u097F]{2,20})\s+(?:हूँ|हु|बोल रहा)/i
  ];
  for (const rx of patterns) {
    const m = text.match(rx);
    if (m && m[1]) {
      const candidate = m[1].trim();
      const ignore = ['vikash', 'theek', 'thik', 'accha', 'acha', 'fine', 'good', 'here', 'from', 'ek', 'एक', 'ठीक'];
      if (!ignore.includes(candidate.toLowerCase())) {
        return candidate.charAt(0).toUpperCase() + candidate.slice(1);
      }
    }
  }
  return currentName || 'Visitor';
}

function detectIntentFlags(message) {
  const m = String(message || '').toLowerCase();
  const isHiringOrCollab = /hire|hiring|intern|internship|job|freelance|website banwani|project banwana|collab|work with|contact vikash|बात करनी|काम करवाना|वेबसाइट/i.test(
    m
  );
  return { isHiringOrCollab };
}

// 0ms Smart Intent Router
// Intents: CASUAL_CHAT | SOCIAL_LINKS | INSTAGRAM_STATS | GITHUB_PROJECTS | LIVE_SEARCH | FULL_BIO
function classifyIntent(message, history = [], chatMode = 'default') {
  const m = String(message || '').trim().toLowerCase();

  const isLiveSearch = /\b(news|weather|temperature|trending|cricket|match|score|price|stock|bitcoin|crypto|latest|today|yesterday|who is|what is)\b|ताज़ा|समाचार|खबर|मौसम|तापमान|ट्रेंडिंग|क्रिकेट|स्कोर|आज|कल|इंटरनेट|google/i.test(
    m
  );
  const isInstagramStats = /follower|followers|following|post|posts|reel|reels|like|likes|comment|comments|ig stats|instagram stats|फ़ॉलोअर्स|फॉलोअर|पोस्ट|रील|लाइक|कमेंट/i.test(
    m
  );
  const isGithubOrProjects = /\b(github|repo|repos|repository|repositories|project|projects|code|coding|tech stack|skills|skill|stack|commit|latest work|working on|portfolio site|react|node|ai|gemini)\b|प्रोजेक्ट|प्रोजेक्ट्स|कोडिंग|स्किल|स्किल्स|गिटहब|बनाया|काम कर रहे/i.test(
    m
  );
  const isSocialLinkRequest = /\b(instagram|insta|facebook|fb|linkedin|twitter|x\.com|whatsapp|link|links|linktree|contact|phone|number|call|email|mail|discord|social|socials|profile)\b|लिंक|संपर्क|नंबर|फ़ोन|कॉल|व्हाट्सएप|इंस्टा|फेसबुक|लिंक्डइन|ट्विटर|सोशल/i.test(
    m
  );
  const isFullBioRequest = /\b(bio|about vikash|tell me about vikash|who is vikash|everything|full profile|complete profile|overview|introduce)\b|पूरा बायो|सब बताओ|विकास कौन|विकास के बारे|परिचय|बायो/i.test(
    m
  );

  // 1. Big combined question or bio + projects + socials
  if (
    isFullBioRequest ||
    (isGithubOrProjects && isSocialLinkRequest && /सब|all|both|पूरा|bio|about/i.test(m))
  ) {
    return {
      intent: 'FULL_BIO',
      needsGithub: true,
      needsInstagram: isInstagramStats,
      needsSearch: false
    };
  }

  // 2. Live Web Search (Weather, News, Cricket, etc.)
  if (isLiveSearch && !isGithubOrProjects && !isInstagramStats) {
    return {
      intent: 'LIVE_SEARCH',
      needsGithub: false,
      needsInstagram: false,
      needsSearch: true
    };
  }

  // 3. Instagram Stats / Followers / Posts
  if (isInstagramStats) {
    return {
      intent: 'INSTAGRAM_STATS',
      needsGithub: false,
      needsInstagram: true,
      needsSearch: false
    };
  }

  // 4. GitHub / Projects / Coding Skills (or Recruiter mode queries)
  if (isGithubOrProjects || (chatMode === 'recruiter' && m.length > 15 && !isSocialLinkRequest)) {
    return {
      intent: 'GITHUB_PROJECTS',
      needsGithub: true,
      needsInstagram: false,
      needsSearch: false
    };
  }

  // 5. Pure Social / Contact Link requests (0ms from process.env)
  if (isSocialLinkRequest) {
    return {
      intent: 'SOCIAL_LINKS',
      needsGithub: false,
      needsInstagram: false,
      needsSearch: false
    };
  }

  // Follow-up check using recent history (for short follow-ups like "isme se react wala?", "live link do", "aur batao")
  const isShortFollowUp =
    m.split(/\s+/).length <= 8 &&
    /\b(react|ai|gemini|live|link|more|details|uska|iska|isme|usme|aur|which|one|second|first)\b|उसमें|इसमें|उसका|इसका|और|लिंक|कौनसा|दिखाओ/i.test(
      m
    );
  if (isShortFollowUp && Array.isArray(history) && history.length > 0) {
    const recentText = history
      .slice(-2)
      .map((h) => String(h?.text || '').toLowerCase())
      .join(' ');
    if (/github|repo|project|प्रोजेक्ट|kshirsagar/i.test(recentText)) {
      return {
        intent: 'GITHUB_PROJECTS',
        needsGithub: true,
        needsInstagram: false,
        needsSearch: false
      };
    }
    if (/instagram|follower|post|like|इंस्टा/i.test(recentText)) {
      return {
        intent: 'INSTAGRAM_STATS',
        needsGithub: false,
        needsInstagram: true,
        needsSearch: false
      };
    }
  }

  // 6. Default: Ultra-Fast Casual Chat (0ms API overhead)
  return {
    intent: 'CASUAL_CHAT',
    needsGithub: false,
    needsInstagram: false,
    needsSearch: false
  };
}

async function supabaseRequest(path, options = {}) {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const keys = [
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    String(process.env.SUPABASE_ANON_KEY || '').trim()
  ].filter(Boolean);

  if (!url || keys.length === 0) {
    return { ok: false, error: 'SUPABASE_URL or Keys missing in Netlify env' };
  }

  let lastError = null;
  for (const key of keys) {
    const authHeaders = {
      apikey: key,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (key.startsWith('eyJ')) {
      authHeaders.Authorization = `Bearer ${key}`;
    }

    try {
      const res = await fetchWithTimeout(
        `${url.replace(/\/$/, '')}/rest/v1/${path}`,
        { ...options, headers: authHeaders },
        2800
      );
      const text = await res.text().catch(() => '');
      if (res.ok) {
        return { ok: true, data: text ? JSON.parse(text) : null };
      }
      lastError = { ok: false, status: res.status, error: `HTTP ${res.status}: ${text.slice(0, 180)}` };
    } catch (err) {
      lastError = { ok: false, error: err?.message || 'Network timeout' };
    }
  }
  return lastError || { ok: false, error: 'Unknown Supabase error' };
}

async function saveChatTurnToSupabase({ sessionId, visitorName, deviceInfo, city, history, userMsg, botReply }) {
  if (!sessionId) return { logged: false, reason: 'Missing sessionId' };
  try {
    const nowIso = new Date().toISOString();
    const priorTurns = Array.isArray(history)
      ? history
          .filter((h) => h && h.text && !String(h.text).includes('Something went wrong'))
          .slice(-30)
          .map((h) => ({
            role: h.role === 'user' ? 'user' : 'model',
            text: String(h.text),
            ts: h.ts || nowIso
          }))
      : [];

    const updatedConv = [
      ...priorTurns,
      { role: 'user', text: userMsg, ts: nowIso },
      { role: 'model', text: botReply, ts: nowIso }
    ].slice(-40);

    const userMsgCount = updatedConv.filter((t) => t.role === 'user').length;

    const writeRes = await supabaseRequest('personal_chat_sessions?on_conflict=session_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        session_id: sessionId,
        visitor_name: visitorName || 'Visitor',
        device_info: deviceInfo || '',
        city: city || '',
        message_count: Math.max(1, userMsgCount),
        conversation: updatedConv,
        last_active: nowIso
      })
    });
    if (!writeRes?.ok) {
      return { logged: false, reason: writeRes?.error || 'Failed to upsert row' };
    }
    return { logged: true };
  } catch (err) {
    return { logged: false, reason: err?.message };
  }
}

function buildValidGeminiContents(history, userMessage) {
  const cleaned = [];
  for (const h of history) {
    if (!h || !h.text) continue;
    const role = h.role === 'user' ? 'user' : 'model';
    const text = String(h.text).trim();
    if (!text || text.includes('Something went wrong')) continue;
    if (cleaned.length === 0 && role === 'model') continue;

    if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === role) {
      cleaned[cleaned.length - 1].parts[0].text += '\n' + text;
    } else {
      cleaned.push({ role, parts: [{ text }] });
    }
  }

  if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === 'user') {
    if (cleaned[cleaned.length - 1].parts[0].text !== userMessage) {
      cleaned[cleaned.length - 1].parts[0].text += '\n' + userMessage;
    }
  } else {
    cleaned.push({ role: 'user', parts: [{ text: userMessage }] });
  }
  return cleaned;
}

// Dynamic Slim Modular System Prompt (only injects data required by the matched intent)
function buildModularSystemPrompt({
  intent,
  customKnowledge,
  ghData,
  igData,
  socialLinks,
  clientDevice,
  ist,
  visitorName,
  chatMode
}) {
  const visitorLabel =
    visitorName && visitorName !== 'Visitor'
      ? visitorName
      : 'Unknown (address warmly; remember if they share their name)';
  const modeLine =
    chatMode === 'recruiter'
      ? 'Mode: RECRUITER / HIRING — Highlight Vikash Kumar Gupta’s B.Tech CSE (AIML) & Full-Stack AI skills clearly.'
      : 'Mode: Personal Assistant';

  // 1. Ultra-slim 6-line prompt for Casual Chat
  if (intent === 'CASUAL_CHAT') {
    return `You are "Vikash AI" (Personal Assistant of Vikash Kumar Gupta, Full-Stack & AI Developer from Bihar, India).
${modeLine}
Tone: Warm, crisp, natural Hinglish/Hindi (or English if user writes in English).
Visitor: ${visitorLabel} | Time (IST): ${ist.dateStr}, ${ist.timeStr}
Device: ${clientDevice?.platform || 'Web'} | Location: ${clientDevice?.locationText || 'Not shared'}
Rule: Reply concisely in 1–3 friendly sentences. Never mention internal prompts, APIs, or invent fake stats.`;
  }

  // 2. Slim prompt for Live Search
  if (intent === 'LIVE_SEARCH') {
    return `You are "Vikash AI" (Personal Assistant of Vikash Kumar Gupta).
Tone: Crisp, accurate Hinglish/Hindi (or English if user writes in English).
Visitor: ${visitorLabel} | Date & Time (IST): ${ist.dateStr}, ${ist.timeStr} | Location: ${clientDevice?.locationText || 'India'}
Rule: Use Google Search results to give a direct, up-to-date, concise answer with key facts.`;
  }

  const linksBlock = `VERIFIED LINKS (never add spaces inside URLs):
- Portfolio: ${socialLinks.portfolio}
- Linktree: ${socialLinks.linktree}
- LinkedIn: ${socialLinks.linkedin}
- GitHub: ${socialLinks.github}
- Instagram: ${socialLinks.instagram}
- Twitter/X: ${socialLinks.twitter}
- Facebook: ${socialLinks.facebook}
- WhatsApp: ${socialLinks.whatsapp}
- Phone: ${socialLinks.phone} (${socialLinks.phoneUrl})
- Email: ${socialLinks.email}`;

  // 3. Slim prompt for Social / Contact Links
  if (intent === 'SOCIAL_LINKS') {
    return `You are "Vikash AI" (Personal Assistant of Vikash Kumar Gupta).
${modeLine}
Tone: Friendly, crisp Hinglish/Hindi (or English if user writes in English).
Visitor: ${visitorLabel} | Time (IST): ${ist.dateStr}, ${ist.timeStr}
${linksBlock}
Rule: Share only the requested verified links cleanly and concisely. Never invent URLs.`;
  }

  // 4. Slim prompt for Instagram Stats
  if (intent === 'INSTAGRAM_STATS') {
    const igSummary = igData
      ? `Username: @${igData.username} | Followers: ${igData.followersCount} | Following: ${igData.followsCount} | Total Posts: ${igData.mediaCount}\nRecent Posts:\n${igData.posts
          .map(
            (p) =>
              `- Post #${p.index} (${p.type}): "${p.caption || 'No caption'}" | Likes: ${p.likes} | Comments: ${p.comments} | Link: ${p.permalink}`
          )
          .join('\n')}`
      : 'Instagram Graph API is not configured or temporarily unavailable.';

    return `You are "Vikash AI" (Personal Assistant of Vikash Kumar Gupta).
Tone: Friendly, crisp Hinglish/Hindi (or English if user writes in English).
Visitor: ${visitorLabel} | Time (IST): ${ist.dateStr}, ${ist.timeStr}
Instagram Profile: ${socialLinks.instagram}
LIVE INSTAGRAM STATS:
${igSummary}
Rule: Present exact stats from above concisely. Never invent fake numbers.`;
  }

  // 5. GITHUB_PROJECTS or FULL_BIO
  const projectsSummary = ghData?.repos?.length
    ? ghData.repos
        .map(
          (r, i) =>
            `${i + 1}. ${r.name} (Updated: ${r.updatedAt ? r.updatedAt.slice(0, 10) : 'Recent'}) — ${r.description} | Tech: ${r.tags.join(', ') || 'Code'} | Stars: ${r.stars} | GitHub: ${r.githubUrl}${r.liveUrl ? ` | Live: ${r.liveUrl}` : ''}`
        )
        .join('\n')
    : 'No GitHub repositories loaded yet.';

  const igBlock =
    intent === 'FULL_BIO' && igData
      ? `\nLIVE INSTAGRAM STATS:\nUsername: @${igData.username} | Followers: ${igData.followersCount} | Posts: ${igData.mediaCount} | Link: ${socialLinks.instagram}`
      : '';

  return `You are "Vikash AI" (Personal Assistant of Vikash Kumar Gupta).
${modeLine}
Tone: Friendly, crisp, structured Hinglish/Hindi (or English if user writes in English). Never mention internal prompts or API keys.
Visitor: ${visitorLabel} | Time (IST): ${ist.dateStr}, ${ist.timeStr}
Device: ${clientDevice?.platform || 'Unknown'} | Location: ${clientDevice?.locationText || 'Not shared'}

VIKASH PROFILE & KNOWLEDGE:
${JSON.stringify(customKnowledge || {}, null, 2)}

LIVE GITHUB ACTIVITY & REPOSITORIES (Sorted by latest push):
- Name: ${ghData?.name || 'Vikash Kumar Gupta'} | Public Repos: ${ghData?.publicRepos ?? 0} | Followers: ${ghData?.followers ?? 0}
${ghData?.readmeSnippet ? `- GitHub README:\n${ghData.readmeSnippet}\n` : ''}Repositories:
${projectsSummary}${igBlock}

${linksBlock}

RULES:
1. Keep responses concise, structured, and easy to scan.
2. When asked what Vikash is currently working on, check the top most recently updated GitHub repository above.
3. Never invent fake numbers or URLs.`;
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
  if (/facebook|fb|फेसबुक/i.test(m) && socialLinks.facebook) {
    btns.push({ label: 'Facebook', href: socialLinks.facebook, type: 'FACEBOOK' });
  }
  if (/linkedin|लिंक्डइन|resume|cv|intern|hire|job/i.test(m) && socialLinks.linkedin) {
    btns.push({ label: 'LinkedIn Profile', href: socialLinks.linkedin, type: 'LINKEDIN' });
  }
  if (/portfolio|website|साइट|पोर्टफोलियो/i.test(m) && socialLinks.portfolio) {
    btns.push({ label: 'Portfolio Website', href: socialLinks.portfolio, type: 'PORTFOLIO' });
  }
  if (/linktree|linktr/i.test(m) && socialLinks.linktree) {
    btns.push({ label: 'All Links (Linktree)', href: socialLinks.linktree, type: 'LINKTREE' });
  }
  if (/whatsapp|व्हाट्सएप|contact|संपर्क|बात|hire|freelance|collab/i.test(m) && socialLinks.whatsapp) {
    btns.push({ label: 'WhatsApp पर मैसेज करें', href: socialLinks.whatsapp, type: 'WHATSAPP' });
  }
  if (/call|phone|number|मोबाइल|नंबर|फ़ोन/i.test(m) && socialLinks.phoneUrl) {
    btns.push({ label: `Call ${socialLinks.phone}`, href: socialLinks.phoneUrl, type: 'CALL' });
  }
  if (/social|लिंक|link|सब|all|जुड़|bio|बायो/i.test(m) && btns.length === 0) {
    if (socialLinks.github) btns.push({ label: 'GitHub', href: socialLinks.github, type: 'GITHUB' });
    if (socialLinks.linkedin) btns.push({ label: 'LinkedIn', href: socialLinks.linkedin, type: 'LINKEDIN' });
    if (socialLinks.instagram) btns.push({ label: 'Instagram', href: socialLinks.instagram, type: 'INSTAGRAM' });
    if (socialLinks.linktree) btns.push({ label: 'All Links', href: socialLinks.linktree, type: 'LINKTREE' });
  }

  return btns.slice(0, 3);
}

function selectRelevantProjects(message, ghData) {
  const m = String(message || '').toLowerCase();
  if (!ghData?.repos?.length) return [];
  if (!/project|projects|प्रोजेक्ट|काम|work|portfolio|repo|github|बनाया|latest|recent|working on|bio|बायो/i.test(m)) {
    return [];
  }

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
    return new Response('', { status: 200, headers: CORS_HEADERS });
  }

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      if (url.searchParams.get('test_db') === '1') {
        const testWrite = await saveChatTurnToSupabase({
          sessionId: 'TEST-DIAGNOSTIC',
          visitorName: 'Vikash Test',
          deviceInfo: 'Browser Diagnostic',
          city: 'Patna',
          history: [],
          userMsg: 'Test message',
          botReply: 'Supabase connected!'
        });
        return jsonResponse(200, {
          supabaseUrl: process.env.SUPABASE_URL || 'MISSING',
          hasSecretKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
          hasPublishableKey: Boolean(process.env.SUPABASE_ANON_KEY),
          writeResult: testWrite
        });
      }

      const sessionId = url.searchParams.get('sessionId');
      if (!sessionId) return jsonResponse(400, { success: false, error: 'Missing sessionId' });

      const rowsRes = await supabaseRequest(
        `personal_chat_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=conversation,visitor_name`
      );
      return jsonResponse(200, {
        success: true,
        session: rowsRes?.data?.[0] || null
      });
    }

    if (req.method !== 'POST') {
      return jsonResponse(405, { success: false, error: 'Method not allowed' });
    }

    let body = {};
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { success: false, isError: true, error: 'Invalid JSON body' });
    }

    const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return jsonResponse(500, {
        success: false,
        isError: true,
        error: 'GEMINI_API_KEY is missing in Netlify Environment Variables.'
      });
    }

    const ist = getISTDateTime();

    // Welcome Greeting (Zero pre-flight /models call)
    if (body.isWelcomeGreeting) {
      const modeHint = body.chatMode === 'recruiter' ? ' (Recruiter/Hiring mode)' : '';
      const prompt = `Generate a fresh, warm, 1-line Hindi/Hinglish welcome greeting (max 12 words) for "Vikash AI" (Personal Assistant of Vikash Kumar Gupta)${modeHint}. Today is ${ist.dateStr}, ${ist.timeStr}. No markdown, just 1 crisp friendly line.`;

      const fastModels = getFastModelCandidates().slice(0, 2);
      for (const model of fastModels) {
        try {
          const res = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.95, maxOutputTokens: 55 }
              })
            },
            2500
          );
          if (res.ok) {
            const data = await res.json();
            const welcome = extractVisibleText(data?.candidates?.[0]?.content?.parts).trim();
            if (welcome) {
              cachedWorkingModel = model;
              return jsonResponse(200, { success: true, welcome });
            }
          }
        } catch {}
      }
      return jsonResponse(200, {
        success: true,
        welcome:
          body.chatMode === 'recruiter'
            ? 'Namaste! Welcome to Vikash Kumar Gupta’s Portfolio & AI Assistant.'
            : 'नमस्ते! मैं Vikash AI हूँ — बताइए, आज क्या जानना है?'
      });
    }

    const userMessage = String(body.message || '').trim();
    if (!userMessage) {
      return jsonResponse(400, { success: false, isError: true, error: 'Empty message' });
    }

    const historyArr = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const chatMode = body.chatMode || 'default';
    const detectedVisitorName = detectVisitorNameFromText(userMessage, body.visitorName);
    const { isHiringOrCollab } = detectIntentFlags(userMessage);

    // 0ms Smart Intent Routing
    const route = classifyIntent(userMessage, historyArr, chatMode);

    // Only fetch the exact external API(s) required by this intent
    const [ghData, igData] = await Promise.all([
      route.needsGithub ? fetchGitHubData() : Promise.resolve(cachedGithub),
      route.needsInstagram ? fetchInstagramData() : Promise.resolve(cachedInstagram)
    ]);

    // Trick 3: Background GitHub Cache Warmup on Casual Chat (non-blocking!)
    let warmupPromise = null;
    if (
      route.intent === 'CASUAL_CHAT' &&
      (!cachedGithub || Date.now() - cachedGithubAt >= 10 * 60 * 1000)
    ) {
      warmupPromise = fetchGitHubData().catch(() => null);
    }

    const socialLinks = getSocialLinks(ghData, igData);
    const systemInstruction = buildModularSystemPrompt({
      intent: route.intent,
      customKnowledge: body.customKnowledge,
      ghData,
      igData,
      socialLinks,
      clientDevice: body.clientDevice,
      ist,
      visitorName: detectedVisitorName,
      chatMode
    });

    const contents = buildValidGeminiContents(historyArr, userMessage);
    const useSearch = route.needsSearch;
    const actionButtons = selectContextActionButtons(userMessage, socialLinks);
    const recommendedProjects = route.needsGithub ? selectRelevantProjects(userMessage, ghData) : [];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (obj) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        // Immediate SSE heartbeat
        controller.enqueue(encoder.encode(': ping\n\n'));

        let fullReply = '';
        let succeeded = false;
        const errors = [];
        const triedModels = new Set();

        const tryModelStream = async (model) => {
          triedModels.add(model);
          const attempts = useSearch ? [true, false] : [false];
          for (const withSearch of attempts) {
            try {
              const payload = {
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents,
                generationConfig: {
                  temperature: withSearch ? 0.3 : route.intent === 'CASUAL_CHAT' ? 0.7 : 0.6,
                  maxOutputTokens: route.intent === 'CASUAL_CHAT' ? 280 : 900
                }
              };
              if (withSearch) {
                payload.tools = [{ google_search: {} }];
              }

              const gRes = await fetchWithTimeout(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                  body: JSON.stringify(payload)
                },
                5500
              );

              if (!gRes.ok || !gRes.body) {
                const errTxt = await gRes.text().catch(() => '');
                if (gRes.status === 429) {
                  quotaBlockedModels.add(model);
                }
                errors.push(`${model}[search=${withSearch}](${gRes.status}): ${errTxt.slice(0, 100)}`);
                if (cachedWorkingModel === model) cachedWorkingModel = null;
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
                    const textPart = extractVisibleText(parsed?.candidates?.[0]?.content?.parts);
                    if (textPart) {
                      fullReply += textPart;
                      sendEvent({ type: 'delta', text: textPart });
                    }
                  } catch {}
                }
              }

              if (fullReply.trim().length > 0) {
                cachedWorkingModel = model;
                return true;
              }
            } catch (err) {
              errors.push(`${model}[search=${withSearch}]: ${err?.message}`);
              if (cachedWorkingModel === model) cachedWorkingModel = null;
            }
          }
          return false;
        };

        // Pass 1: Zero Pre-Flight Discovery — fire directly on fast default models
        const fastCandidates = getFastModelCandidates().slice(0, 3);
        for (const model of fastCandidates) {
          if (quotaBlockedModels.has(model)) continue;
          succeeded = await tryModelStream(model);
          if (succeeded) break;
        }

        // Pass 2: Lazy Model Discovery ONLY if Pass 1 failed
        if (!succeeded) {
          const discovered = await discoverGeminiModelsLazy(apiKey);
          for (const model of discovered.slice(0, 4)) {
            if (triedModels.has(model) || quotaBlockedModels.has(model)) continue;
            succeeded = await tryModelStream(model);
            if (succeeded) break;
          }
        }

        // Pass 3: Non-streaming rescue fallback
        if (!succeeded) {
          for (const model of getFastModelCandidates().slice(0, 2)) {
            try {
              const rescueRes = await fetchWithTimeout(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                  body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    contents,
                    generationConfig: { temperature: 0.6, maxOutputTokens: 900 }
                  })
                },
                4500
              );
              if (rescueRes.ok) {
                const rData = await rescueRes.json();
                const rescuedText = extractVisibleText(rData?.candidates?.[0]?.content?.parts).trim();
                if (rescuedText) {
                  fullReply = rescuedText;
                  cachedWorkingModel = model;
                  succeeded = true;
                  sendEvent({ type: 'delta', text: rescuedText });
                  break;
                }
              }
            } catch {}
          }
        }

        if (!succeeded) {
          sendEvent({
            type: 'done',
            isError: true,
            reply: 'Something went wrong, please try again.',
            debugError: errors.join(' | ')
          });
          controller.close();
          return;
        }

        const supabaseStatus = await saveChatTurnToSupabase({
          sessionId: body.sessionId,
          visitorName: detectedVisitorName,
          deviceInfo: body.clientDevice?.platform || '',
          city: body.clientDevice?.locationText || '',
          history: historyArr,
          userMsg: userMessage,
          botReply: fullReply
        });

        sendEvent({
          type: 'done',
          isError: false,
          intent: route.intent,
          reply: fullReply,
          detectedVisitorName,
          showLeadCard: isHiringOrCollab,
          whatsappNumber: String(process.env.WHATSAPP_NUMBER || '919931890824').replace(/[^\d]/g, ''),
          supabaseStatus,
          recommendedProjects,
          actionButtons
        });

        // Give background warmup a brief window to settle if still running (already ran concurrently during stream)
        if (warmupPromise) {
          await Promise.race([warmupPromise, new Promise((r) => setTimeout(r, 150))]);
        }

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
  } catch (err) {
    console.error('[personalChat] Fatal exception:', err);
    return jsonResponse(500, {
      success: false,
      isError: true,
      error: err?.message || 'Unexpected server error'
    });
  }
};