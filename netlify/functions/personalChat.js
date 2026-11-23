// File: netlify/functions/personalChat.js
// Vikash AI — Personal Assistant Backend (0ms Intent-Based Smart Routing + Fast SSE Streaming)
// Features:
// - Intent-Based Smart Routing: Casual chat skips GitHub, Instagram & Google Search (0ms overhead!)
// - On-Demand GitHub Auto-Sync, Instagram Graph API, Env Social Links & Google Search Grounding
// - Quota-aware model ranking (prioritizes flash-lite / 2.0-flash, skips 429 quota-exhausted models)
// - Smart Visitor Name Detection, Recruiter Mode & Supabase Session Logging

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-password',
  'Access-Control-Max-Age': '86400'
};

let cachedWorkingModel = 'gemini-flash-lite-latest';
let cachedModels = null;
let cachedModelsAt = 0;
const quotaExhaustedModels = new Set();

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

function getEnvSocialLinks() {
  const username = String(process.env.GITHUB_USERNAME || 'Vikashkgupta').trim();
  const ghUrl = String(process.env.GITHUB_URL || `https://github.com/${username}`).trim();
  const igUrl = String(process.env.IG_URL || '').trim();
  const twitterUrl = String(process.env.TWITTER_URL || '').trim();
  const discordUrl = String(process.env.DISCORD_URL || '').trim();
  const facebookUrl = String(process.env.FACEBOOK_URL || '').trim();
  const linkedinUrl = String(process.env.LINKEDIN_URL || '').trim();
  const portfolioUrl = String(process.env.PORTFOLIO_URL || '').trim();
  const linktreeUrl = String(process.env.LINKTREE_URL || '').trim();
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
    linkedin: linkedinUrl,
    portfolio: portfolioUrl,
    linktree: linktreeUrl,
    whatsapp: whatsappUrl,
    whatsappRaw,
    phone: phoneRaw,
    phoneUrl,
    email
  };
}

// 0ms Intent Classifier: decides ONLY what external sources are genuinely required
function classifyUserIntent(message, chatMode = 'default') {
  const m = String(message || '').trim().toLowerCase();

  const wantsGithub =
    chatMode === 'recruiter' ||
    /project|projects|github|repo|code|coding|mern|react|portfolio|work|skill|tech|stack|btech|aiml|college|study|education|resume|cv|internship|vikash|प्रोजेक्ट|काम|कोड|स्किल|पढ़ाई|कौन है|about/i.test(
      m
    );

  const wantsInstagramStats =
    /instagram|insta|follower|following|post|posts|like|likes|comment|comments|reel|reels|इंस्टा|फॉलोअर|पोस्ट|लाइक/i.test(
      m
    ) && !/link|लिंक|id|url|profile/i.test(m);

  const wantsSocialLinks =
    /link|links|social|instagram|insta|facebook|fb|twitter|x\.com|discord|linkedin|whatsapp|phone|number|call|contact|email|mail|portfolio|linktree|लिंक|संपर्क|नंबर|बात|जुड़|hire|freelance|collab/i.test(
      m
    );

  const wantsLiveSearch =
    !wantsGithub &&
    !wantsInstagramStats &&
    /news|ताज़ा|समाचार|खबर|weather|मौसम|temperature|trending|ट्रेंडिंग|cricket|match|score|ipl|price|stock|gold|latest|today|yesterday|आज|कल|who is|what is|search|इंटरनेट|google|capital|pm|cm|president|result|exam/i.test(
      m
    );

  const wantsLeadCard =
    chatMode === 'recruiter' ||
    /hire|hiring|intern|internship|job|freelance|website banwani|app banwana|project banwana|collab|collaborate|contact vikash|baat karni|बात करनी|काम करवाना/i.test(
      m
    );

  const isPureCasual = !wantsGithub && !wantsInstagramStats && !wantsSocialLinks && !wantsLiveSearch;

  return {
    wantsGithub,
    wantsInstagramStats,
    wantsSocialLinks,
    wantsLiveSearch,
    wantsLeadCard,
    isPureCasual
  };
}

function rankModel(name) {
  const n = String(name || '').toLowerCase();
  if (n === 'gemini-flash-lite-latest') return 100;
  if (n.startsWith('gemini-2.0-flash-lite')) return 95;
  if (n.startsWith('gemini-2.0-flash') && !n.includes('exp')) return 90;
  if (n.startsWith('gemini-3.1-flash-lite')) return 85;
  if (n === 'gemini-flash-latest') return 80;
  if (n.startsWith('gemini-2.5-flash-lite')) return 75;
  if (n.startsWith('gemini-2.5-flash') && !n.includes('pro')) return 70;
  return 40;
}

function getFastModelCandidates() {
  const baseList =
    cachedModels && cachedModels.length > 0
      ? cachedModels
      : [
          'gemini-flash-lite-latest',
          'gemini-2.0-flash-lite',
          'gemini-2.0-flash',
          'gemini-3.1-flash-lite-preview',
          'gemini-flash-latest',
          'gemini-2.5-flash-lite'
        ];

  const ordered = cachedWorkingModel
    ? [cachedWorkingModel, ...baseList.filter((m) => m !== cachedWorkingModel)]
    : baseList;

  const available = ordered.filter((m) => !quotaExhaustedModels.has(m));
  return available.length > 0 ? available : ordered;
}

async function discoverGeminiModelsLazy(apiKey) {
  const now = Date.now();
  if (cachedModels && now - cachedModelsAt < 15 * 60 * 1000) return cachedModels;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1800);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { signal: controller.signal }
    );
    if (!res.ok) return getFastModelCandidates();
    const data = await res.json();
    const valid = (data.models || [])
      .filter(
        (m) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent')
      )
      .map((m) => m.name.replace(/^models\//, ''))
      .filter((name) => !/embedding|imagen|veo|aqa|tts|thinking|robotics|audio/i.test(name))
      .sort((a, b) => rankModel(b) - rankModel(a));

    if (valid.length > 0) {
      cachedModels = valid;
      cachedModelsAt = now;
      return valid;
    }
  } catch {
  } finally {
    clearTimeout(timer);
  }
  return getFastModelCandidates();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGitHubData() {
  const username = String(process.env.GITHUB_USERNAME || '').trim();
  if (!username) return null;

  const now = Date.now();
  if (cachedGithub && now - cachedGithubAt < 10 * 60 * 1000) {
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
      fetchWithTimeout(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers }, 2600),
      fetchWithTimeout(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=12`,
        { headers },
        2600
      ),
      fetchWithTimeout(
        `https://raw.githubusercontent.com/${encodeURIComponent(username)}/${encodeURIComponent(username)}/main/README.md`,
        {},
        2200
      ).catch(() => null)
    ]);

    const profile = profileRes.ok ? await profileRes.json() : null;
    const rawRepos = reposRes.ok ? await reposRes.json() : [];
    const readmeText = readmeRes && readmeRes.ok ? (await readmeRes.text()).slice(0, 1200) : '';

    const repos = Array.isArray(rawRepos)
      ? rawRepos
          .filter((r) => !r.fork)
          .slice(0, 8)
          .map((r) => ({
            id: String(r.id),
            name: r.name,
            description: r.description || 'Full-stack / coding project on GitHub.',
            tags: [r.language, ...(Array.isArray(r.topics) ? r.topics.slice(0, 2) : [])].filter(Boolean),
            stars: Number(r.stargazers_count || 0),
            updatedAt: r.updated_at || '',
            githubUrl: r.html_url,
            liveUrl: r.homepage && /^https?:\/\//i.test(r.homepage) ? r.homepage : ''
          }))
      : [];

    cachedGithub = {
      username,
      name: profile?.name || username,
      bio: profile?.bio || '',
      followers: profile?.followers ?? 0,
      publicRepos: profile?.public_repos ?? repos.length,
      htmlUrl: profile?.html_url || `https://github.com/${username}`,
      twitterUsername: profile?.twitter_username || '',
      location: profile?.location || '',
      repos,
      readmeSnippet: readmeText
    };
    cachedGithubAt = now;
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
  if (cachedInstagram && now - cachedInstagramAt < 10 * 60 * 1000) {
    return cachedInstagram;
  }

  try {
    const profileUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(userId)}?fields=username,name,biography,followers_count,follows_count,media_count&access_token=${encodeURIComponent(token)}`;
    const mediaUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(userId)}/media?fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&limit=8&access_token=${encodeURIComponent(token)}`;

    const [pRes, mRes] = await Promise.all([
      fetchWithTimeout(profileUrl, {}, 2600),
      fetchWithTimeout(mediaUrl, {}, 2600)
    ]);
    if (!pRes.ok) return null;
    const profile = await pRes.json();
    const mediaJson = mRes.ok ? await mRes.json() : { data: [] };

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
            caption: (p.caption || '').slice(0, 100),
            type: p.media_type,
            likes: p.like_count ?? 0,
            comments: p.comments_count ?? 0,
            permalink: p.permalink || ''
          }))
        : []
    };
    cachedInstagramAt = now;
    return cachedInstagram;
  } catch {
    return cachedInstagram;
  }
}

function buildValidGeminiContents(historyInput, currentMessage) {
  const contents = [];
  const list = Array.isArray(historyInput) ? historyInput : [];

  for (const item of list) {
    if (!item) continue;
    const text = String(item.text ?? item.content ?? '').trim();
    if (!text) continue;
    if (text.includes('Something went wrong')) continue;

    const role = item.role === 'user' ? 'user' : 'model';
    if (contents.length === 0 && role === 'model') continue;

    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += `\n${text}`;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }

  const finalMsg = String(currentMessage || '').trim();
  if (finalMsg) {
    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      if (contents[contents.length - 1].parts[0].text !== finalMsg) {
        contents[contents.length - 1].parts[0].text += `\n${finalMsg}`;
      }
    } else {
      contents.push({ role: 'user', parts: [{ text: finalMsg }] });
    }
  }

  return contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Namaste!' }] }];
}

function detectVisitorNameFromText(message, currentName) {
  if (currentName && currentName !== 'Visitor') return currentName;
  const text = String(message || '').trim();
  const patterns = [
    /(?:mera naam|my name is|i am|i'm|main|mai)\s+([A-Za-z\u0900-\u097F]{2,20})(?:\s+(?:hai|hoon|hu|bol raha|speaking))?/i
  ];
  for (const rx of patterns) {
    const match = text.match(rx);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (!/^(vikash|ai|bot|hello|hi|kya|kaise|aur|from|in)$/i.test(candidate)) {
        return candidate.charAt(0).toUpperCase() + candidate.slice(1);
      }
    }
  }
  return currentName || 'Visitor';
}

function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const keys = [
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    String(process.env.SUPABASE_ANON_KEY || '').trim()
  ].filter(Boolean);
  return { url, keys };
}

async function supabaseRequest(path, options = {}) {
  const { url, keys } = getSupabaseConfig();
  if (!url || keys.length === 0) {
    return { ok: false, data: null, error: 'SUPABASE_URL or API key missing' };
  }

  let lastError = 'Unknown Supabase error';
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
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${url}/rest/v1/${path}`, {
        ...options,
        signal: controller.signal,
        headers: authHeaders
      });
      const text = await res.text().catch(() => '');
      if (res.ok) {
        return { ok: true, data: text ? JSON.parse(text) : null, error: null };
      }
      lastError = `HTTP ${res.status}: ${text.slice(0, 180)}`;
    } catch (err) {
      lastError = err?.message || 'Supabase fetch exception';
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, data: null, error: lastError };
}

async function saveChatTurnToSupabase({ sessionId, visitorName, deviceInfo, city, userMsg, botReply }) {
  if (!sessionId) return { logged: false, reason: 'No sessionId' };

  const existingRes = await supabaseRequest(
    `personal_chat_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=conversation,message_count,visitor_name`
  );
  const existingRow = Array.isArray(existingRes.data) ? existingRes.data[0] : null;
  const prevConv = Array.isArray(existingRow?.conversation) ? existingRow.conversation : [];
  const finalName =
    visitorName && visitorName !== 'Visitor'
      ? visitorName
      : existingRow?.visitor_name || 'Visitor';

  const nowIso = new Date().toISOString();
  const updatedConv = [
    ...prevConv,
    { role: 'user', text: userMsg, ts: nowIso },
    { role: 'model', text: botReply, ts: nowIso }
  ].slice(-40);

  const writeRes = await supabaseRequest('personal_chat_sessions?on_conflict=session_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      session_id: sessionId,
      visitor_name: finalName,
      device_info: deviceInfo || '',
      city: city || '',
      message_count: Number(existingRow?.message_count || 0) + 1,
      conversation: updatedConv,
      last_active: nowIso
    })
  });

  if (!writeRes.ok) {
    console.error('[Vikash AI Supabase Save Error]:', writeRes.error);
    return { logged: false, reason: writeRes.error };
  }
  return { logged: true };
}

// Modular Slim System Prompt — injects ONLY the blocks needed for this query
function buildModularSystemPrompt({
  intent,
  chatMode,
  visitorName,
  customKnowledge,
  ghData,
  igData,
  socialLinks,
  clientDevice,
  ist
}) {
  const baseIntro = `You are "Vikash AI", the smart Personal Assistant of Vikash Kumar Gupta (MERN Stack Developer & B.Tech AIML student).
Tone: Friendly, smart, concise, natural Hinglish/Hindi (or English if user writes in English).
Current IST Date & Time: ${ist.dateStr}, ${ist.timeStr}
Visitor Name: ${visitorName !== 'Visitor' ? visitorName : 'Friend'}
Visitor Device: ${clientDevice?.platform || 'Web'} | Battery: ${clientDevice?.batteryText || 'Unknown'} | Location: ${clientDevice?.locationText || 'Not shared'}
${chatMode === 'recruiter' ? 'MODE: Recruiter / Portfolio Mode — highlight Vikash’s B.Tech AIML background, MERN Stack projects, and readiness for internships/roles.' : ''}`;

  if (intent.isPureCasual) {
    return `${baseIntro}
Keep replies crisp, warm, and natural. Never invent fake links or fake stats.`;
  }

  const sections = [baseIntro];

  if (intent.wantsGithub && customKnowledge) {
    sections.push(`VIKASH BIO & KNOWLEDGE:\n${JSON.stringify(customKnowledge)}`);
  }

  if (intent.wantsGithub && ghData) {
    const projectsSummary = ghData.repos?.length
      ? ghData.repos
          .map(
            (r, i) =>
              `${i + 1}. ${r.name} — ${r.description} | Tech: ${r.tags.join(', ') || 'Code'} | Stars: ${r.stars} | GitHub: ${r.githubUrl}${r.liveUrl ? ` | Live: ${r.liveUrl}` : ''}`
          )
          .join('\n')
      : 'No repos fetched.';
    sections.push(
      `LIVE GITHUB (${ghData.username} | Repos: ${ghData.publicRepos} | Followers: ${ghData.followers}):\n${
        ghData.readmeSnippet ? `README:\n${ghData.readmeSnippet}\n` : ''
      }Projects:\n${projectsSummary}`
    );
  }

  if (intent.wantsInstagramStats) {
    if (igData) {
      sections.push(
        `LIVE INSTAGRAM (@${igData.username} | Followers: ${igData.followersCount} | Following: ${igData.followsCount} | Posts: ${igData.mediaCount}):\n` +
          igData.posts
            .map((p) => `- Post #${p.index} (${p.type}): "${p.caption}" | Likes: ${p.likes} | Comments: ${p.comments} | ${p.permalink}`)
            .join('\n')
      );
    } else {
      sections.push(
        `INSTAGRAM NOTE: Live Instagram Graph API metrics are not connected yet, so share Vikash's Instagram profile link (${socialLinks.instagram || 'not set'}) politely without inventing follower/like numbers.`
      );
    }
  }

  if (intent.wantsSocialLinks || intent.wantsGithub || intent.wantsInstagramStats) {
    sections.push(
      `VERIFIED ENV SOCIAL & CONTACT LINKS (Use ONLY these exact URLs when asked):\n` +
        `- GitHub: ${socialLinks.github || 'Not set'}\n` +
        `- Instagram: ${socialLinks.instagram || 'Not set'}\n` +
        `- Facebook: ${socialLinks.facebook || 'Not set'}\n` +
        `- LinkedIn: ${socialLinks.linkedin || 'Not set'}\n` +
        `- Twitter/X: ${socialLinks.twitter || 'Not set'}\n` +
        `- Discord: ${socialLinks.discord || 'Not set'}\n` +
        `- Portfolio: ${socialLinks.portfolio || 'Not set'}\n` +
        `- Linktree: ${socialLinks.linktree || 'Not set'}\n` +
        `- WhatsApp: ${socialLinks.whatsapp || 'Not set'}\n` +
        `- Phone: ${socialLinks.phone || 'Not set'}\n` +
        `- Email: ${socialLinks.email || 'Not set'}`
    );
  }

  sections.push(
    'RULES: Never fabricate URLs or stats. If Google Search is active, give accurate, up-to-date answers concisely.'
  );

  return sections.join('\n\n');
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
  if (/facebook|fb|फेसबुक/i.test(m) && socialLinks.facebook) {
    btns.push({ label: 'Facebook', href: socialLinks.facebook, type: 'FACEBOOK' });
  }
  if (/linkedin|लिंक्डइन/i.test(m) && socialLinks.linkedin) {
    btns.push({ label: 'LinkedIn', href: socialLinks.linkedin, type: 'LINKEDIN' });
  }
  if (/twitter|x\.com|ट्विटर/i.test(m) && socialLinks.twitter) {
    btns.push({ label: 'Twitter (X)', href: socialLinks.twitter, type: 'TWITTER' });
  }
  if (/discord|डिस्कॉर्ड/i.test(m) && socialLinks.discord) {
    btns.push({ label: 'Discord', href: socialLinks.discord, type: 'DISCORD' });
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
    if (socialLinks.facebook) btns.push({ label: 'Facebook', href: socialLinks.facebook, type: 'FACEBOOK' });
    if (socialLinks.whatsapp) btns.push({ label: 'WhatsApp', href: socialLinks.whatsapp, type: 'WHATSAPP' });
  }

  return btns.slice(0, 4);
}

function selectRelevantProjects(message, ghData, intent) {
  if (!intent.wantsGithub || !ghData?.repos?.length) return [];
  const m = String(message || '').toLowerCase();
  if (!/project|projects|प्रोजेक्ट|काम|work|portfolio|repo|github|बनाया|latest/i.test(m)) return [];

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
    // GET: Health/DB test or Restore session history
    if (req.method === 'GET') {
      const url = new URL(req.url);

      if (url.searchParams.get('test_db') === '1') {
        const { url: sbUrl, keys } = getSupabaseConfig();
        const testRes = await saveChatTurnToSupabase({
          sessionId: 'TEST-DIAGNOSTIC',
          visitorName: 'Vikash Diagnostic',
          deviceInfo: 'Browser Test',
          city: 'Mairwa',
          userMsg: 'Test message',
          botReply: 'Supabase connection verified!'
        });
        return jsonResponse(200, {
          supabaseUrl: sbUrl,
          hasSecretKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
          hasPublishableKey: Boolean(process.env.SUPABASE_ANON_KEY),
          keyCount: keys.length,
          writeResult: testRes
        });
      }

      const sessionId = url.searchParams.get('sessionId');
      if (!sessionId) return jsonResponse(400, { success: false, error: 'Missing sessionId' });

      const res = await supabaseRequest(
        `personal_chat_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=conversation,visitor_name`
      );
      const row = Array.isArray(res.data) ? res.data[0] : null;
      return jsonResponse(200, { success: true, session: row || null });
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
      return jsonResponse(500, {
        success: false,
        isError: true,
        error: 'GEMINI_API_KEY is missing in Netlify env.'
      });
    }

    const ist = getISTDateTime();
    const chatMode = body.chatMode === 'recruiter' ? 'recruiter' : 'default';

    // Dynamic 1-line welcome greeting (0ms external API overhead!)
    if (body.isWelcomeGreeting) {
      const prompt =
        chatMode === 'recruiter'
          ? `Generate a warm, crisp 1-line Hindi/Hinglish welcome greeting (max 14 words) for "Vikash AI" in Portfolio/Recruiter mode, inviting the visitor to explore Vikash Kumar Gupta's MERN Stack & AI projects.`
          : `Generate a fresh, warm 1-line Hindi/Hinglish welcome greeting (max 12 words) for "Vikash AI" (Personal Assistant of Vikash Kumar Gupta). Today is ${ist.dateStr}, ${ist.timeStr}. No markdown, just 1 friendly line.`;

      const models = getFastModelCandidates();
      for (const model of models.slice(0, 3)) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
              method: 'POST',
              signal: controller.signal,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.9, maxOutputTokens: 60 }
              })
            }
          );
          clearTimeout(timer);
          if (res.ok) {
            const data = await res.json();
            const welcome = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (welcome) {
              cachedWorkingModel = model;
              return jsonResponse(200, { success: true, welcome });
            }
          } else if (res.status === 429) {
            quotaExhaustedModels.add(model);
          }
        } catch {
          clearTimeout(timer);
        }
      }

      return jsonResponse(200, {
        success: true,
        welcome:
          chatMode === 'recruiter'
            ? 'नमस्ते! Vikash के MERN Stack और AI प्रोजेक्ट्स देखने के लिए स्वागत है।'
            : 'नमस्ते! मैं Vikash AI हूँ — बताइए, आज क्या जानना है?'
      });
    }

    const userMessage = String(body.message || '').trim();
    if (!userMessage) {
      return jsonResponse(400, { success: false, isError: true, error: 'Empty message' });
    }

    // 1. Classify Intent in 0ms
    const intent = classifyUserIntent(userMessage, chatMode);
    const detectedVisitorName = detectVisitorNameFromText(userMessage, body.visitorName);
    const socialLinks = getEnvSocialLinks();

    // 2. Fetch ONLY what is actually needed for this query!
    const [ghData, igData] = await Promise.all([
      intent.wantsGithub ? fetchGitHubData() : Promise.resolve(cachedGithub),
      intent.wantsInstagramStats ? fetchInstagramData() : Promise.resolve(cachedInstagram)
    ]);

    // Warm up GitHub cache in the background on casual chats so the NEXT turn is instant
    if (!intent.wantsGithub && !cachedGithub) {
      fetchGitHubData().catch(() => null);
    }

    const systemInstruction = buildModularSystemPrompt({
      intent,
      chatMode,
      visitorName: detectedVisitorName,
      customKnowledge: intent.wantsGithub ? body.customKnowledge : null,
      ghData,
      igData,
      socialLinks,
      clientDevice: body.clientDevice,
      ist
    });

    const contents = buildValidGeminiContents(body.history, userMessage);
    const actionButtons = intent.wantsSocialLinks || intent.wantsGithub || intent.wantsInstagramStats
      ? selectContextActionButtons(userMessage, socialLinks)
      : [];
    const recommendedProjects = selectRelevantProjects(userMessage, ghData, intent);
    const quickFollowUps = [
      '🚀 Vikash के प्रोजेक्ट्स दिखाओ',
      '📸 Instagram स्टेटस और पोस्ट लाइक्स बताओ',
      '🔗 सारे Social Links दो'
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (obj) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        let fullReply = '';
        let succeeded = false;
        const attemptErrors = [];

        // Ensure discovered models are loaded if initial fast list fails
        let candidateModels = getFastModelCandidates();
        const searchAttempts = intent.wantsLiveSearch ? [true, false] : [false];

        for (let pass = 0; pass < 2 && !succeeded; pass++) {
          if (pass === 1) {
            candidateModels = await discoverGeminiModelsLazy(apiKey);
          }

          for (const model of candidateModels.slice(0, 5)) {
            if (succeeded) break;

            for (const useSearch of searchAttempts) {
              const abortCtrl = new AbortController();
              const timer = setTimeout(() => abortCtrl.abort(), useSearch ? 8000 : 4500);

              try {
                const payload = {
                  systemInstruction: { parts: [{ text: systemInstruction }] },
                  contents,
                  generationConfig: { temperature: 0.65, maxOutputTokens: 900 }
                };
                if (useSearch) {
                  payload.tools = [{ google_search: {} }];
                }

                const gRes = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
                  {
                    method: 'POST',
                    signal: abortCtrl.signal,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                  }
                );

                if (!gRes.ok || !gRes.body) {
                  clearTimeout(timer);
                  const errTxt = await gRes.text().catch(() => '');
                  attemptErrors.push(`${model}[search=${useSearch}](${gRes.status}): ${errTxt.slice(0, 70)}`);
                  if (gRes.status === 429) {
                    quotaExhaustedModels.add(model);
                  }
                  if (cachedWorkingModel === model) {
                    cachedWorkingModel = null;
                  }
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
                      const textPart =
                        parsed?.candidates?.[0]?.content?.parts
                          ?.filter((p) => !p.thought)
                          ?.map((p) => p.text || '')
                          .join('') || '';
                      if (textPart) {
                        fullReply += textPart;
                        sendEvent({ type: 'delta', text: textPart });
                      }
                    } catch {}
                  }
                }

                clearTimeout(timer);
                if (fullReply.trim().length > 0) {
                  cachedWorkingModel = model;
                  succeeded = true;
                  break;
                }
              } catch (err) {
                clearTimeout(timer);
                attemptErrors.push(`${model}[search=${useSearch}]: ${err?.message || 'aborted'}`);
                if (cachedWorkingModel === model) {
                  cachedWorkingModel = null;
                }
              }
            }
          }
        }

        if (!succeeded) {
          const debugSummary = attemptErrors.slice(0, 4).join(' | ');
          console.error('[Vikash AI Stream Exhausted]:', debugSummary);
          sendEvent({
            type: 'done',
            isError: true,
            debugError: debugSummary,
            reply: 'Something went wrong, please try again.'
          });
          controller.close();
          return;
        }

        const supabaseStatus = await saveChatTurnToSupabase({
          sessionId: body.sessionId,
          visitorName: detectedVisitorName,
          deviceInfo: body.clientDevice?.platform || '',
          city: body.clientDevice?.locationText || '',
          userMsg: userMessage,
          botReply: fullReply
        });

        sendEvent({
          type: 'done',
          isError: false,
          reply: fullReply,
          detectedVisitorName: detectedVisitorName !== 'Visitor' ? detectedVisitorName : '',
          showLeadCard: intent.wantsLeadCard,
          whatsappNumber: socialLinks.whatsappRaw || '919931890824',
          recommendedProjects,
          actionButtons,
          quickFollowUps,
          supabaseStatus
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
  } catch (err) {
    console.error('[Vikash AI Handler Error]:', err);
    return jsonResponse(500, {
      success: false,
      isError: true,
      error: err?.message || 'Unexpected server error'
    });
  }
};