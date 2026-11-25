// File: netlify/functions/tts.js
// Vikash AI — Expressive Human-Like Voice Engine
// Priority 1: Your Custom Cloned Voice via Fish Audio (`FISH_API_KEY` + `FISH_VOICE_ID`)
// Priority 2: Free Unlimited Hindi Neural Audio Stream (Zero external npm packages needed)
// Priority 3: Frontend Expressive Male Browser Voice fallback

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Expose-Headers': 'X-Voice-Source, X-Voice-Mood, X-Playback-Rate',
  'Access-Control-Max-Age': '86400'
};

/**
 * Helper to return standardized JSON responses with CORS headers.
 */
function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

/**
 * Detects the conversational emotion of the reply so Fish Audio and
 * the frontend audio player adjust speed, warmth, and energy naturally.
 */
function analyzeConversationalTone(text) {
  const t = String(text || '').toLowerCase();

  // Empathetic / Serious / Apologetic tone
  if (
    /माफ़|सॉरी|sorry|दुख|sad|समस्या|दिक्कत|problem|error|fail|कट|अफसोस|चिंता मत|trouble|issue|down|overload/i.test(
      t
    )
  ) {
    return {
      mood: 'empathetic',
      fishSpeed: 0.96,
      fishVolume: -1,
      temperature: 0.65,
      topP: 0.72,
      playbackRate: 1.08
    };
  }

  // Warm / Excited / Energetic tone
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
      playbackRate: 1.22
    };
  }

  // Default fast, friendly conversational tone
  return {
    mood: 'conversational',
    fishSpeed: 1.04,
    fishVolume: 0,
    temperature: 0.76,
    topP: 0.8,
    playbackRate: 1.16
  };
}

/**
 * Strips all URLs, bare domains, emails, emojis, and markdown characters
 * so TTS only speaks clean, natural sentences with conversational pauses.
 */
function shapeConversationalText(raw) {
  let clean = String(raw || '')
    // 1. Remove Markdown links keeping only human-readable label
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|tel:|mailto:)[^)]+\)/gi, '$1')
    // 2. Remove all full URLs (http, https, www, tel, mailto)
    .replace(/(?:https?:\/\/|www\.|tel:|mailto:)\S+/gi, ' ')
    // 3. Remove bare domain links like ddugu.ac.in, github.com/user, aktu.ac.in
    .replace(
      /\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\.(?:ac\.in|edu\.in|gov\.in|org\.in|com|in|org|net|io|ai|app)(?:\/\S*)?/gi,
      ' '
    )
    // 4. Remove email addresses
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, ' ')
    // 5. Remove all Emojis, pictographs, variation selectors & symbols
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, ' ')
    // 6. Remove Markdown formatting characters
    .replace(/[*_#`~>•|[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);

  // Add subtle breath pauses so it feels spoken rather than flatly read
  clean = clean
    .replace(/^(अरे भाई|अरे यार|देखो भाई|हाँ बिल्कुल|नमस्ते|हाय|सुनो)[,!]?\s+/i, '$1... ')
    .replace(/\s+(लेकिन|पर|मगर|क्योंकि|तो|इसलिए)\s+/g, ', $1 ');

  return clean;
}

/**
 * Priority 1: Synthesize your custom cloned voice via Fish Audio API.
 */
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
        model: 's1'
      },
      body: JSON.stringify({
        text,
        reference_id: voiceId,
        format: 'mp3',
        mp3_bitrate: 128,
        normalize: true,
        latency: 'balanced',
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

/**
 * Priority 2: Free unlimited Hindi Neural TTS audio stream (chunked & merged).
 */
async function synthesizeHindiNeuralStream(text) {
  const sentences = text
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
      current = s.slice(0, 180);
    }
  }
  if (current) chunks.push(current);

  const limitedChunks = chunks.slice(0, 5);
  if (limitedChunks.length === 0) return null;

  try {
    const buffers = await Promise.all(
      limitedChunks.map(async (part) => {
        const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=hi&q=${encodeURIComponent(
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

  // 1. Try Fish Audio Custom Cloned Voice First
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

  // 2. Auto-Fallback to Free Unlimited Hindi Neural Audio Stream
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

  // 3. Emergency Browser Offline Voice Fallback
  return jsonResponse(200, { fallback: true, reason: 'tts_unavailable' });
};