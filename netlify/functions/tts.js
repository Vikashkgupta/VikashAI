// File: netlify/functions/tts.js
// Vikash AI — Multi-Voice Expressive Engine
// Supports: Vikash (Default), Ananya (Original Indian Female), Naman, Narendra Modi, Donald Trump, Amitabh Bachchan
import { VOICE_MODEL_IDS } from './voiceModels.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Expose-Headers': 'X-Voice-Source, X-Voice-Mood, X-Playback-Rate, X-Fish-Debug, X-Selected-Voice',
  'Access-Control-Max-Age': '86400'
};

/**
 * 👉 अब सभी Fish Audio Model IDs सीधे netlify/functions/voiceModels.js से लोड होती हैं।
 */
function getFishVoiceModelMap() {
  return {
    vikash: String(VOICE_MODEL_IDS.vikash || process.env.FISH_VOICE_ID || '').trim(),
    naman: String(VOICE_MODEL_IDS.naman || '').trim(),
    modi: String(VOICE_MODEL_IDS.modi || '').trim(),
    trump: String(VOICE_MODEL_IDS.trump || '').trim(),
    amitabh: String(VOICE_MODEL_IDS.amitabh || '').trim()
  };
}

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
      fishSpeed: 1.0,
      fishVolume: 0,
      temperature: 0.54,
      topP: 0.66,
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
      fishSpeed: 1.07,
      fishVolume: 0,
      temperature: 0.68,
      topP: 0.78,
      playbackRate: 1.12
    };
  }

  return {
    mood: 'conversational',
    fishSpeed: 1.04,
    fishVolume: 0,
    temperature: 0.62,
    topP: 0.72,
    playbackRate: 1.09
  };
}

const HINDI_0_TO_99 = [
  'शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ',
  'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस',
  'बीस', 'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस',
  'तीस', 'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस',
  'चालीस', 'इकतालीस', 'बयालीस', 'तैंतालीस', 'चवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास',
  'पचास', 'इक्यावन', 'बावन', 'तिरेपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ',
  'साठ', 'इकसठ', 'बासठ', 'तिरसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सड़सठ', 'अड़सठ', 'उनहत्तर',
  'सत्तर', 'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उनासी',
  'अस्सी', 'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अठासी', 'नवासी',
  'नब्बे', 'इक्यानवे', 'बानवे', 'तिरानवे', 'चौरानवे', 'पचानवे', 'छियानवे', 'सत्तानवे', 'अट्ठानवे', 'निन्यानवे'
];

function numberToHindiWords(rawNum) {
  const cleaned = String(rawNum || '').replace(/,/g, '');
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return rawNum;

  const [intStr, decStr] = cleaned.split('.');
  if (intStr.length > 9 || (intStr.length > 1 && intStr.startsWith('0'))) {
    return rawNum;
  }

  let n = parseInt(intStr, 10);
  if (Number.isNaN(n)) return rawNum;

  const parts = [];
  if (n === 0) {
    parts.push(HINDI_0_TO_99[0]);
  } else {
    const crore = Math.floor(n / 10000000);
    if (crore > 0) {
      parts.push(`${HINDI_0_TO_99[crore]} करोड़`);
      n %= 10000000;
    }
    const lakh = Math.floor(n / 100000);
    if (lakh > 0) {
      parts.push(`${HINDI_0_TO_99[lakh]} लाख`);
      n %= 100000;
    }
    const thousand = Math.floor(n / 1000);
    if (thousand > 0) {
      parts.push(`${HINDI_0_TO_99[thousand]} हज़ार`);
      n %= 1000;
    }
    const hundred = Math.floor(n / 100);
    if (hundred > 0) {
      parts.push(`${HINDI_0_TO_99[hundred]} सौ`);
      n %= 100;
    }
    if (n > 0) {
      parts.push(HINDI_0_TO_99[n]);
    }
  }

  let result = parts.join(' ');
  if (decStr) {
    const decWords = decStr
      .split('')
      .map((d) => HINDI_0_TO_99[parseInt(d, 10)] || d)
      .join(' ');
    result += ` पॉइंट ${decWords}`;
  }
  return result;
}

function shapeConversationalText(raw) {
  let text = String(raw || '')
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|tel:|mailto:)[^)]+\)/gi, '$1')
    .replace(/(?:https?:\/\/|www\.|tel:|mailto:)\S+/gi, ' ')
    .replace(
      /\b[a-z0-9-]{2,}(?:\.[a-z0-9-]{2,})+\.(?:ac\.in|edu\.in|gov\.in|org\.in|com|in|org|net|io|app)(?:\/\S*)?/gi,
      ' '
    )
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, ' ')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, ' ')
    .replace(/\\(?:text|mathbf|frac|times)\b/g, ' ')
    .replace(/\bB\.Tech\b/gi, 'B Tech')
    .replace(/\bM\.Tech\b/gi, 'M Tech')
    .replace(/\bDr\./gi, 'Doctor')
    .replace(/\bASP\.NET\b/gi, 'ASP dot NET')
    .replace(/\b(Node|React|Express|Next|Vue)\.js\b/gi, '$1 JS')
    .replace(/\bC#/g, 'C Sharp');

  const isHindiOrHinglish = detectHindiOrHinglish(text);

  if (isHindiOrHinglish) {
    text = text
      .replace(/\bAIML\b/g, 'ए आई एम एल')
      .replace(/\bAI\s*&\s*ML\b/gi, 'ए आई एंड एम एल')
      .replace(/\bSagar\b/g, 'सागर')
      .replace(/(\d+(?:\.\d+)?)\s*°\s*C\b/gi, (_, num) => `${numberToHindiWords(num)} डिग्री सेल्सियस`)
      .replace(/(\d+(?:\.\d+)?)\s*°\s*F\b/gi, (_, num) => `${numberToHindiWords(num)} डिग्री फ़ारेनहाइट`)
      .replace(/₹\s*(\d[\d,.]*)/g, (_, num) => `${numberToHindiWords(num)} रुपये`)
      .replace(/(\d[\d,.]*)\s*%/g, (_, num) => `${numberToHindiWords(num)} प्रतिशत`)
      .replace(/\s*×\s*/g, ' गुणा ')
      .replace(/\s*=\s*/g, ' बराबर ')
      .replace(/(?<![A-Za-z0-9._-])(\d+(?:,\d+)*(?:\.\d+)?)(?![A-Za-z0-9._-])/g, (_, num) =>
        numberToHindiWords(num)
      );
  } else {
    text = text
      .replace(/\bAIML\b/g, 'A I M L')
      .replace(/(\d+(?:\.\d+)?)\s*°\s*C\b/gi, '$1 degrees Celsius')
      .replace(/(\d+(?:\.\d+)?)\s*°\s*F\b/gi, '$1 degrees Fahrenheit')
      .replace(/₹\s*(\d[\d,.]*)/g, '$1 rupees')
      .replace(/(\d[\d,.]*)\s*%/g, '$1 percent')
      .replace(/\s*×\s*/g, ' times ')
      .replace(/\s*=\s*/g, ' equals ');
  }

  return text
    .replace(/!{2,}/g, '!')
    .replace(/[—–]/g, ', ')
    .replace(/^-{3,}$/gm, ' ')
    .replace(/#{1,6}\s+/g, ' ')
    .replace(/:\s*\n+/g, ', ')
    .replace(/\n+\s*[•\-*]\s*/g, ', ')
    .replace(/\n+/g, '. ')
    .replace(/[*_`~>•|$\\{}]/g, ' ')
    .replace(/([।.!?])\s*[.,]+/g, '$1 ')
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 750);
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
  const timeoutId = setTimeout(() => controller.abort(), 8500);

  try {
    const res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        model: 's2.1-pro-free'
      },
      body: JSON.stringify({
        text,
        reference_id: voiceId,
        format: 'mp3',
        mp3_bitrate: 192,
        chunk_length: 200,
        normalize: true,
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

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return { ok: false, audio: null, debug: `http_${res.status}:${errBody.slice(0, 140)}` };
    }
    const audioBuffer = await res.arrayBuffer();
    if (!audioBuffer || audioBuffer.byteLength < 200) {
      return { ok: false, audio: null, debug: 'empty_audio_buffer' };
    }
    return { ok: true, audio: audioBuffer, debug: 'ok' };
  } catch (err) {
    clearTimeout(timeoutId);
    return { ok: false, audio: null, debug: `exception:${err?.name || 'error'}` };
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

  const limitedChunks = chunks.slice(0, 5);
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

  const fishApiKey = String(process.env.FISH_API_KEY || '').trim();
  const voiceMap = getFishVoiceModelMap();

  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('debug') === '1') {
      const configuredVoices = Object.fromEntries(
        Object.entries(voiceMap).map(([k, v]) => [k, Boolean(v)])
      );
      return jsonResponse(200, {
        hasFishApiKey: Boolean(fishApiKey),
        configuredVoices: { ...configuredVoices, female: true },
        model: 's2.1-pro-free'
      });
    }
    return jsonResponse(200, { ok: true });
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

  const requestedVoice = String(body.voice || 'vikash').trim().toLowerCase();
  const tone = analyzeConversationalTone(spokenText);

  // 👉 अगर यूज़र ने 'female' (Ananya — Indian Female) चुना है, तो बिना किसी बदलाव के सीधे वही ओरिजिनल आवाज़ चलाएँ
  if (requestedVoice === 'female') {
    const hindiAudio = await synthesizeHindiNeuralStream(spokenText);
    if (hindiAudio) {
      return new Response(hindiAudio, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'X-Voice-Source': 'hindi-neural-fallback',
          'X-Selected-Voice': 'female',
          'X-Voice-Mood': tone.mood,
          'X-Playback-Rate': String(tone.playbackRate),
          'X-Fish-Debug': 'direct_female_selected',
          'Cache-Control': 'public, max-age=86400',
          ...CORS_HEADERS
        }
      });
    }
    return jsonResponse(200, { fallback: true, reason: 'female_tts_unavailable' });
  }

  // 👉 Fish Audio Custom / Celebrity Voice (Vikash, Naman, Modi, Trump, Amitabh)
  const targetModelId = voiceMap[requestedVoice] || '';
  let fishDebug = !fishApiKey
    ? 'missing_fish_api_key'
    : !targetModelId
    ? `voice_id_not_set_for_${requestedVoice}`
    : 'ok';

  if (fishApiKey && targetModelId) {
    const fishRes = await synthesizeFishCustomVoice(spokenText, tone, fishApiKey, targetModelId);
    fishDebug = fishRes.debug;
    if (fishRes.ok && fishRes.audio) {
      return new Response(fishRes.audio, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'X-Voice-Source': 'fish-audio-custom',
          'X-Selected-Voice': requestedVoice,
          'X-Voice-Mood': tone.mood,
          'X-Playback-Rate': '1.0',
          'X-Fish-Debug': 'ok',
          'Cache-Control': 'public, max-age=86400',
          ...CORS_HEADERS
        }
      });
    }
  }

  // 👉 Safe Fallback: अगर उस आवाज़ की Model ID अभी सेट नहीं है या कोटा खत्म है, तो ओरिजिनल इंडियन फीमेल वॉइस चलेगी
  const hindiAudio = await synthesizeHindiNeuralStream(spokenText);
  if (hindiAudio) {
    return new Response(hindiAudio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'X-Voice-Source': 'hindi-neural-fallback',
        'X-Selected-Voice': requestedVoice,
        'X-Voice-Mood': tone.mood,
        'X-Playback-Rate': String(tone.playbackRate),
        'X-Fish-Debug': fishDebug.replace(/[\r\n]+/g, ' ').slice(0, 120),
        'Cache-Control': 'public, max-age=86400',
        ...CORS_HEADERS
      }
    });
  }

  return jsonResponse(200, { fallback: true, reason: 'tts_unavailable', fishDebug });
};