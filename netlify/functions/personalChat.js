// File: netlify/functions/personalChat.js
// Vikash AI — Personal Assistant Backend (Netlify Functions 2.0 Web-Standard SSE)
// Features:
// - 0ms Intent-Based Smart Routing (only calls GitHub, IG, Supabase Notes, or Search when needed)
// - Date-Stamped Temporal Memory (`Saved on` date + `days ago` so past events are never confused with present)
// - Active Gemini 3 / Flash-Lite models with `thinkingBudget: 0` & safe `buildValidGeminiContents`

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-password',
  'Access-Control-Max-Age': '86400'
};

let cachedWorkingModel = null;
let cachedDiscoveredModels = null;
let cachedDiscoveredAt = 0;

const notFoundModels = new Set([
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro'
]);
const quotaExhaustedModels = new Set();

let cachedGithub = null;
let cachedGithubAt = 0;

let cachedInstagram = null;
let cachedInstagramAt = 0;

let cachedCustomNotes = null;
let cachedCustomNotesAt = 0;

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
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
  if (notFoundModels.has(n) || quotaExhaustedModels.has(n)) return false;
  if (/embedding|imagen|veo|aqa|tts|audio|robotics|learnlm|image|2\.0-|2\.5-|exp/i.test(n)) {
    return false;
  }
  return n.includes('gemini');
}

function rankModel(name) {
  const n = String(name || '').toLowerCase();
  if (n === 'gemini-flash-latest') return 100;
  if (n === 'gemini-3.1-flash-lite-preview') return 96;
  if (n === 'gemini-3-flash-preview') return 92;
  if (n === 'gemini-flash-lite-latest') return 88;
  if (n.startsWith('gemini-3') && n.includes('flash-lite')) return 84;
  if (n.startsWith('gemini-3') && n.includes('flash')) return 80;
  return 50;
}

function getDefaultCandidateModels() {
  const base = [
    'gemini-flash-latest',
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview',
    'gemini-flash-lite-latest'
  ].filter((m) => !quotaExhaustedModels.has(m) && !notFoundModels.has(m));

  const fallbackPool =
    base.length > 0
      ? base
      : ['gemini-flash-latest', 'gemini-3.1-flash-lite-preview', 'gemini-3-flash-preview'];

  if (cachedWorkingModel && !quotaExhaustedModels.has(cachedWorkingModel) && !notFoundModels.has(cachedWorkingModel)) {
    return [cachedWorkingModel, ...fallbackPool.filter((m) => m !== cachedWorkingModel)];
  }
  return fallbackPool;
}

async function refreshDiscoveredModelsInBackground(apiKey) {
  const now = Date.now();
  if (cachedDiscoveredModels && now - cachedDiscoveredAt < 10 * 60 * 1000) return;
  try {
    const res = await fetchWithTimeout(
      'https://generativelanguage.googleapis.com/v1beta/models',
      { headers: { 'x-goog-api-key': apiKey } },
      2500
    );
    if (!res.ok) return;
    const data = await res.json();
    const valid = (data.models || [])
      .filter(
        (m) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent')
      )
      .map((m) => m.name.replace(/^models\//, ''))
      .filter(isSupportedTextModel)
      .sort((a, b) => rankModel(b) - rankModel(a));

    if (valid.length > 0) {
      cachedDiscoveredModels = valid;
      cachedDiscoveredAt = Date.now();
    }
  } catch {}
}

function classifyUserIntent(message, chatMode = 'default') {
  const m = String(message || '').trim().toLowerCase();

  const isGreetingOrShort =
    m.length <= 28 &&
    /^(hi+|hello+|hey+|hlo+|namaste|pranam|ram ram|good morning|good evening|good night|kaise ho|kya haal|how are you|who are you|kaun ho|kon ho|ok+|okay|thanks|thank you|shukriya|bye|tata|hmm+|acha|accha|thik hai|theek hai)[\s!?.😊🙏]*$/i.test(
      m
    );

  const needsGitHub =
    chatMode === 'recruiter' ||
    /project|projects|प्रोजेक्ट|github|repo|code|coding|work|portfolio|बनाया|tech stack|mern|react|django|asp\.net|latest commit|repository|skill|skills|resume|cv/i.test(
      m
    );

  const needsInstagramStats =
    /instagram|insta|इंस्टा|follower|followers|following|post|posts|like|likes|comment|comments|reel|reels|creator/i.test(
      m
    );

  const needsSocialLinks =
    needsInstagramStats ||
    /link|links|लिंक|social|facebook|fb|फेसबुक|twitter|x\.com|ट्विटर|discord|linkedin|linktree|whatsapp|व्हाट्सएप|contact|संपर्क|number|phone|मोबाइल|नंबर|email|mail|जुड़/i.test(
      m
    );

  const needsHiringLead =
    chatMode === 'recruiter' ||
    /hire|hiring|intern|internship|job|freelance|collab|collaboration|website banwani|app banwana|बात करनी|work together/i.test(
      m
    );

  const needsAboutBio =
    chatMode === 'recruiter' ||
    needsGitHub ||
    /vikash|विकास|about|intro|parichay|परिचय|kaun|who|college|btech|aiml|diploma|study|पढ़ाई|education|aktu|unnao|mairwa|barabanki|siwan|training|award|softpro|makartaj|update|नया|exam|एग्जाम|abhi|kahan|कहां/i.test(
      m
    );

  const needsGoogleSearch =
    !isGreetingOrShort &&
    !needsGitHub &&
    !needsInstagramStats &&
    /news|ताज़ा|समाचार|खबर|weather|मौसम|temperature|trending|ट्रेंडिंग|cricket|match|score|ipl|price|stock|gold|latest|today|yesterday|आज|कल|search|इंटरनेट|google|who is|what is|kab hai|कब है/i.test(
      m
    );

  return {
    isGreetingOrShort,
    needsGitHub,
    needsInstagramStats,
    needsSocialLinks,
    needsHiringLead,
    needsAboutBio,
    needsGoogleSearch
  };
}

function detectVisitorNameFromText(text) {
  const s = String(text || '').trim();
  const patterns = [
    /(?:my name is|i am|i'm|this is)\s+([a-zA-Z]{2,20})/i,
    /(?:mera naam|main|mai)\s+([a-zA-Z\u0900-\u097F]{2,20})\s+(?:hai|hoon|hu|bol raha|bol rahi)/i
  ];
  for (const rx of patterns) {
    const match = s.match(rx);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (!/^(kya|kaun|ek|the|from|here|good|fine|ok)$/i.test(candidate)) {
        return candidate.charAt(0).toUpperCase() + candidate.slice(1);
      }
    }
  }
  return '';
}

function buildValidGeminiContents(history, userMessage) {
  const cleaned = [];

  for (const msg of Array.isArray(history) ? history : []) {
    const role = msg?.role === 'assistant' || msg?.role === 'model' ? 'model' : 'user';
    const text = String(msg?.text || msg?.content || '').trim();
    if (!text) continue;
    if (text.includes('Something went wrong')) continue;

    if (cleaned.length === 0 && role === 'model') continue;

    if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === role) {
      cleaned[cleaned.length - 1].parts[0].text += '\n' + text;
    } else {
      cleaned.push({ role, parts: [{ text }] });
    }
  }

  const finalUserText = String(userMessage || 'Namaste!').trim();
  if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === 'user') {
    if (cleaned[cleaned.length - 1].parts[0].text !== finalUserText) {
      cleaned[cleaned.length - 1].parts[0].text += '\n' + finalUserText;
    }
  } else {
    cleaned.push({ role: 'user', parts: [{ text: finalUserText }] });
  }

  return cleaned;
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
      fetchWithTimeout(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers }, 2500),
      fetchWithTimeout(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=12`,
        { headers },
        2500
      ),
      fetchWithTimeout(
        `https://raw.githubusercontent.com/${encodeURIComponent(username)}/${encodeURIComponent(username)}/main/README.md`,
        {},
        2000
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
            updatedAt: r.pushed_at || r.updated_at || '',
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
      fetchWithTimeout(profileUrl, {}, 2500),
      fetchWithTimeout(mediaUrl, {}, 2500)
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

function getSocialLinks(ghData, igData, customKnowledge) {
  const extra = customKnowledge?.extraProfiles || {};
  const ghUser = String(process.env.GITHUB_USERNAME || 'Vikashkgupta').trim();

  const ghUrl = String(process.env.GITHUB_URL || ghData?.htmlUrl || `https://github.com/${ghUser}`).trim();
  const igUrl = String(
    process.env.IG_URL || extra.instagram || (igData?.username ? `https://instagram.com/${igData.username}` : '')
  ).trim();
  const twitterUrl = String(
    process.env.TWITTER_URL || (ghData?.twitterUsername ? `https://x.com/${ghData.twitterUsername}` : '')
  ).trim();
  const discordUrl = String(process.env.DISCORD_URL || '').trim();
  const facebookUrl = String(process.env.FACEBOOK_URL || extra.facebook || '').trim();
  const linkedinUrl = String(process.env.LINKEDIN_URL || extra.linkedin || '').trim();
  const portfolioUrl = String(process.env.PORTFOLIO_URL || extra.portfolio || '').trim();
  const linktreeUrl = String(process.env.LINKTREE_URL || extra.linktree || '').trim();

  const whatsappRaw = String(process.env.WHATSAPP_NUMBER || '919931890824').replace(/[^\d]/g, '');
  const whatsappUrl = whatsappRaw ? `https://wa.me/${whatsappRaw}` : '';
  const phoneRaw = String(process.env.PUBLIC_PHONE || '').trim();
  const phoneUrl = phoneRaw ? `tel:${phoneRaw.replace(/\s+/g, '')}` : '';
  const email = String(process.env.CONTACT_EMAIL || extra.email || '').trim();

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
    whatsappNumber: whatsappRaw || '919931890824',
    phone: phoneRaw,
    phoneUrl,
    email
  };
}

function getSupabaseCredentials() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const keys = [
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    String(process.env.SUPABASE_ANON_KEY || '').trim()
  ].filter(Boolean);
  return { url, keys };
}

async function supabaseRequest(path, options = {}, timeoutMs = 2500) {
  const { url, keys } = getSupabaseCredentials();
  if (!url || keys.length === 0) {
    return { ok: false, status: 0, data: null, error: 'Missing SUPABASE_URL or API key' };
  }

  let lastResult = { ok: false, status: 0, data: null, error: 'Unknown error' };

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
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${url}/rest/v1/${path}`, {
        ...options,
        signal: controller.signal,
        headers: authHeaders
      });
      const text = await res.text().catch(() => '');
      let parsed = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }
      if (res.ok) {
        return { ok: true, status: res.status, data: parsed, error: null };
      }
      lastResult = {
        ok: false,
        status: res.status,
        data: parsed,
        error: `HTTP ${res.status}: ${text.slice(0, 180)}`
      };
    } catch (err) {
      lastResult = { ok: false, status: 0, data: null, error: err?.message || 'Fetch error' };
    } finally {
      clearTimeout(timer);
    }
  }

  return lastResult;
}

async function fetchLiveCustomNotes() {
  const now = Date.now();
  if (cachedCustomNotes && now - cachedCustomNotesAt < 2 * 60 * 1000) {
    return cachedCustomNotes;
  }
  const res = await supabaseRequest(
    'vikash_custom_notes?select=category,note_text,created_at&order=created_at.desc&limit=40',
    { method: 'GET' },
    1800
  );
  if (res.ok && Array.isArray(res.data)) {
    cachedCustomNotes = res.data;
    cachedCustomNotesAt = now;
    return res.data;
  }
  return cachedCustomNotes || [];
}

async function saveChatTurnToSupabase({
  sessionId,
  visitorName,
  deviceInfo,
  city,
  history,
  userMsg,
  botReply
}) {
  if (!sessionId) return { logged: false, reason: 'No sessionId' };

  const nowIso = new Date().toISOString();
  const baseTurns = Array.isArray(history)
    ? history
        .filter((h) => h && h.text)
        .slice(-16)
        .map((h) => ({
          role: h.role === 'user' ? 'user' : 'model',
          text: String(h.text),
          ts: nowIso
        }))
    : [];

  const existing = await supabaseRequest(
    `personal_chat_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=conversation,message_count,visitor_name`,
    { method: 'GET' },
    1800
  );

  const prevConv =
    existing.ok && Array.isArray(existing.data?.[0]?.conversation)
      ? existing.data[0].conversation
      : baseTurns;

  const savedName =
    visitorName && visitorName !== 'Visitor'
      ? visitorName
      : existing.data?.[0]?.visitor_name || 'Visitor';

  const updatedConv = [
    ...prevConv,
    { role: 'user', text: userMsg, ts: nowIso },
    { role: 'model', text: botReply, ts: nowIso }
  ].slice(-40);

  const nextCount =
    (existing.ok ? Number(existing.data?.[0]?.message_count || 0) : Math.floor(baseTurns.length / 2)) + 1;

  const writeRes = await supabaseRequest(
    'personal_chat_sessions?on_conflict=session_id',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        session_id: sessionId,
        visitor_name: savedName,
        device_info: deviceInfo || '',
        city: city || '',
        message_count: nextCount,
        conversation: updatedConv,
        last_active: nowIso
      })
    },
    2200
  );

  if (!writeRes.ok) {
    return { logged: false, reason: writeRes.error };
  }
  return { logged: true, sessionId, messageCount: nextCount };
}

function formatNoteRelativeAge(createdAtIso) {
  if (!createdAtIso) return '';
  const createdMs = new Date(createdAtIso).getTime();
  if (!createdMs || Number.isNaN(createdMs)) return '';

  const savedDateStr = new Date(createdMs).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const diffDays = Math.max(0, Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24)));
  const ageLabel =
    diffDays === 0
      ? 'Today'
      : diffDays === 1
      ? 'Yesterday'
      : `${diffDays} days ago`;

  return `Saved on: ${savedDateStr} (${ageLabel})`;
}

function buildModularSystemPrompt({
  intent,
  chatMode,
  visitorName,
  customKnowledge,
  liveSupabaseNotes,
  ghData,
  igData,
  socialLinks,
  clientDevice,
  ist
}) {
  const lines = [
    `You are "Vikash AI" (Personal Assistant of Vikash Kumar Gupta).`,
    `Style: Friendly, smart, natural Hinglish/Hindi (or English if user asks in English). Keep replies crisp and well-formatted.`,
    `CURRENT REAL-WORLD DATE & TIME (IST): ${ist.dateStr}, ${ist.timeStr}`
  ];

  if (visitorName && visitorName !== 'Visitor') {
    lines.push(`Visitor Name: ${visitorName} (address them naturally by name when appropriate).`);
  }

  if (chatMode === 'recruiter') {
    lines.push(
      `MODE: Recruiter / Portfolio Showcase — Highlight Vikash's B.Tech AIML background, MERN Stack + AI projects, and invite them to connect.`
    );
  }

  if (clientDevice?.batteryText || clientDevice?.locationText) {
    lines.push(
      `Visitor Device: ${clientDevice?.platform || ''} | Battery: ${clientDevice?.batteryText || ''} | Location: ${clientDevice?.locationText || 'Not shared'}`
    );
  }

  if (intent.needsAboutBio && customKnowledge) {
    lines.push(`ABOUT VIKASH:\n${customKnowledge.aboutMe || ''}`);
    if (Array.isArray(customKnowledge.education)) {
      lines.push(`EDUCATION:\n${JSON.stringify(customKnowledge.education)}`);
    }
    if (Array.isArray(customKnowledge.trainingsAndAwards)) {
      lines.push(`TRAININGS & AWARDS:\n${JSON.stringify(customKnowledge.trainingsAndAwards)}`);
    }
    if (Array.isArray(customKnowledge.skills)) {
      lines.push(`SKILLS: ${customKnowledge.skills.join(', ')}`);
    }
    if (Array.isArray(customKnowledge.highlights)) {
      lines.push(`HIGHLIGHTS:\n- ${customKnowledge.highlights.join('\n- ')}`);
    }
    if (customKnowledge.extraNotes) {
      lines.push(`NOTES: ${customKnowledge.extraNotes}`);
    }
  }

  if (
    (intent.needsAboutBio || intent.needsGitHub || intent.needsSocialLinks) &&
    Array.isArray(liveSupabaseNotes) &&
    liveSupabaseNotes.length > 0
  ) {
    const formattedNotes = liveSupabaseNotes
      .map((n) => {
        const timeTag = formatNoteRelativeAge(n.created_at);
        return `- [${timeTag ? `${timeTag} | ` : ''}Category: ${n.category || 'General'}]: ${n.note_text}`;
      })
      .join('\n');
    lines.push(
      `LIVE NOTES ADDED BY VIKASH (Compare each note's "Saved on" date against TODAY'S DATE "${ist.dateStr}" — if a note mentions an event/exam/month that has already passed as of today, treat it as a PAST update from that date, NOT as something happening right now!):\n${formattedNotes}`
    );
  }

  if (intent.needsGitHub) {
    const projectsSummary = ghData?.repos?.length
      ? ghData.repos
          .map(
            (r, i) =>
              `${i + 1}. ${r.name} — ${r.description} | Tech: ${r.tags.join(', ') || 'Code'} | Stars: ${r.stars} | Updated: ${r.updatedAt} | GitHub: ${r.githubUrl}${r.liveUrl ? ` | Live: ${r.liveUrl}` : ''}`
          )
          .join('\n')
      : 'GitHub repositories not loaded.';
    lines.push(
      `LIVE GITHUB (${ghData?.name || 'Vikash'} | Repos: ${ghData?.publicRepos ?? 0} | Followers: ${ghData?.followers ?? 0}):\n${projectsSummary}`
    );
    if (ghData?.readmeSnippet) {
      lines.push(`GITHUB README:\n${ghData.readmeSnippet}`);
    }
  }

  if (intent.needsInstagramStats) {
    const igSummary = igData
      ? `@${igData.username} | Followers: ${igData.followersCount} | Following: ${igData.followsCount} | Posts: ${igData.mediaCount}\nRecent Posts:\n${igData.posts
          .map(
            (p) =>
              `- Post #${p.index} (${p.type}): "${p.caption || 'No caption'}" | Likes: ${p.likes} | Comments: ${p.comments} | Link: ${p.permalink}`
          )
          .join('\n')}`
      : 'Instagram Graph API is not connected yet (tell the user politely that live Instagram stats will appear once IG token is connected, and share the Instagram profile link if available).';
    lines.push(`INSTAGRAM DATA:\n${igSummary}`);
  }

  if (intent.needsSocialLinks || intent.needsHiringLead) {
    const availableLinks = Object.entries({
      GitHub: socialLinks.github,
      Instagram: socialLinks.instagram,
      LinkedIn: socialLinks.linkedin,
      Facebook: socialLinks.facebook,
      'Twitter/X': socialLinks.twitter,
      Discord: socialLinks.discord,
      Portfolio: socialLinks.portfolio,
      Linktree: socialLinks.linktree,
      WhatsApp: socialLinks.whatsapp,
      Phone: socialLinks.phone ? `${socialLinks.phone} (${socialLinks.phoneUrl})` : '',
      Email: socialLinks.email
    })
      .filter(([, v]) => Boolean(v))
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');

    lines.push(`VERIFIED LINKS (Only share URLs listed here):\n${availableLinks}`);
  }

  lines.push(`Never invent fake URLs or fake stats.`);
  return lines.join('\n\n');
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
  if (/linkedin|लिंक्डइन|resume|cv|hire|intern/i.test(m) && socialLinks.linkedin) {
    btns.push({ label: 'LinkedIn', href: socialLinks.linkedin, type: 'LINKEDIN' });
  }
  if (/facebook|fb|फेसबुक/i.test(m) && socialLinks.facebook) {
    btns.push({ label: 'Facebook', href: socialLinks.facebook, type: 'FACEBOOK' });
  }
  if (/twitter|x\.com|ट्विटर/i.test(m) && socialLinks.twitter) {
    btns.push({ label: 'Twitter (X)', href: socialLinks.twitter, type: 'TWITTER' });
  }
  if (/discord|डिस्कॉर्ड/i.test(m) && socialLinks.discord) {
    btns.push({ label: 'Discord', href: socialLinks.discord, type: 'DISCORD' });
  }
  if (/portfolio|website|वेबसाइट/i.test(m) && socialLinks.portfolio) {
    btns.push({ label: 'Portfolio Website', href: socialLinks.portfolio, type: 'PORTFOLIO' });
  }
  if (/linktree|लिंकट्री/i.test(m) && socialLinks.linktree) {
    btns.push({ label: 'Linktree', href: socialLinks.linktree, type: 'LINKTREE' });
  }
  if (/whatsapp|व्हाट्सएप|contact|संपर्क|बात|hire|freelance|collab/i.test(m) && socialLinks.whatsapp) {
    btns.push({ label: 'WhatsApp पर मैसेज करें', href: socialLinks.whatsapp, type: 'WHATSAPP' });
  }
  if (/call|phone|number|मोबाइल|नंबर|फ़ोन/i.test(m) && socialLinks.phoneUrl) {
    btns.push({ label: `Call ${socialLinks.phone}`, href: socialLinks.phoneUrl, type: 'CALL' });
  }
  if (/social|लिंक|link|सब|all|जुड़/i.test(m) && btns.length === 0) {
    if (socialLinks.github) btns.push({ label: 'GitHub', href: socialLinks.github, type: 'GITHUB' });
    if (socialLinks.linkedin) btns.push({ label: 'LinkedIn', href: socialLinks.linkedin, type: 'LINKEDIN' });
    if (socialLinks.instagram) btns.push({ label: 'Instagram', href: socialLinks.instagram, type: 'INSTAGRAM' });
    if (socialLinks.facebook) btns.push({ label: 'Facebook', href: socialLinks.facebook, type: 'FACEBOOK' });
    if (socialLinks.whatsapp) btns.push({ label: 'WhatsApp', href: socialLinks.whatsapp, type: 'WHATSAPP' });
  }

  return btns.slice(0, 4);
}

function selectRelevantProjects(message, ghData, intent) {
  if (!intent.needsGitHub || !ghData?.repos?.length) return [];
  const m = String(message || '').toLowerCase();
  if (!/project|projects|प्रोजेक्ट|काम|work|portfolio|repo|github|बनाया/i.test(m)) return [];

  const filtered = ghData.repos.filter((r) => {
    const hay = `${r.name} ${r.description} ${r.tags.join(' ')}`.toLowerCase();
    if (/react/i.test(m)) return hay.includes('react') || hay.includes('javascript') || hay.includes('jsx');
    if (/ai|gemini/i.test(m)) return hay.includes('ai') || hay.includes('gemini') || hay.includes('bot');
    return true;
  });

  return (filtered.length > 0 ? filtered : ghData.repos).slice(0, 4);
}

async function openGeminiSSEStream(apiKey, systemInstruction, contents, useSearch = false) {
  const cleanKey = String(apiKey || '').trim();
  const models = cachedDiscoveredModels
    ? cachedDiscoveredModels.filter((m) => !quotaExhaustedModels.has(m) && !notFoundModels.has(m))
    : getDefaultCandidateModels();
  const errors = [];

  for (const modelName of models.slice(0, 4)) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse`;
    const attempts = useSearch ? [true, false] : [false];

    for (const withSearch of attempts) {
      const payload = {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature: withSearch ? 0.3 : 0.65,
          maxOutputTokens: 700,
          thinkingConfig: { thinkingBudget: 0 }
        }
      };
      if (withSearch) {
        payload.tools = [{ google_search: {} }];
      }

      try {
        const res = await fetchWithTimeout(
          endpoint,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': cleanKey
            },
            body: JSON.stringify(payload)
          },
          withSearch ? 22000 : 18000
        );

        if (res.ok && res.body) {
          cachedWorkingModel = modelName;
          return { ok: true, response: res, modelUsed: modelName };
        }

        const errTxt = await res.text().catch(() => '');
        errors.push(`${modelName}[search=${withSearch}](${res.status}): ${errTxt.slice(0, 90)}`);

        if (res.status === 404) {
          notFoundModels.add(modelName);
          if (cachedWorkingModel === modelName) cachedWorkingModel = null;
          break;
        }
        if (res.status === 429) {
          quotaExhaustedModels.add(modelName);
          if (cachedWorkingModel === modelName) cachedWorkingModel = null;
          break;
        }
        if (res.status === 503 || res.status === 500) {
          if (cachedWorkingModel === modelName) cachedWorkingModel = null;
          break;
        }
      } catch (err) {
        errors.push(`${modelName}[search=${withSearch}]: ${err?.message || 'timeout'}`);
        if (cachedWorkingModel === modelName) cachedWorkingModel = null;
      }
    }
  }

  refreshDiscoveredModelsInBackground(cleanKey);
  return { ok: false, errorText: errors.join(' | ') };
}

async function callGeminiBufferedRescue(apiKey, systemInstruction, contents) {
  const cleanKey = String(apiKey || '').trim();
  const models = getDefaultCandidateModels();
  const errors = [];

  for (const modelName of models.slice(0, 3)) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
    try {
      const res = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents,
            generationConfig: {
              temperature: 0.65,
              maxOutputTokens: 700,
              thinkingConfig: { thinkingBudget: 0 }
            }
          })
        },
        15000
      );

      if (res.ok) {
        const data = await res.json();
        const text =
          data?.candidates?.[0]?.content?.parts
            ?.filter((p) => typeof p.text === 'string' && !p.thought)
            .map((p) => p.text)
            .join('')
            .trim() || '';
        if (text) {
          cachedWorkingModel = modelName;
          return { ok: true, text, modelUsed: modelName };
        }
      } else {
        const errTxt = await res.text().catch(() => '');
        errors.push(`rescue-${modelName}(${res.status}): ${errTxt.slice(0, 90)}`);
        if (res.status === 404) notFoundModels.add(modelName);
        if (res.status === 429) quotaExhaustedModels.add(modelName);
      }
    } catch (err) {
      errors.push(`rescue-${modelName}: ${err?.message}`);
    }
  }
  return { ok: false, errorText: errors.join(' | ') };
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS_HEADERS });
  }

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);

      if (url.searchParams.get('health') === '1' || url.searchParams.get('test_db') === '1') {
        const { url: sbUrl, keys: sbKeys } = getSupabaseCredentials();
        const isTestWrite = url.searchParams.get('test_db') === '1';
        let writeResult = null;

        if (isTestWrite) {
          writeResult = await saveChatTurnToSupabase({
            sessionId: 'TEST-DIAGNOSTIC',
            visitorName: 'Diagnostic Test',
            deviceInfo: 'Browser Test',
            city: 'Patna',
            history: [],
            userMsg: 'Test message',
            botReply: 'Supabase write test OK'
          });
        }

        return jsonResponse(200, {
          ok: true,
          hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
          supabaseUrl: sbUrl,
          hasSecretKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
          hasPublishableKey: Boolean(process.env.SUPABASE_ANON_KEY),
          supabaseConfigured: Boolean(sbUrl && sbKeys.length > 0),
          cachedWorkingModel,
          writeResult
        });
      }

      const sessionId = url.searchParams.get('sessionId');
      if (!sessionId) return jsonResponse(400, { success: false, error: 'Missing sessionId' });

      const res = await supabaseRequest(
        `personal_chat_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=conversation,visitor_name`,
        { method: 'GET' },
        2000
      );
      return jsonResponse(200, {
        success: true,
        session: res.ok ? res.data?.[0] || null : null
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
      return jsonResponse(500, {
        success: false,
        isError: true,
        error: 'GEMINI_API_KEY is missing in Netlify Environment Variables.'
      });
    }

    const ist = getISTDateTime();

    if (body.isWelcomeGreeting) {
      const modeHint =
        body.chatMode === 'recruiter'
          ? 'The visitor opened Portfolio/Recruiter mode.'
          : 'The visitor opened Vikash AI personal assistant.';
      const prompt = `Generate a fresh, warm, 1-line Hindi/Hinglish welcome greeting (max 14 words) for "Vikash AI" (Personal Assistant of Vikash Kumar Gupta). ${modeHint} Today is ${ist.dateStr}, ${ist.timeStr}. No markdown, just 1 crisp friendly line.`;

      const rescue = await callGeminiBufferedRescue(
        apiKey,
        'You are Vikash AI. Output only 1 short friendly Hindi/Hinglish greeting line.',
        [{ role: 'user', parts: [{ text: prompt }] }]
      );
      return jsonResponse(200, {
        success: true,
        welcome: rescue.ok ? rescue.text : 'नमस्ते! मैं Vikash AI हूँ — बताइए, आज क्या जानना है?'
      });
    }

    const userMessage = String(body.message || '').trim();
    if (!userMessage) {
      return jsonResponse(400, { success: false, isError: true, error: 'Empty message' });
    }

    const chatMode = String(body.chatMode || 'default');
    const intent = classifyUserIntent(userMessage, chatMode);

    const [ghData, igData, liveSupabaseNotes] = await Promise.all([
      intent.needsGitHub ? fetchGitHubData() : Promise.resolve(cachedGithub),
      intent.needsInstagramStats ? fetchInstagramData() : Promise.resolve(cachedInstagram),
      intent.needsAboutBio || intent.needsGitHub || intent.needsSocialLinks
        ? fetchLiveCustomNotes()
        : Promise.resolve(cachedCustomNotes || [])
    ]);

    if (!intent.needsGitHub && !cachedGithub) {
      fetchGitHubData().catch(() => {});
    }

    const socialLinks = getSocialLinks(ghData, igData, body.customKnowledge);
    const detectedName = detectVisitorNameFromText(userMessage);
    const effectiveVisitorName =
      detectedName || (body.visitorName && body.visitorName !== 'Visitor' ? body.visitorName : 'Visitor');

    const systemInstruction = buildModularSystemPrompt({
      intent,
      chatMode,
      visitorName: effectiveVisitorName,
      customKnowledge: body.customKnowledge,
      liveSupabaseNotes,
      ghData,
      igData,
      socialLinks,
      clientDevice: body.clientDevice,
      ist
    });

    const contents = buildValidGeminiContents(
      Array.isArray(body.history) ? body.history.slice(-8) : [],
      userMessage
    );

    const actionButtons = intent.needsSocialLinks ? selectContextActionButtons(userMessage, socialLinks) : [];
    const recommendedProjects = selectRelevantProjects(userMessage, ghData, intent);
    const showLeadCard = intent.needsHiringLead;

    const quickFollowUps =
      chatMode === 'recruiter'
        ? [
            '🚀 Vikash के Best MERN & AI Projects',
            '🎓 Education और Technical Skills',
            '💼 Hire / Internship के लिए Connect करें'
          ]
        : [
            '🚀 Vikash के प्रोजेक्ट्स दिखाओ',
            '📸 Instagram स्टेटस और पोस्ट लाइक्स बताओ',
            '🔗 सारे Social Links दो'
          ];

    const sseResult = await openGeminiSSEStream(apiKey, systemInstruction, contents, intent.needsGoogleSearch);

    if (!sseResult.ok) {
      const rescue = await callGeminiBufferedRescue(apiKey, systemInstruction, contents);
      if (rescue.ok && rescue.text) {
        const supabaseStatus = await saveChatTurnToSupabase({
          sessionId: body.sessionId,
          visitorName: effectiveVisitorName,
          deviceInfo: body.clientDevice?.platform || '',
          city: body.clientDevice?.locationText || '',
          history: body.history,
          userMsg: userMessage,
          botReply: rescue.text
        });

        const encoder = new TextEncoder();
        const fallbackStream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: rescue.text })}\n\n`));
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'done',
                  isError: false,
                  reply: rescue.text,
                  modelUsed: rescue.modelUsed,
                  intentUsed: intent,
                  detectedVisitorName: effectiveVisitorName,
                  recommendedProjects,
                  actionButtons,
                  showLeadCard,
                  whatsappNumber: socialLinks.whatsappNumber,
                  supabaseStatus,
                  quickFollowUps
                })}\n\n`
              )
            );
            controller.close();
          }
        });
        return new Response(fallbackStream, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            ...CORS_HEADERS
          }
        });
      }

      const combinedErr = `${sseResult.errorText} | ${rescue.errorText || ''}`;
      const encoder = new TextEncoder();
      const errStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                isError: true,
                debugError: combinedErr,
                reply: 'Something went wrong, please try again.'
              })}\n\n`
            )
          );
          controller.close();
        }
      });
      return new Response(errStream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          ...CORS_HEADERS
        }
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (obj) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        let fullReply = '';
        let buf = '';
        const reader = sseResult.response.body.getReader();

        try {
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
                    ?.filter((p) => typeof p.text === 'string' && !p.thought)
                    .map((p) => p.text)
                    .join('') || '';
                if (textPart) {
                  fullReply += textPart;
                  sendEvent({ type: 'delta', text: textPart });
                }
              } catch {}
            }
          }

          if (!fullReply.trim()) {
            const rescue = await callGeminiBufferedRescue(apiKey, systemInstruction, contents);
            if (rescue.ok && rescue.text) {
              fullReply = rescue.text;
              sendEvent({ type: 'delta', text: fullReply });
            }
          }

          if (!fullReply.trim()) {
            sendEvent({
              type: 'done',
              isError: true,
              debugError: 'Empty stream output from Gemini',
              reply: 'Something went wrong, please try again.'
            });
            controller.close();
            return;
          }

          const supabaseStatus = await saveChatTurnToSupabase({
            sessionId: body.sessionId,
            visitorName: effectiveVisitorName,
            deviceInfo: body.clientDevice?.platform || '',
            city: body.clientDevice?.locationText || '',
            history: body.history,
            userMsg: userMessage,
            botReply: fullReply
          });

          sendEvent({
            type: 'done',
            isError: false,
            reply: fullReply,
            modelUsed: sseResult.modelUsed,
            intentUsed: intent,
            detectedVisitorName: effectiveVisitorName,
            recommendedProjects,
            actionButtons,
            showLeadCard,
            whatsappNumber: socialLinks.whatsappNumber,
            supabaseStatus,
            quickFollowUps
          });
          controller.close();
        } catch (streamErr) {
          sendEvent({
            type: 'done',
            isError: !fullReply.trim(),
            debugError: streamErr?.message || 'Stream interrupted',
            reply: fullReply.trim() || 'Something went wrong, please try again.'
          });
          controller.close();
        }
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
    return jsonResponse(500, {
      success: false,
      isError: true,
      error: err?.message || 'Unexpected server error'
    });
  }
};