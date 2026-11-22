// ... existing code ...
// File: src/App.jsx (या src/components/VikashAI.jsx)
// Vikash AI — Personal Assistant (React + Tailwind CSS + Netlify Functions)
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
// ... existing code ...
  // Secret 5-tap Admin Monitoring Dashboard state
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);
  const [customKnowledgeData, setCustomKnowledgeData] = useState(DEFAULT_CUSTOM_KNOWLEDGE);
  const [showAdminModal, setShowAdminModal] = useState(() => {
// ... existing code ...
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
// ... existing code ...
          history: historyPayload,
          clientDevice,
          customKnowledge: customKnowledgeData
        })
      });
// ... existing code ...
      {/* OPTIONS MODAL */}
      {showOptions && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowOptions(false)}>
          <div className="bg-white w-full max-w-sm rounded-t-2xl md:rounded-2xl p-5 space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
// ... existing code ...
      {/* PRIVATE ADMIN MONITORING DASHBOARD (Unlocked via 5-tap on Logo or ?admin=true) */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-neutral-200 max-h-[90dvh] flex flex-col overflow-hidden">
// ... existing code ...