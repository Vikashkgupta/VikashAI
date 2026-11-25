// File: src/App.jsx
// Vikash AI — Personal Assistant (React + Tailwind CSS + Netlify Functions)
import React, { useState, useEffect, useRef } from 'react';
import { VIKASH_CUSTOM_KNOWLEDGE } from './data/customKnowledge';

const VIKASH_AVATAR_URL = '/vikash.jpg';
const LIVE_NETLIFY_SITE = 'https://vikashaiai.netlify.app';
const API_BASE =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? LIVE_NETLIFY_SITE
    : '';
const CHAT_API = `${API_BASE}/.netlify/functions/personalChat`;
const ADMIN_API = `${API_BASE}/.netlify/functions/adminDashboard`;
const TTS_API = `${API_BASE}/.netlify/functions/tts`;

const DEFAULT_CUSTOM_KNOWLEDGE = {
  aboutMe:
    'नाम: Vikash Kumar Gupta (विकास कुमार गुप्ता) | भूमिका: Full-Stack Web Developer & AI Builder | शहर: Mairwa (Siwan), Bihar, India',
  skills: [
    'React.js',
    'JavaScript (ES6+)',
    'Tailwind CSS',
    'Node.js & Netlify Functions',
    'Supabase (PostgreSQL)',
    'Gemini AI & REST APIs'
  ],
  highlights: [
    'KshirSagar Sweets Corner के लिए फुल-स्टैक वेब ऐप और AI असिस्टेंट बनाया।',
    'GitHub और Instagram Graph API से जुड़ा लाइव पर्सनल AI असिस्टेंट बनाया।'
  ],
  extraNotes:
    'नए टेक आइडियाज़, वेब ऐप्स और AI प्रोजेक्ट्स पर काम करने के लिए हमेशा तैयार।'
};

const INITIAL_CHIPS = [
  '🚀 Vikash के प्रोजेक्ट्स दिखाओ',
  '📸 Instagram स्टेटस और लाइक्स बताओ',
  '🌦️ आज का मौसम और ताज़ा न्यूज़'
];

const FALLBACK_WELCOME = 'नमस्ते! मैं Vikash AI हूँ — बताइए, आज क्या जानना है?';

function getOrCreateSessionId() {
  try {
    const key = 'vikash_ai_session_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = `VK-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'VK-GUEST';
  }
}

function getDetectedChatMode() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'recruiter' ? 'recruiter' : 'default';
  } catch {
    return 'default';
  }
}

function ActionChipIcon({ type }) {
  const t = String(type || '').toUpperCase();
  if (t === 'GITHUB') {
    return (
      <svg className="w-3.5 h-3.5 text-neutral-800 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        />
      </svg>
    );
  }
  if (t === 'WHATSAPP') {
    return (
      <svg className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.9"
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    );
  }
  if (t === 'CALL') {
    return (
      <svg className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.9"
          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
        />
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  );
}

function renderInlineMarkdown(rawText) {
  // Strip any accidental internal placeholder tokens if ever present
  const sanitizedInput = String(rawText || '').replace(/__(?:MD)?LINK_\d+__/g, '');
  const tokens = [];

  const pushToken = (label, url) => {
    const cleanUrl = String(url || '').trim().replace(/[.,!?;:]+$/, '');
    if (!cleanUrl) return label;
    const href = /^https?:\/\//i.test(cleanUrl) || cleanUrl.startsWith('tel:')
      ? cleanUrl
      : `https://${cleanUrl}`;
    const idx = tokens.length;
    tokens.push({ label: label || cleanUrl, href });
    return `[[LINKTOKEN_${idx}]]`;
  };

  // 1. Markdown links [label](url)
  const step1 = sanitizedInput.replace(
    /\[([^\]]+)\]\(((?:https?:\/\/|tel:)[^\s)]+)\)/g,
    (_, label, url) => pushToken(label, url)
  );

  // 2. Full https:// or http:// URLs
  const step2 = step1.replace(/(https?:\/\/[^\s<>"')\]]+)/g, (url) => {
    const cleaned = url.replace(/[.,!?;:]+$/, '');
    const trailing = url.slice(cleaned.length);
    return `${pushToken(cleaned, cleaned)}${trailing}`;
  });

  // 3. Domain-like links such as ddugu.ac.in or aktu.ac.in
  const step3 = step2.replace(
    /(?<![\w@/.])([a-z0-9-]+(?:\.[a-z0-9-]+)+\.(?:ac\.in|edu\.in|gov\.in|org\.in|com|in|org|net|io|ai)(?:\/[^\s<>"')\]]*)?)/gi,
    (domainUrl) => {
      const cleaned = domainUrl.replace(/[.,!?;:]+$/, '');
      const trailing = domainUrl.slice(cleaned.length);
      return `${pushToken(cleaned, cleaned)}${trailing}`;
    }
  );

  const parts = step3.split(/(\[\[LINKTOKEN_\d+\]\]|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const linkMatch = part.match(/^\[\[LINKTOKEN_(\d+)\]\]$/);
    if (linkMatch) {
      const item = tokens[Number(linkMatch[1])];
      if (!item) return null;
      const isTel = item.href.startsWith('tel:');
      return (
        <a
          key={i}
          href={item.href}
          target={isTel ? undefined : '_blank'}
          rel={isTel ? undefined : 'noopener noreferrer'}
          className="text-blue-600 hover:text-blue-700 underline underline-offset-2 font-medium break-all"
        >
          {item.label}
        </a>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-neutral-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function FormattedMessage({ text }) {
  const lines = String(text || '').split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;
        if (trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 leading-relaxed">
              <span className="text-neutral-400 mt-0.5">•</span>
              <span>{renderInlineMarkdown(trimmed.replace(/^[•\-*]\s*/, ''))}</span>
            </div>
          );
        }
        return (
          <p key={idx} className="leading-relaxed">
            {renderInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

function ConnectLeadCard({ whatsappNumber = '919931890824', defaultName = '', onSubmitted }) {
  const [leadName, setLeadName] = useState(defaultName !== 'Visitor' ? defaultName : '');
  const [leadPurpose, setLeadPurpose] = useState('Internship / Job');
  const [leadNote, setLeadNote] = useState('');

  const handleSendLead = (e) => {
    e.preventDefault();
    const cleanNum = String(whatsappNumber || '919931890824').replace(/[^\d]/g, '');
    const msg = `Namaste Vikash! Main ${leadName || 'Visitor'} bol raha hoon.\nPurpose: ${leadPurpose}${
      leadNote.trim() ? `\nDetails: ${leadNote.trim()}` : ''
    }`;
    const url = `https://wa.me/${cleanNum}?text=${encodeURIComponent(msg)}`;
    if (onSubmitted) onSubmitted(url, leadPurpose);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <form
      onSubmit={handleSendLead}
      className="mt-2.5 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/90 space-y-2.5 max-w-sm"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-900">Connect Directly with Vikash</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
          Instant WhatsApp
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={leadName}
          onChange={(e) => setLeadName(e.target.value)}
          placeholder="आपका नाम"
          className="px-2.5 py-1.5 rounded-lg bg-white border border-neutral-200 text-xs text-neutral-900 focus:outline-none"
        />
        <select
          value={leadPurpose}
          onChange={(e) => setLeadPurpose(e.target.value)}
          className="px-2 py-1.5 rounded-lg bg-white border border-neutral-200 text-xs text-neutral-900 focus:outline-none"
        >
          <option value="Internship / Job">Internship / Job</option>
          <option value="Website / App Project">Website / App</option>
          <option value="Collaboration">Collaboration</option>
        </select>
      </div>
      <input
        type="text"
        value={leadNote}
        onChange={(e) => setLeadNote(e.target.value)}
        placeholder="छोटा संदेश (जैसे: React project या role details)"
        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-neutral-200 text-xs text-neutral-900 focus:outline-none"
      />
      <button
        type="submit"
        className="w-full py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors"
      >
        Send on WhatsApp ↗
      </button>
    </form>
  );
}

export default function App() {
  const [sessionId] = useState(() => getOrCreateSessionId());
  const [chatMode] = useState(() => getDetectedChatMode());
  const [visitorName, setVisitorName] = useState(() => {
    try {
      return localStorage.getItem('vikash_ai_visitor_name') || 'Visitor';
    } catch {
      return 'Visitor';
    }
  });
  const [avatarError, setAvatarError] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome-1',
      sender: 'bot',
      text: '',
      recommendedProjects: [],
      actionButtons: [],
      showLeadCard: false,
      whatsappNumber: '919931890824',
      isError: false,
      retryPrompt: '',
      isStreaming: true
    }
  ]);
  const [chips, setChips] = useState(INITIAL_CHIPS);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState('welcome-1');
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [toastText, setToastText] = useState('');
  const [cachedGeoStr, setCachedGeoStr] = useState('');

  const abortControllerRef = useRef(null);
  const mainScrollRef = useRef(null);
  const messagesEndRef = useRef(null);
  const userScrolledUpRef = useRef(false);
  const audioPlayerRef = useRef(null);
  const audioCacheRef = useRef(new Map());
  const elevenLabsExhaustedRef = useRef(false);
  const cachedVoicesRef = useRef([]);
  const [loadingAudioMsgId, setLoadingAudioMsgId] = useState(null);

  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);
  const [showAdminModal, setShowAdminModal] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('admin') === 'true';
    } catch {
      return false;
    }
  });
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAuthorized, setAdminAuthorized] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminData, setAdminData] = useState(null);
  const [adminTab, setAdminTab] = useState('analytics');
  const [adminSearch, setAdminSearch] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState(null);

  const [noteCategory, setNoteCategory] = useState('Project / Update');
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [isNoteListening, setIsNoteListening] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const isBusy = Boolean(isLoading || (streamingMsgId && streamingMsgId !== 'welcome-1'));

  const showToast = (msg) => {
    setToastText(msg);
    setTimeout(() => setToastText(''), 2500);
  };

  const handleFeedScroll = () => {
    const el = mainScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUpRef.current = distanceFromBottom > 90;
  };

  useEffect(() => {
    if (!userScrolledUpRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const trackClick = (eventType, label, targetUrl) => {
    fetch(ADMIN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'track_click',
        sessionId,
        eventType,
        label,
        targetUrl
      })
    }).catch(() => {});
  };

  const fetchLiveWelcome = async (targetId = 'welcome-1') => {
    try {
      const res = await fetch(CHAT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isWelcomeGreeting: true, chatMode })
      });
      if (!res.ok) throw new Error(`Welcome HTTP ${res.status}`);
      const data = await res.json();
      const welcome = String(data?.welcome || FALLBACK_WELCOME).trim();
      setMessages((prev) =>
        prev.map((m) => (m.id === targetId ? { ...m, text: welcome, isStreaming: false } : m))
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === targetId ? { ...m, text: FALLBACK_WELCOME, isStreaming: false } : m))
      );
    } finally {
      setStreamingMsgId((cur) => (cur === targetId ? null : cur));
    }
  };

  useEffect(() => {
    const restoreOrGreet = async () => {
      try {
        const clearedAtRaw = localStorage.getItem('vk_chat_cleared_at') || '';
        const clearedAtMs = clearedAtRaw ? new Date(clearedAtRaw).getTime() : 0;
        const res = await fetch(`${CHAT_API}?sessionId=${encodeURIComponent(sessionId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.session?.visitor_name && data.session.visitor_name !== 'Visitor') {
            setVisitorName(data.session.visitor_name);
          }
          const conv = data?.session?.conversation;
          if (Array.isArray(conv) && conv.length > 0) {
            const validTurns = clearedAtMs
              ? conv.filter((t) => (t.ts ? new Date(t.ts).getTime() : 0) > clearedAtMs)
              : conv;
            if (validTurns.length > 0) {
              setMessages([
                {
                  id: 'welcome-1',
                  sender: 'bot',
                  text: FALLBACK_WELCOME,
                  recommendedProjects: [],
                  actionButtons: [],
                  showLeadCard: false,
                  isError: false,
                  retryPrompt: '',
                  isStreaming: false
                },
                ...validTurns.map((t, i) => ({
                  id: `hist-${i}-${Date.now()}`,
                  sender: t.role === 'user' ? 'user' : 'bot',
                  text: t.text || '',
                  recommendedProjects: [],
                  actionButtons: [],
                  showLeadCard: false,
                  isError: false,
                  retryPrompt: '',
                  isStreaming: false
                }))
              ]);
              setStreamingMsgId(null);
              return;
            }
          }
        }
      } catch {}
      fetchLiveWelcome('welcome-1');
    };
    restoreOrGreet();
  }, [sessionId]);

  const detectGps = (forcePrompt = false) => {
    if (!navigator.geolocation) return;
    const run = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lon } = pos.coords;
          let label = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
          try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14`);
            if (r.ok) {
              const g = await r.json();
              const a = g.address || {};
              const parts = [a.suburb || a.village || a.town || a.city, a.state].filter(Boolean);
              if (parts.length > 0) label = parts.join(', ');
            }
          } catch {}
          setCachedGeoStr(label);
          if (forcePrompt) showToast('GPS लोकेशन अपडेट हो गई');
        },
        () => {},
        { timeout: 6000 }
      );
    };
    if (forcePrompt) run();
    else if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((p) => p.state === 'granted' && run())
        .catch(() => {});
    }
  };

  useEffect(() => {
    detectGps(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const list = window.speechSynthesis.getVoices() || [];
        if (list.length > 0) cachedVoicesRef.current = list;
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const getDeviceContext = async () => {
    const ua = navigator.userAgent || '';
    const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iPhone' : 'Desktop';
    let isBraveBrowser = false;
    try {
      if (navigator.brave?.isBrave) isBraveBrowser = await navigator.brave.isBrave();
    } catch {}
    const browser = isBraveBrowser ? 'Brave' : /Edg/i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : 'Browser';
    let batteryText = 'ब्राउज़र द्वारा छुपाया गया';
    try {
      if (navigator.getBattery) {
        const b = await navigator.getBattery();
        const pct = Math.round((b.level || 0) * 100);
        batteryText =
          isBraveBrowser && pct === 100 && b.charging && b.chargingTime === 0
            ? 'Brave Shield चालू होने के कारण बैटरी % छुपी है'
            : `${pct}% (${b.charging ? 'Charging' : 'Not Charging'})`;
      }
    } catch {}
    return {
      platform: `${os} • ${browser} (${window.innerWidth}x${window.innerHeight})`,
      batteryText,
      networkText: navigator.onLine === false ? 'Offline' : 'Online',
      locationText: cachedGeoStr
    };
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setMessages((prev) =>
      prev.map((m) => (m.id === streamingMsgId ? { ...m, isStreaming: false } : m))
    );
    setStreamingMsgId(null);
  };

  const handleClearChat = () => {
    handleStopGenerating();
    try {
      localStorage.setItem('vk_chat_cleared_at', new Date().toISOString());
    } catch {}
    userScrolledUpRef.current = false;
    const id = 'welcome-' + Date.now();
    setStreamingMsgId(id);
    setMessages([
      {
        id,
        sender: 'bot',
        text: '',
        recommendedProjects: [],
        actionButtons: [],
        showLeadCard: false,
        isError: false,
        retryPrompt: '',
        isStreaming: true
      }
    ]);
    setChips(INITIAL_CHIPS);
    showToast('नया चैट शुरू हुआ');
    fetchLiveWelcome(id);
  };

  const handleCopyMessage = async (msgId, text) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId((cur) => (cur === msgId ? null : cur)), 2000);
    } catch {
      showToast('कॉपी करने में समस्या आई');
    }
  };

  const stopAllAudio = () => {
    try {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
        audioPlayerRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {}
    setSpeakingMsgId(null);
    setLoadingAudioMsgId(null);
  };

  const speakWithBrowserFallback = (msgId, cleanText) => {
    try {
      if (!('speechSynthesis' in window)) {
        showToast('इस ब्राउज़र में वॉइस रीडिंग उपलब्ध नहीं है');
        setSpeakingMsgId(null);
        return;
      }
      window.speechSynthesis.cancel();

      const hinglishToHindi = cleanText.replace(/\b([a-zA-Z]+)\b/g, (w) => {
        const map = {
          main: 'मैं',
          mai: 'मैं',
          hoon: 'हूँ',
          hu: 'हूँ',
          hai: 'है',
          hain: 'हैं',
          kaise: 'कैसे',
          kya: 'क्या',
          kaun: 'कौन',
          karu: 'करूँ',
          karoon: 'करूँ',
          aap: 'आप',
          aapka: 'आपका',
          aapki: 'आपकी',
          mera: 'मेरा',
          meri: 'मेरी',
          aur: 'और',
          nahi: 'नहीं',
          nhi: 'नहीं',
          haan: 'हाँ',
          batao: 'बताओ',
          bataiye: 'बताइए',
          jaanna: 'जानना',
          baare: 'बारे',
          mein: 'में',
          me: 'में',
          se: 'से',
          ko: 'को',
          ka: 'का',
          ki: 'की',
          ke: 'के',
          yaar: 'यार',
          bhai: 'भाई',
          bilkul: 'बिल्कुल',
          achha: 'अच्छा',
          accha: 'अच्छा'
        };
        return map[w.toLowerCase()] || w;
      });

      const startSpeaking = (voiceList) => {
        // Strictly prioritize Indian / Hindi MALE voices first
        const maleIndianVoice = voiceList.find((v) =>
          /madhur|prabhat|ravi|hemant|male|man|boy/i.test(v.name) && /hi|in|india/i.test(`${v.lang} ${v.name}`)
        );
        const anyIndianMale = voiceList.find((v) =>
          /madhur|prabhat|ravi|hemant/i.test(v.name)
        );
        const hindiVoice = voiceList.find(
          (v) => /hi-in/i.test(v.lang) || /hindi|हिन्दी/i.test(v.name)
        );
        const indianEnglishVoice = voiceList.find(
          (v) => /en-in/i.test(v.lang) || /india|ravi|prabhat/i.test(v.name)
        );

        const chosenVoice = maleIndianVoice || anyIndianMale || hindiVoice || indianEnglishVoice;

        // Split into natural conversational clauses so each sentence gets dynamic pitch & speed (no book-reading monotone!)
        const clauses = hinglishToHindi
          .split(/(?<=[।!?])\s+|\.\.\.\s+/)
          .map((s) => s.trim())
          .filter(Boolean);

        if (clauses.length === 0) {
          setSpeakingMsgId(null);
          return;
        }

        setSpeakingMsgId(msgId);
        let idx = 0;

        const speakNextClause = () => {
          if (idx >= clauses.length) {
            setSpeakingMsgId(null);
            return;
          }
          const segment = clauses[idx];
          idx += 1;

          const utter = new SpeechSynthesisUtterance(segment);
          if (chosenVoice) {
            utter.voice = chosenVoice;
            utter.lang = chosenVoice.lang || 'hi-IN';
          } else {
            utter.lang = 'hi-IN';
          }

          // Dynamic emotion prosody per sentence (Male pitch + fast natural pace)
          if (segment.endsWith('?')) {
            // Curious rising intonation on questions
            utter.rate = 1.18;
            utter.pitch = 0.96;
          } else if (/!|कमाल|शानदार|बधाई|awesome|happy|वाह|अरे भाई|अरे यार/i.test(segment)) {
            // Warm & energetic on excitement
            utter.rate = 1.24;
            utter.pitch = 0.94;
          } else if (/माफ़|सॉरी|sorry|दुख|समस्या|दिक्कत|error|चिंता मत/i.test(segment)) {
            // Soft & empathetic on apologies/issues
            utter.rate = 1.08;
            utter.pitch = 0.85;
          } else {
            // Crisp, natural male conversational flow
            utter.rate = 1.18;
            utter.pitch = 0.89;
          }

          utter.onend = () => {
            setTimeout(speakNextClause, 95);
          };
          utter.onerror = () => setSpeakingMsgId(null);
          window.speechSynthesis.speak(utter);
        };

        speakNextClause();
      };

      const available =
        cachedVoicesRef.current.length > 0
          ? cachedVoicesRef.current
          : window.speechSynthesis.getVoices() || [];

      if (available.length > 0) {
        startSpeaking(available);
      } else {
        setSpeakingMsgId(msgId);
        setTimeout(() => {
          const retryVoices = window.speechSynthesis.getVoices() || [];
          if (retryVoices.length > 0) cachedVoicesRef.current = retryVoices;
          startSpeaking(retryVoices);
        }, 120);
      }
    } catch {
      setSpeakingMsgId(null);
    }
  };

  const handleSpeakMessage = async (msgId, text) => {
    const isCurrentlyActive = speakingMsgId === msgId || loadingAudioMsgId === msgId;
    stopAllAudio();
    if (isCurrentlyActive) return;

    const clean = String(text || '')
      .replace(/\[([^\]]+)\]\((?:https?:\/\/|tel:|mailto:)[^)]+\)/gi, '$1')
      .replace(/(?:https?:\/\/|www\.|tel:|mailto:)\S+/gi, ' ')
      .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\.(?:ac\.in|edu\.in|gov\.in|org\.in|com|in|org|net|io|ai|app)(?:\/\S*)?/gi, ' ')
      .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, ' ')
      .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, ' ')
      .replace(/[*_#`~>•|[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return;

    // 1. Play instantly from memory cache (0ms, 0 extra characters spent!)
    const cachedEntry = audioCacheRef.current.get(clean);
    if (cachedEntry) {
      const audio = new Audio(cachedEntry.url);
      audio.playbackRate = cachedEntry.rate || 1.16;
      if (cachedEntry.isFallbackStream && 'preservesPitch' in audio) {
        audio.preservesPitch = false; // Lowers pitch slightly into natural male tone while speeding up!
      }
      audioPlayerRef.current = audio;
      setSpeakingMsgId(msgId);
      audio.onended = () => setSpeakingMsgId(null);
      audio.onerror = () => speakWithBrowserFallback(msgId, clean);
      audio.play().catch(() => speakWithBrowserFallback(msgId, clean));
      return;
    }

    // 2. If quota ended in this session, go straight to expressive browser male voice
    if (elevenLabsExhaustedRef.current) {
      speakWithBrowserFallback(msgId, clean);
      return;
    }

    // 3. Try Custom Cloned Voice (Fish Audio) first -> Expressive Male Fallback
    try {
      setLoadingAudioMsgId(msgId);
      const res = await fetch(TTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean })
      });

      const contentType = res.headers.get('content-type') || '';
      const voiceSource = res.headers.get('x-voice-source') || '';
      const playbackRate = Number(res.headers.get('x-playback-rate') || 1.16);

      if (!res.ok || !contentType.includes('audio/mpeg')) {
        elevenLabsExhaustedRef.current = true;
        setLoadingAudioMsgId(null);
        speakWithBrowserFallback(msgId, clean);
        return;
      }

      // If server returned generic female neural stream, prefer native Indian Male voice if device has Madhur/Prabhat
      const hasNativeIndianMale = (cachedVoicesRef.current || []).some((v) =>
        /madhur|prabhat|ravi|hemant/i.test(v.name)
      );
      if (voiceSource === 'hindi-neural-fallback' && hasNativeIndianMale) {
        setLoadingAudioMsgId(null);
        speakWithBrowserFallback(msgId, clean);
        return;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const isFallbackStream = voiceSource === 'hindi-neural-fallback';
      audioCacheRef.current.set(clean, {
        url: blobUrl,
        rate: isFallbackStream ? playbackRate : 1.0,
        isFallbackStream
      });

      setLoadingAudioMsgId(null);
      const audio = new Audio(blobUrl);
      if (isFallbackStream) {
        audio.playbackRate = playbackRate;
        if ('preservesPitch' in audio) {
          audio.preservesPitch = false; // Gives deeper male resonance + faster pace
        }
      }
      audioPlayerRef.current = audio;
      setSpeakingMsgId(msgId);
      audio.onended = () => setSpeakingMsgId(null);
      audio.onerror = () => speakWithBrowserFallback(msgId, clean);
      await audio.play();
    } catch {
      setLoadingAudioMsgId(null);
      speakWithBrowserFallback(msgId, clean);
    }
  };

  const sendMessage = async (textToSend, isRetry = false) => {
    const trimmed = String(textToSend || '').trim();
    if (!trimmed || isBusy) return;

    userScrolledUpRef.current = false;

    if (!isRetry) {
      setMessages((prev) => [...prev, { id: 'u-' + Date.now(), sender: 'user', text: trimmed }]);
      setInput('');
    } else {
      setMessages((prev) => prev.filter((m) => !m.isError));
    }

    setIsLoading(true);
    const botMsgId = 'b-' + Date.now();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      const clientDevice = await getDeviceContext();
      const historyPayload = messages
        .filter((m) => !m.isError && m.text)
        .slice(-8)
        .map((m) => ({ role: m.sender === 'user' ? 'user' : 'model', text: m.text }));

      const res = await fetch(CHAT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          sessionId,
          visitorName,
          chatMode,
          message: trimmed,
          history: historyPayload,
          clientDevice,
          customKnowledge: VIKASH_CUSTOM_KNOWLEDGE
        })
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const rawErr = await res.text().catch(() => '');
        throw new Error(`Chat API HTTP ${res.status}: ${rawErr.slice(0, 220)}`);
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const jsonErr = await res.json();
        throw new Error(jsonErr?.error || jsonErr?.debugError || 'Server returned JSON error');
      }

      if (!res.body) {
        throw new Error('ReadableStream body missing from response');
      }

      setIsLoading(false);
      setStreamingMsgId(botMsgId);
      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          sender: 'bot',
          text: '',
          recommendedProjects: [],
          actionButtons: [],
          showLeadCard: false,
          whatsappNumber: '919931890824',
          isError: false,
          retryPrompt: '',
          isStreaming: true
        }
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let donePayload = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const line = part.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          const raw = line.replace(/^data:\s*/, '').trim();
          if (!raw || raw === '[DONE]') continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === 'delta' && evt.text) {
              fullText += evt.text;
              setMessages((prev) => prev.map((m) => (m.id === botMsgId ? { ...m, text: fullText } : m)));
            } else if (evt.type === 'done') {
              donePayload = evt;
            }
          } catch {}
        }
      }

      abortControllerRef.current = null;
      setStreamingMsgId(null);

      if (donePayload?.detectedVisitorName && donePayload.detectedVisitorName !== 'Visitor') {
        setVisitorName(donePayload.detectedVisitorName);
        try {
          localStorage.setItem('vikash_ai_visitor_name', donePayload.detectedVisitorName);
        } catch {}
      }

      if (donePayload?.debugError) {
        console.error('[Vikash AI Backend Diagnostic]:', donePayload.debugError);
      }

      if (donePayload?.isError || (!fullText.trim() && !donePayload?.reply)) {
        const reason = donePayload?.debugError || donePayload?.error || 'Empty AI response';
        console.error('[Vikash AI Stream Failed]:', reason);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? {
                  ...m,
                  text: 'Something went wrong, please try again.',
                  isError: true,
                  retryPrompt: trimmed,
                  isStreaming: false
                }
              : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? {
                  ...m,
                  text: donePayload?.reply || fullText,
                  recommendedProjects: Array.isArray(donePayload?.recommendedProjects)
                    ? donePayload.recommendedProjects
                    : [],
                  actionButtons: Array.isArray(donePayload?.actionButtons) ? donePayload.actionButtons : [],
                  showLeadCard: Boolean(donePayload?.showLeadCard),
                  whatsappNumber: donePayload?.whatsappNumber || '919931890824',
                  isStreaming: false
                }
              : m
          )
        );
        if (Array.isArray(donePayload?.quickFollowUps) && donePayload.quickFollowUps.length > 0) {
          setChips(donePayload.quickFollowUps);
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
      setIsLoading(false);
      setStreamingMsgId(null);

      if (err?.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((m) => (m.id === botMsgId ? { ...m, isStreaming: false } : m))
        );
        return;
      }

      console.error('[Vikash AI Request Exception]:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          sender: 'bot',
          text: 'Something went wrong, please try again.',
          recommendedProjects: [],
          actionButtons: [],
          showLeadCard: false,
          isError: true,
          retryPrompt: trimmed,
          isStreaming: false
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = () => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        showToast('वॉइस इनपुट के लिए Chrome ब्राउज़र का उपयोग करें');
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'hi-IN';
      recognition.interimResults = false;
      setIsListening(true);
      recognition.onresult = (e) => {
        const spoken = e.results[0][0].transcript;
        setIsListening(false);
        setInput(spoken);
        if (!isBusy) {
          sendMessage(spoken);
        } else {
          showToast('जवाब पूरा होते ही Send दबाएँ');
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleSecretLogoTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      setShowAdminModal(true);
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 2500);
  };

  const fetchAdminStats = async (pwd = adminPassword) => {
    setAdminLoading(true);
    setAdminError('');
    try {
      const res = await fetch(ADMIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stats', password: pwd })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAdminError(data.error || 'लॉगिन विफल रहा');
        setAdminAuthorized(false);
      } else {
        setAdminAuthorized(true);
        setAdminData(data);
      }
    } catch {
      setAdminError('सर्वर से कनेक्ट नहीं हो सका');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleDeleteSession = async (targetSessionId, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(ADMIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_session',
          password: adminPassword,
          sessionId: targetSessionId
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Session deleted');
        if (expandedSessionId === targetSessionId) setExpandedSessionId(null);
        fetchAdminStats();
      }
    } catch {}
  };

  const handleCopyTranscript = async (session, e) => {
    e.stopPropagation();
    const lines = (session.conversation || []).map(
      (t) => `${t.role === 'user' ? session.visitorName || 'Visitor' : 'Vikash AI'}: ${t.text}`
    );
    await handleCopyMessage(session.sessionId, lines.join('\n\n'));
    showToast('Chat transcript copied!');
  };

  const handleDictateNote = () => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        showToast('वॉइस टाइपिंग के लिए Chrome ब्राउज़र का उपयोग करें');
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'hi-IN';
      recognition.interimResults = false;
      setIsNoteListening(true);
      recognition.onresult = (e) => {
        const spoken = String(e.results[0][0].transcript || '').trim();
        setIsNoteListening(false);
        if (spoken) {
          setNoteDraft((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken));
          showToast('टेक्स्ट बॉक्स में लिख दिया गया — अब चेक करके Save करें');
        }
      };
      recognition.onerror = () => setIsNoteListening(false);
      recognition.onend = () => setIsNoteListening(false);
      recognition.start();
    } catch {
      setIsNoteListening(false);
    }
  };

  const handleSaveNoteToSupabase = async (e) => {
    e.preventDefault();
    const cleaned = noteDraft.trim();
    if (!cleaned || isSavingNote) return;

    setIsSavingNote(true);
    try {
      const payload = editingNoteId
        ? {
            action: 'update_note',
            password: adminPassword,
            id: editingNoteId,
            category: noteCategory,
            noteText: cleaned
          }
        : {
            action: 'save_note',
            password: adminPassword,
            category: noteCategory,
            noteText: cleaned
          };

      const res = await fetch(ADMIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'सेव करने में समस्या आई');
      } else {
        showToast(editingNoteId ? 'नोट अपडेट हो गया!' : 'AI Memory में सेव हो गया!');
        setNoteDraft('');
        setEditingNoteId(null);
        fetchAdminStats();
      }
    } catch {
      showToast('नेटवर्क एरर आया');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNote = async (id) => {
    try {
      const res = await fetch(ADMIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_note',
          password: adminPassword,
          id
        })
      });
      const data = await res.json();
      if (data.success) {
        if (editingNoteId === id) {
          setEditingNoteId(null);
          setNoteDraft('');
        }
        showToast('Note deleted');
        fetchAdminStats();
      }
    } catch {}
  };

  const canSend = input.trim().length > 0 && !isBusy;

  const filteredAdminSessions = (adminData?.recentSessions || []).filter((s) => {
    const q = adminSearch.trim().toLowerCase();
    if (!q) return true;
    const inMeta = `${s.sessionId} ${s.visitorName} ${s.deviceInfo} ${s.city}`.toLowerCase().includes(q);
    const inMsgs = (s.conversation || []).some((m) => String(m.text || '').toLowerCase().includes(q));
    return inMeta || inMsgs;
  });

  return (
    <div className="fixed inset-0 bg-white flex flex-col h-[100dvh] w-screen overflow-hidden text-neutral-900 font-sans">
      {toastText && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-neutral-900 text-white text-xs px-4 py-2 rounded-full shadow-md font-medium">
          {toastText}
        </div>
      )}

      <header className="flex-none flex items-center justify-between px-3 sm:px-5 py-3 bg-white border-b border-neutral-100 z-20">
        <div
          onClick={handleSecretLogoTap}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer select-none"
          title="Vikash AI"
        >
          <div className="w-9 h-9 rounded-full bg-neutral-900 flex items-center justify-center overflow-hidden flex-shrink-0">
            {!avatarError ? (
              <img
                src={VIKASH_AVATAR_URL}
                alt="Vikash AI"
                onError={() => setAvatarError(true)}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold text-white">V</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[15px] font-semibold text-neutral-900 leading-tight truncate">Vikash AI</h1>
              {chatMode === 'recruiter' && (
                <span className="px-2 py-0.5 rounded-full bg-neutral-900 text-white text-[10px] font-medium">
                  Portfolio
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400 truncate">Personal Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={handleClearChat}
            className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 transition-colors"
            title="नया चैट"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
        </div>
      </header>

      <main
        ref={mainScrollRef}
        onScroll={handleFeedScroll}
        className="flex-1 overflow-y-auto px-4 py-5 space-y-6 max-w-3xl w-full mx-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {messages.map((msg) => {
          const isMsgStreaming = Boolean(msg.isStreaming || streamingMsgId === msg.id);
          return (
            <div key={msg.id} className={`w-full flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.sender === 'user' ? (
                <div className="max-w-[85%] sm:max-w-[75%] bg-neutral-100 rounded-[22px] px-4 py-3 text-[14.5px] leading-relaxed text-neutral-900">
                  <FormattedMessage text={msg.text} />
                </div>
              ) : msg.isError ? (
                <div className="max-w-[92%] sm:max-w-[80%] rounded-2xl border border-red-200 bg-red-50/60 px-4 py-3.5 text-sm text-neutral-800 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="text-[13.5px] leading-relaxed">
                      <span className="font-semibold text-neutral-900">Something went wrong, please try again.</span>
                    </div>
                  </div>
                  {msg.retryPrompt && (
                    <button
                      type="button"
                      onClick={() => sendMessage(msg.retryPrompt, true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 text-xs font-medium active:scale-95 transition-all"
                    >
                      <svg className="w-3.5 h-3.5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      <span>Try again</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="max-w-[96%] sm:max-w-[88%] text-[14.5px] leading-relaxed text-neutral-900 space-y-2">
                  {msg.text ? (
                    <FormattedMessage text={msg.text} />
                  ) : (
                    <div className="flex items-center gap-1 py-2 px-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce"
                        style={{ animationDelay: '0.15s' }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce"
                        style={{ animationDelay: '0.3s' }}
                      />
                    </div>
                  )}

                  {!isMsgStreaming && String(msg.text || '').trim().length > 0 && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, msg.text)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
                        aria-label="Copy"
                      >
                        {copiedMsgId === msg.id ? (
                          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.9"
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSpeakMessage(msg.id, msg.text)}
                        className={`p-1.5 rounded-lg hover:bg-neutral-100 transition-colors ${
                          speakingMsgId === msg.id || loadingAudioMsgId === msg.id
                            ? 'text-neutral-900'
                            : 'text-neutral-400 hover:text-neutral-800'
                        }`}
                        aria-label={speakingMsgId === msg.id ? 'Stop' : 'Speak'}
                      >
                        {loadingAudioMsgId === msg.id ? (
                          <svg className="w-4 h-4 animate-spin text-neutral-700" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                          </svg>
                        ) : speakingMsgId === msg.id ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="6" width="12" height="12" rx="2" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.9"
                              d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}

                  {!isMsgStreaming && msg.showLeadCard && (
                    <ConnectLeadCard
                      whatsappNumber={msg.whatsappNumber}
                      defaultName={visitorName}
                      onSubmitted={(url, purpose) => trackClick('lead_whatsapp', `Lead: ${purpose}`, url)}
                    />
                  )}

                  {!isMsgStreaming && Array.isArray(msg.actionButtons) && msg.actionButtons.length > 0 && (
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      {msg.actionButtons.map((btn, bIdx) => (
                        <a
                          key={bIdx}
                          href={btn.href}
                          target={btn.href.startsWith('tel:') ? undefined : '_blank'}
                          rel={btn.href.startsWith('tel:') ? undefined : 'noopener noreferrer'}
                          onClick={() => trackClick('social_link', btn.label, btn.href)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border border-neutral-200/80 text-xs font-medium no-underline transition-all active:scale-95"
                        >
                          <ActionChipIcon type={btn.type} />
                          <span>{btn.label}</span>
                          <svg className="w-3 h-3 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H8M17 7V16" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  )}

                  {!isMsgStreaming && Array.isArray(msg.recommendedProjects) && msg.recommendedProjects.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {msg.recommendedProjects.map((proj) => (
                        <div
                          key={proj.id || proj.name}
                          className="flex flex-col justify-between p-4 rounded-2xl bg-[#F9FAFB] border border-neutral-200/80 space-y-3"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-semibold text-sm text-neutral-900 truncate">{proj.name}</h3>
                              {proj.stars > 0 && (
                                <span className="text-[11px] text-neutral-500 font-medium">★ {proj.stars}</span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">{proj.description}</p>
                            {Array.isArray(proj.tags) && proj.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {proj.tags.map((tag, tIdx) => (
                                  <span
                                    key={tIdx}
                                    className="px-2 py-0.5 rounded-full bg-neutral-200/70 text-neutral-700 text-[11px] font-medium"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            {proj.githubUrl && (
                              <a
                                href={proj.githubUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => trackClick('project_github', `${proj.name} (GitHub)`, proj.githubUrl)}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-900 text-xs font-medium no-underline transition-colors"
                              >
                                <ActionChipIcon type="GITHUB" />
                                <span>GitHub</span>
                              </a>
                            )}
                            {proj.liveUrl && (
                              <a
                                href={proj.liveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => trackClick('project_demo', `${proj.name} (Live)`, proj.liveUrl)}
                                className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium no-underline transition-colors"
                              >
                                <span>Live Demo</span>
                                <span>↗</span>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="w-full flex justify-start">
            <div className="flex items-center gap-1 py-2 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" />
              <span
                className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce"
                style={{ animationDelay: '0.15s' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce"
                style={{ animationDelay: '0.3s' }}
              />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="flex-none px-3 sm:px-4 pt-2 pb-4 bg-white max-w-3xl w-full mx-auto">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) sendMessage(input);
          }}
          className="flex items-center gap-1.5 bg-neutral-100 rounded-full p-1.5"
        >
          <button
            type="button"
            onClick={handleVoiceInput}
            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
              isListening ? 'bg-neutral-900 text-white animate-pulse' : 'text-neutral-500 hover:text-neutral-900'
            }`}
            aria-label="Voice Input"
            title="Voice Input"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isListening
                ? 'Listening...'
                : isBusy
                ? 'Type your next question while waiting...'
                : 'Ask anything...'
            }
            className="flex-1 bg-transparent py-1.5 px-1 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none border-0"
            autoComplete="off"
          />

          {isBusy ? (
            <button
              type="button"
              onClick={handleStopGenerating}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-neutral-900 text-white cursor-pointer active:scale-95 transition-all"
              aria-label="Stop generating"
              title="Stop generating"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                canSend
                  ? 'bg-neutral-900 text-white cursor-pointer active:scale-95'
                  : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
              aria-label="Send"
              title="Send"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </form>
      </footer>

      {showAdminModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-neutral-200 max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
              <div>
                <h2 className="font-semibold text-neutral-900 text-sm">Vikash AI — Private Admin Dashboard</h2>
                <p className="text-[11px] text-neutral-400">
                  {adminAuthorized ? 'Monitor visitor chats & teach Vikash AI live updates' : 'Password Protected'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="text-neutral-400 hover:text-neutral-800 text-xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            {adminAuthorized && (
              <div className="flex border-b border-neutral-100 px-5 pt-2 gap-2 bg-neutral-50/60">
                <button
                  type="button"
                  onClick={() => setAdminTab('analytics')}
                  className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors ${
                    adminTab === 'analytics'
                      ? 'border-neutral-900 text-neutral-900'
                      : 'border-transparent text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  📊 Visitor Chats & Analytics
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTab('knowledge')}
                  className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors ${
                    adminTab === 'knowledge'
                      ? 'border-neutral-900 text-neutral-900'
                      : 'border-transparent text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  🧠 My Knowledge ({(adminData?.customNotes || []).length})
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!adminAuthorized ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    fetchAdminStats();
                  }}
                  className="max-w-xs mx-auto py-8 space-y-3 text-center"
                >
                  <p className="text-xs text-neutral-500">Netlify में सेट किया गया Admin Password डालें:</p>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Admin Password"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 text-sm text-neutral-900 focus:outline-none"
                    autoFocus
                  />
                  {adminError && <p className="text-xs text-red-500 font-medium">{adminError}</p>}
                  <button
                    type="submit"
                    disabled={adminLoading || !adminPassword.trim()}
                    className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {adminLoading ? 'Checking...' : 'Unlock Dashboard'}
                  </button>
                </form>
              ) : adminTab === 'knowledge' ? (
                <div className="space-y-4">
                  <form
                    onSubmit={handleSaveNoteToSupabase}
                    className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-neutral-900">
                        {editingNoteId ? '✏️ Edit Saved Note' : '➕ Add New Info to Vikash AI (Supabase)'}
                      </span>
                      <select
                        value={noteCategory}
                        onChange={(e) => setNoteCategory(e.target.value)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-[11px] font-medium text-neutral-800 focus:outline-none"
                      >
                        <option value="Project / Update">Project / Update</option>
                        <option value="Achievement / Award">Achievement / Award</option>
                        <option value="Skill / Tech">Skill / Tech</option>
                        <option value="Education / College">Education / College</option>
                        <option value="Personal / Contact">Personal / Contact</option>
                      </select>
                    </div>

                    <textarea
                      rows={4}
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder={
                        isNoteListening
                          ? 'बोलिए... टेक्स्ट यहाँ दिखेगा, ऑटो-सेव नहीं होगा...'
                          : 'यहाँ लिखें या नीचे "Speak" दबाकर बोलें — बोलने के बाद आप स्पेलिंग सुधार कर Save दबा सकते हैं...'
                      }
                      className="w-full p-3 rounded-xl bg-white border border-neutral-200 text-xs text-neutral-900 leading-relaxed focus:outline-none focus:border-neutral-400"
                    />

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleDictateNote}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                          isNoteListening
                            ? 'bg-red-600 text-white animate-pulse'
                            : 'bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-200'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                          />
                        </svg>
                        <span>{isNoteListening ? 'Listening...' : 'Speak (Voice Type)'}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {editingNoteId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNoteId(null);
                              setNoteDraft('');
                            }}
                            className="px-3 py-2 rounded-xl bg-neutral-200 text-neutral-700 text-xs font-medium"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={!noteDraft.trim() || isSavingNote}
                          className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold disabled:opacity-40 transition-colors"
                        >
                          {isSavingNote ? 'Saving...' : editingNoteId ? 'Update Note' : 'Save to AI Memory'}
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-neutral-700">
                      Saved Live Knowledge Notes ({(adminData?.customNotes || []).length})
                    </h3>
                    {(adminData?.customNotes || []).length === 0 ? (
                      <p className="text-xs text-neutral-400 py-4 text-center">
                        अभी कोई नया नोट सेव नहीं है। ऊपर बोलकर या लिखकर अपना पहला नोट जोड़ें!
                      </p>
                    ) : (
                      (adminData?.customNotes || []).map((n) => (
                        <div
                          key={n.id}
                          className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-neutral-200/80 text-neutral-800 text-[10px] font-semibold">
                              {n.category || 'General'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteId(n.id);
                                  setNoteCategory(n.category || 'Project / Update');
                                  setNoteDraft(n.note_text || '');
                                }}
                                className="px-2 py-0.5 rounded bg-white border border-neutral-200 text-[10px] text-neutral-700 hover:bg-neutral-100"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteNote(n.id)}
                                className="px-2 py-0.5 rounded bg-white border border-red-200 text-[10px] text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <p className="text-neutral-800 leading-relaxed whitespace-pre-wrap">{n.note_text}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(adminData?.integrations || {}).map(([name, ok]) => (
                      <span
                        key={name}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                          ok
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-600 border border-red-200'
                        }`}
                      >
                        {ok ? '●' : '○'} {name.toUpperCase()}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/70">
                      <div className="text-[11px] text-neutral-500">Visitors</div>
                      <div className="text-lg font-bold text-neutral-900">{adminData?.stats?.totalSessions ?? 0}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/70">
                      <div className="text-[11px] text-neutral-500">Total Chats</div>
                      <div className="text-lg font-bold text-neutral-900">{adminData?.stats?.totalMessages ?? 0}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/70">
                      <div className="text-[11px] text-neutral-500">Link Clicks</div>
                      <div className="text-lg font-bold text-neutral-900">{adminData?.stats?.totalClicks ?? 0}</div>
                    </div>
                  </div>

                  {adminData?.stats?.topTopics?.length > 0 && (
                    <div className="space-y-1.5">
                      <h3 className="text-xs font-semibold text-neutral-700">Top Asked Topics</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {adminData.stats.topTopics.map((t, i) => (
                          <span key={i} className="px-2.5 py-1 rounded-lg bg-neutral-100 text-xs text-neutral-800">
                            {t.topic}: <strong>{t.count}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {adminData?.stats?.topClicks?.length > 0 && (
                    <div className="space-y-1.5">
                      <h3 className="text-xs font-semibold text-neutral-700">Top Clicked Projects & Links</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {adminData.stats.topClicks.map((c, i) => (
                          <span key={i} className="px-2.5 py-1 rounded-lg bg-neutral-100 text-xs text-neutral-800">
                            {c.label}: <strong>{c.count}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-neutral-700">
                        Visitor Sessions ({filteredAdminSessions.length})
                      </h3>
                      <button type="button" onClick={() => fetchAdminStats()} className="text-xs text-blue-600 font-medium">
                        Refresh
                      </button>
                    </div>

                    <input
                      type="text"
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      placeholder="Search by question, visitor name, or session ID..."
                      className="w-full px-3 py-2 rounded-xl bg-neutral-100 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none"
                    />

                    <div className="space-y-2">
                      {filteredAdminSessions.map((s) => {
                        const isExpanded = expandedSessionId === s.sessionId;
                        return (
                          <div
                            key={s.sessionId}
                            onClick={() => setExpandedSessionId(isExpanded ? null : s.sessionId)}
                            className="p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100/70 border border-neutral-200/80 text-xs space-y-1.5 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {s.isActiveNow && (
                                  <span
                                    className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"
                                    title="Active Now"
                                  />
                                )}
                                <span className="font-semibold text-neutral-900 truncate">
                                  {s.visitorName && s.visitorName !== 'Visitor'
                                    ? `${s.visitorName} (${s.sessionId})`
                                    : s.sessionId}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-neutral-500">{s.messageCount} msgs</span>
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyTranscript(s, e)}
                                  className="px-2 py-0.5 rounded bg-white border border-neutral-200 text-[10px] text-neutral-700 hover:bg-neutral-100"
                                  title="Copy Full Chat"
                                >
                                  Copy
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteSession(s.sessionId, e)}
                                  className="px-2 py-0.5 rounded bg-white border border-red-200 text-[10px] text-red-600 hover:bg-red-50"
                                  title="Delete Session"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            <div className="text-[11px] text-neutral-400">
                              {s.deviceInfo} {s.city ? `• ${s.city}` : ''}
                            </div>

                            {!isExpanded && s.lastUserMessage && (
                              <p className="text-neutral-800 pt-0.5 truncate">
                                <strong>Last Q:</strong> {s.lastUserMessage}
                              </p>
                            )}

                            {isExpanded && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="mt-2 pt-2.5 border-t border-neutral-200/80 space-y-2 max-h-64 overflow-y-auto"
                              >
                                {(s.conversation || []).length === 0 ? (
                                  <p className="text-neutral-400 italic">No messages recorded.</p>
                                ) : (
                                  (s.conversation || []).map((turn, idx) => (
                                    <div
                                      key={idx}
                                      className={`p-2 rounded-lg text-xs leading-relaxed ${
                                        turn.role === 'user'
                                          ? 'bg-white border border-neutral-200/80 text-neutral-900'
                                          : 'bg-neutral-200/50 text-neutral-800'
                                      }`}
                                    >
                                      <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                                        <span className="font-semibold text-neutral-600">
                                          {turn.role === 'user' ? s.visitorName || 'Visitor' : 'Vikash AI'}
                                        </span>
                                        {turn.ts && (
                                          <span>
                                            {new Date(turn.ts).toLocaleTimeString([], {
                                              hour: '2-digit',
                                              minute: '2-digit'
                                            })}
                                          </span>
                                        )}
                                      </div>
                                      <div className="whitespace-pre-wrap break-words">{turn.text}</div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}