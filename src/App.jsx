// File: src/App.jsx (Vikash AI — Personal Assistant)
// Complete, standalone runnable React + Tailwind CSS component
import React, { useState, useEffect, useRef } from 'react';

// 👉 अपनी फोटो public/vikash.jpg में रखें (अगर फोटो न मिले तो अपने-आप "V" दिखेगा)
const VIKASH_AVATAR_URL = '/vikash.jpg';
const CHAT_API = '/.netlify/functions/personalChat';
const ADMIN_API = '/.netlify/functions/adminDashboard';

// Fallback custom knowledge (यदि अलग फाइल न बनी हो तब भी ऐप बिना किसी रुकावट के चलेगा)
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

function ActionChipIcon({ type }) {
  const t = String(type || '').toUpperCase();
  if (t === 'GITHUB') {
    return (
      <svg className="w-3.5 h-3.5 text-neutral-800 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    );
  }
  if (t === 'WHATSAPP') {
    return (
      <svg className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );
  }
  if (t === 'CALL') {
    return (
      <svg className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function renderInlineMarkdown(rawText) {
  const placeholders = [];
  const withMd = String(rawText || '').replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|tel:[^\s)]+)\)/g,
    (_, label, url) => {
      const idx = placeholders.length;
      placeholders.push({ label, url });
      return `__LINK_${idx}__`;
    }
  );

  const withBare = withMd.replace(/(https?:\/\/[^\s<>"')\]]+)/g, (url) => {
    const cleaned = url.replace(/[.,!?;:]+$/, '');
    const trailing = url.slice(cleaned.length);
    const idx = placeholders.length;
    placeholders.push({ label: cleaned, url: cleaned });
    return `__LINK_${idx}__${trailing}`;
  });

  const parts = withBare.split(/(__LINK_\d+__|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const linkMatch = part.match(/^__LINK_(\d+)__$/);
    if (linkMatch) {
      const item = placeholders[Number(linkMatch[1])];
      if (!item) return null;
      const isTel = item.url.startsWith('tel:');
      return (
        <a
          key={i}
          href={item.url}
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

export default function App() {
  const [sessionId] = useState(() => getOrCreateSessionId());
  const [avatarError, setAvatarError] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome-1',
      sender: 'bot',
      text: '',
      recommendedProjects: [],
      actionButtons: [],
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
  const [showOptions, setShowOptions] = useState(false);
  const [cachedGeoStr, setCachedGeoStr] = useState('');

  // Secret 5-tap Admin Monitoring Dashboard state
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);
  const [customKnowledgeData, setCustomKnowledgeData] = useState(DEFAULT_CUSTOM_KNOWLEDGE);
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

  const messagesEndRef = useRef(null);

  const showToast = (msg) => {
    setToastText(msg);
    setTimeout(() => setToastText(''), 2500);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        body: JSON.stringify({ isWelcomeGreeting: true })
      });
      const data = res.ok ? await res.json() : null;
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
        () => {
          if (forcePrompt) showToast('लोकेशन की अनुमति नहीं मिली');
        },
        { timeout: 6000 }
      );
    };
    if (forcePrompt) run();
    else if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((p) => p.state === 'granted' && run()).catch(() => {});
    }
  };

  useEffect(() => {
    detectGps(false);
    // Load optional ./data/customKnowledge.js dynamically if present without breaking build
    import(/* @vite-ignore */ './data/customKnowledge.js')
      .then((mod) => {
        if (mod && mod.VIKASH_CUSTOM_KNOWLEDGE) {
          setCustomKnowledgeData(mod.VIKASH_CUSTOM_KNOWLEDGE);
        }
      })
      .catch(() => {});
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

  const handleClearChat = () => {
    try {
      localStorage.setItem('vk_chat_cleared_at', new Date().toISOString());
    } catch {}
    const id = 'welcome-' + Date.now();
    setStreamingMsgId(id);
    setMessages([
      {
        id,
        sender: 'bot',
        text: '',
        recommendedProjects: [],
        actionButtons: [],
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

  const handleSpeakMessage = (msgId, text) => {
    if (!('speechSynthesis' in window)) {
      showToast('इस ब्राउज़र में वॉइस रीडिंग उपलब्ध नहीं है');
      return;
    }
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const clean = String(text || '').replace(/https?:\/\/\S+/g, '').replace(/[*_#`~]/g, '').trim();
    if (!clean) return;
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = 'hi-IN';
    utter.onend = () => setSpeakingMsgId(null);
    utter.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utter);
  };

  const sendMessage = async (textToSend, isRetry = false) => {
    const trimmed = String(textToSend || '').trim();
    if (!trimmed || isLoading) return;

    if (!isRetry) {
      setMessages((prev) => [...prev, { id: 'u-' + Date.now(), sender: 'user', text: trimmed }]);
      setInput('');
    } else {
      setMessages((prev) => prev.filter((m) => !m.isError));
    }

    setIsLoading(true);
    const botMsgId = 'b-' + Date.now();
    const controller = new AbortController();
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
          message: trimmed,
          history: historyPayload,
          clientDevice,
          customKnowledge: customKnowledgeData
        })
      });
      clearTimeout(timeoutId);

      if (!res.ok || !res.body) throw new Error('Network error');

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

      setStreamingMsgId(null);
      if (donePayload?.isError || (!fullText.trim() && !donePayload?.reply)) {
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
                  recommendedProjects: Array.isArray(donePayload?.recommendedProjects) ? donePayload.recommendedProjects : [],
                  actionButtons: Array.isArray(donePayload?.actionButtons) ? donePayload.actionButtons : [],
                  isStreaming: false
                }
              : m
          )
        );
        if (Array.isArray(donePayload?.quickFollowUps) && donePayload.quickFollowUps.length > 0) {
          setChips(donePayload.quickFollowUps);
        }
      }
    } catch {
      clearTimeout(timeoutId);
      setIsLoading(false);
      setStreamingMsgId(null);
      setMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          sender: 'bot',
          text: 'Something went wrong, please try again.',
          recommendedProjects: [],
          actionButtons: [],
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
      sendMessage(spoken);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  // Secret 5-tap on Vikash AI logo
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

  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <div className="fixed inset-0 bg-white flex flex-col h-[100dvh] w-screen overflow-hidden text-neutral-900 font-sans">
      {toastText && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-xs px-4 py-2 rounded-full shadow-md font-medium">
          {toastText}
        </div>
      )}

      {/* 1. TOP HEADER (5-Tap on Logo opens Admin Dashboard) */}
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
            <h1 className="text-[15px] font-semibold text-neutral-900 leading-tight truncate">Vikash AI</h1>
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setShowOptions(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 transition-colors"
            title="विकल्प"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </header>

      {/* 2. CHAT FEED */}
      <main className="flex-1 overflow-y-auto px-4 py-5 space-y-6 max-w-3xl w-full mx-auto" style={{ scrollbarWidth: 'none' }}>
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
                    <div className="flex items-center gap-1.5 py-2 px-1">
                      <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" />
                      <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </div>
                  )}

                  {/* ICON-ONLY COPY & SPEAK/STOP BUTTONS (NO TEXT LABELS) */}
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSpeakMessage(msg.id, msg.text)}
                        className={`p-1.5 rounded-lg hover:bg-neutral-100 transition-colors ${
                          speakingMsgId === msg.id ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-800'
                        }`}
                        aria-label={speakingMsgId === msg.id ? 'Stop' : 'Speak'}
                      >
                        {speakingMsgId === msg.id ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="6" width="12" height="12" rx="2" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}

                  {/* ACTION BUTTON CHIPS */}
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

                  {/* PROJECT CARDS (Auto-fetched from GitHub) */}
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
            <div className="flex items-center gap-1.5 py-2 px-1">
              <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
              <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* 3. BOTTOM INPUT DOCK */}
      <footer className="flex-none px-3 sm:px-4 py-3 bg-white max-w-3xl w-full mx-auto">
        <div className="flex items-center gap-2 overflow-x-auto pb-2.5 text-xs text-neutral-600" style={{ scrollbarWidth: 'none' }}>
          {chips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => sendMessage(chip)}
              className="px-2.5 py-1 rounded-full bg-transparent hover:text-neutral-950 text-neutral-600 whitespace-nowrap active:scale-95 transition-all font-medium"
            >
              {chip}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) sendMessage(input);
          }}
          className="flex items-center bg-neutral-100 rounded-full pl-4 pr-1.5 py-1.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? 'Listening...' : 'Ask anything...'}
            className="flex-1 bg-transparent py-1.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none border-0"
            autoComplete="off"
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleVoiceInput}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                isListening ? 'bg-neutral-900 text-white animate-pulse' : 'text-neutral-500 hover:text-neutral-900'
              }`}
              aria-label="Voice Input"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <button
              type="submit"
              disabled={!canSend}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                canSend ? 'bg-neutral-900 text-white cursor-pointer active:scale-95' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
              aria-label="Send"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </form>
      </footer>

      {/* OPTIONS MODAL */}
      {showOptions && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowOptions(false)}>
          <div className="bg-white w-full max-w-sm rounded-t-2xl md:rounded-2xl p-5 space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-neutral-100 pb-2.5">
              <span className="font-semibold text-neutral-900 text-sm">Options</span>
              <button type="button" onClick={() => setShowOptions(false)} className="text-neutral-400 hover:text-neutral-700 text-xl font-bold">&times;</button>
            </div>
            <div className="space-y-1 text-sm text-neutral-700">
              <button
                type="button"
                onClick={() => {
                  handleClearChat();
                  setShowOptions(false);
                }}
                className="w-full text-left p-2.5 rounded-xl hover:bg-neutral-100 flex items-center gap-3"
              >
                <span>🗑️</span> <span>Clear Chat</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  detectGps(true);
                  setShowOptions(false);
                  showToast('GPS लोकेशन अपडेट की जा रही है...');
                }}
                className="w-full text-left p-2.5 rounded-xl hover:bg-neutral-100 flex items-center gap-3"
              >
                <span>📍</span> <span>Update Exact GPS Location</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRIVATE ADMIN MONITORING DASHBOARD (Unlocked via 5-tap on Logo or ?admin=true) */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-neutral-200 max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
              <div>
                <h2 className="font-semibold text-neutral-900 text-sm">Vikash AI — Private Monitoring Dashboard</h2>
                <p className="text-[11px] text-neutral-400">Netlify Server Password Protected</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="text-neutral-400 hover:text-neutral-800 text-xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

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
              ) : (
                <>
                  {/* Integration Status */}
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(adminData?.integrations || {}).map(([name, ok]) => (
                      <span
                        key={name}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                          ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
                        }`}
                      >
                        {ok ? '●' : '○'} {name.toUpperCase()}
                      </span>
                    ))}
                  </div>

                  {/* KPI Row */}
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

                  {/* Top Clicked Links */}
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

                  {/* Recent Visitor Questions */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-neutral-700">Recent Visitor Activity</h3>
                      <button type="button" onClick={() => fetchAdminStats()} className="text-xs text-blue-600 font-medium">
                        Refresh
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(adminData?.recentSessions || []).map((s) => (
                        <div key={s.sessionId} className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/70 text-xs space-y-1">
                          <div className="flex justify-between text-neutral-500">
                            <span className="font-medium text-neutral-800">{s.sessionId}</span>
                            <span>{s.messageCount} msgs</span>
                          </div>
                          <div className="text-[11px] text-neutral-400">
                            {s.deviceInfo} {s.city ? `• ${s.city}` : ''}
                          </div>
                          {s.lastUserMessage && (
                            <p className="text-neutral-800 pt-1">
                              <strong>Last Q:</strong> {s.lastUserMessage}
                            </p>
                          )}
                        </div>
                      ))}
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