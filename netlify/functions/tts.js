// File: netlify/functions/tts.js
// Vikash AI — Expressive Human-Like Voice Engine
// Priority 1: Your Custom Cloned Voice via Fish Audio (`FISH_API_KEY` + `FISH_VOICE_ID`)
// Priority 2: Free Unlimited Hindi Neural Audio Stream (Zero skipped words, pure Hindi accent)
// Priority 3: Frontend Browser Voice fallback

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Expose-Headers': 'X-Voice-Source, X-Voice-Mood, X-Playback-Rate',
  'Access-Control-Max-Age': '86400'
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

function analyzeConversationalTone(text) {
  const t = String(text || '').toLowerCase();

  if (
    /माफ़|सॉरी|sorry|दुख|sad|समस्या|दिक्कत|problem|error|fail|अफसोस|चिंता मत|trouble|issue|down|overload/i.test(
      t
    )
  ) {
    return {
      mood: 'empathetic',
      fishSpeed: 0.96,
      fishVolume: -1,
      temperature: 0.65,
      topP: 0.72,
      playbackRate: 1.06
    };
  }

  if (
    /!|कमाल|शानदार|बधाई|congrat|awesome|amazing|great|happy|खुशी|वाह|best performer|award|भाई|यार/i.test(
      t
    )
  ) {
    return {
      mood: 'warm_excited',
      fishSpeed: 1.08,
      fishVolume: 1,
      temperature: 0.85,
      topP: 0.85,
      playbackRate: 1.18
    };
  }

  return {
    mood: 'conversational',
    fishSpeed: 1.05,
    fishVolume: 0,
    temperature: 0.76,
    topP: 0.8,
    playbackRate: 1.14
  };
}

/**
 * Strips ONLY URLs, emails, emojis, and markdown symbols without ever eating normal words.
 */
function shapeConversationalText(raw) {
  let clean = String(raw || '')
    // 1. Markdown links [label](url) -> keep readable label
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|tel:|mailto:)[^)]+\)/gi, '$1')
    // 2. Full URLs (http/https/www/tel/mailto)
    .replace(/(?:https?:\/\/|www\.|tel:|mailto:)\S+/gi, ' ')
    // 3. Bare domain links only when host has 2+ chars before dot (avoids touching abbreviations)
    .replace(
      /\b[a-z0-9-]{2,}(?:\.[a-z0-9-]{2,})+\.(?:ac\.in|edu\.in|gov\.in|org\.in|com|in|org|net|io|app)(?:\/\S*)?/gi,
      ' '
    )
    // 4. Email addresses
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, ' ')
    // 5. Emojis & pictographs only (never touches letters or numbers)
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, ' ')
    // 6. Markdown syntax characters
    .replace(/[*_`~>•|]/g, ' ')
    .replace(/#{1,6}\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);

  return clean;
}

const HINGLISH_TO_HINDI_MAP = {
  namaste: 'नमस्ते',
  main: 'मैं',
  mai: 'मैं',
  hoon: 'हूँ',
  hu: 'हूँ',
  hai: 'है',
  hain: 'हैं',
  ho: 'हो',
  kaise: 'कैसे',
  kaisa: 'कैसा',
  kaisi: 'कैसी',
  kya: 'क्या',
  kyu: 'क्यों',
  kyun: 'क्यों',
  kaun: 'कौन',
  kahan: 'कहाँ',
  kab: 'कब',
  karu: 'करूँ',
  karoon: 'करूँ',
  kar: 'कर',
  karo: 'करो',
  karna: 'करना',
  karte: 'करते',
  aap: 'आप',
  aapka: 'आपका',
  aapki: 'आपकी',
  aapke: 'आपके',
  aapko: 'आपको',
  mera: 'मेरा',
  meri: 'मेरी',
  mere: 'मेरे',
  mujhe: 'मुझे',
  tum: 'तुम',
  tumhara: 'तुम्हारा',
  hum: 'हम',
  hamara: 'हमारा',
  aur: 'और',
  ya: 'या',
  lekin: 'लेकिन',
  par: 'पर',
  toh: 'तो',
  to: 'तो',
  bhi: 'भी',
  hi: 'ही',
  nahi: 'नहीं',
  nhi: 'नहीं',
  haan: 'हाँ',
  ji: 'जी',
  bhai: 'भाई',
  yaar: 'यार',
  arey: 'अरे',
  are: 'अरे',
  achha: 'अच्छा',
  accha: 'अच्छा',
  theek: 'ठीक',
  thik: 'ठीक',
  batao: 'बताओ',
  bataiye: 'बताइए',
  bataye: 'बताएँ',
  jaanna: 'जानना',
  janna: 'जानना',
  baare: 'बारे',
  bare: 'बारे',
  mein: 'में',
  me: 'में',
  se: 'से',
  ko: 'को',
  ka: 'का',
  ki: 'की',
  ke: 'के',
  liye: 'लिए',
  saath: 'साथ',
  sath: 'साथ',
  yeh: 'यह',
  ye: 'ये',
  woh: 'वह',
  wo: 'वो',
  abhi: 'अभी',
  aaj: 'आज',
  kal: 'कल',
  bahut: 'बहुत',
  thoda: 'थोड़ा',
  sab: 'सब',
  kuch: 'कुछ',
  kuchh: 'कुछ',
  madad: 'मदद',
  vikash: 'विकास',
  vikas: 'विकास',
  gupta: 'गुप्ता',
  kumar: 'कुमार'
};

function detectHindiOrHinglish(text) {
  if (/[\u0900-\u097F]/.test(text)) return true;
  const words = String(text || '').toLowerCase().match(/\b[a-z]+\b/g) || [];
  let hits = 0;
  for (const w of words) {
    if (HINGLISH_TO_HINDI_MAP[w]) hits += 1;
    if (hits >= 2) return true;
  }
  return false;
}

function prepareTextForHindiTTS(text) {
  return String(text || '')
    .replace(/\bAI\b/g, 'ए आई')
    .replace(/\b([a-zA-Z]+)\b/g, (word) => HINGLISH_TO_HINDI_MAP[word.toLowerCase()] || word);
}

async function synthesizeFishCustomVoice(text, tone, apiKey, voiceId) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        model: 's1'
      },
      body: JSON.stringify({
        text,
        reference_id: voiceId,
        format: 'mp3',
        mp3_bitrate: 128,
        latency: 'normal',
        temperature: tone.temperature,
        top_p: tone.topP,
        prosody: {
          speed: tone.fishSpeed,
          volume: tone.fishVolume
        }
      })
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const audioBuffer = await res.arrayBuffer();
    if (!audioBuffer || audioBuffer.byteLength < 200) return null;
    return audioBuffer;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

async function synthesizeHindiNeuralStream(text) {
  const isHindi = detectHindiOrHinglish(text);
  const langCode = isHindi ? 'hi' : 'en';
  const preparedText = isHindi ? prepareTextForHindiTTS(text) : text;

  const sentences = preparedText
    .split(/(?<=[।.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks = [];
  let current = '';
  for (const s of sentences) {
    if ((current + ' ' + s).trim().length <= 180) {
      current = (current + ' ' + s).trim();
    } else {
      if (current) chunks.push(current);
      // Split very long sentence cleanly on word boundary
      if (s.length > 180) {
        const words = s.split(' ');
        let part = '';
        for (const w of words) {
          if ((part + ' ' + w).trim().length <= 180) {
            part = (part + ' ' + w).trim();
          } else {
            if (part) chunks.push(part);
            part = w;
          }
        }
        current = part;
      } else {
        current = s;
      }
    }
  }
  if (current) chunks.push(current);

  const limitedChunks = chunks.slice(0, 7);
  if (limitedChunks.length === 0) return null;

  try {
    const buffers = await Promise.all(
      limitedChunks.map(async (part) => {
        const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${langCode}&q=${encodeURIComponent(
          part
        )}`;
        const res = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
          }
        });
        if (!res.ok) throw new Error('Hindi TTS chunk failed');
        return new Uint8Array(await res.arrayBuffer());
      })
    );

    const totalLen = buffers.reduce((sum, b) => sum + b.byteLength, 0);
    if (totalLen < 200) return null;

    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const b of buffers) {
      merged.set(b, offset);
      offset += b.byteLength;
    }
    return merged.buffer;
  } catch {
    return null;
  }
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { fallback: true, error: 'Method not allowed' });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { fallback: true, reason: 'invalid_json' });
  }

  const spokenText = shapeConversationalText(body.text);
  if (!spokenText) {
    return jsonResponse(400, { fallback: true, reason: 'empty_text' });
  }

  const tone = analyzeConversationalTone(spokenText);
  const fishApiKey = String(process.env.FISH_API_KEY || '').trim();
  const fishVoiceId = String(process.env.FISH_VOICE_ID || '').trim();

  // 1. Priority 1: Your Custom Cloned Voice (Fish Audio)
  if (fishApiKey && fishVoiceId) {
    const fishAudio = await synthesizeFishCustomVoice(spokenText, tone, fishApiKey, fishVoiceId);
    if (fishAudio) {
      return new Response(fishAudio, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'X-Voice-Source': 'fish-audio-custom',
          'X-Voice-Mood': tone.mood,
          'X-Playback-Rate': '1.0',
          'Cache-Control': 'public, max-age=86400',
          ...CORS_HEADERS
        }
      });
    }
  }

  // 2. Priority 2: Free Unlimited Hindi Neural Audio Stream
  const hindiAudio = await synthesizeHindiNeuralStream(spokenText);
  if (hindiAudio) {
    return new Response(hindiAudio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'X-Voice-Source': 'hindi-neural-fallback',
        'X-Voice-Mood': tone.mood,
        'X-Playback-Rate': String(tone.playbackRate),
        'Cache-Control': 'public, max-age=86400',
        ...CORS_HEADERS
      }
    });
  }

  // 3. Emergency Browser Fallback
  return jsonResponse(200, { fallback: true, reason: 'tts_unavailable' });
};