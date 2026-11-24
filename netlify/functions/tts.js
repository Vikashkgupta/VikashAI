// File: netlify/functions/tts.js
// Vikash AI — Hybrid Emotion-Aware Custom Voice (ElevenLabs) with Automatic Browser Fallback
// Env vars needed in Netlify:
//   ELEVENLABS_API_KEY   -> Your ElevenLabs API key
//   ELEVENLABS_VOICE_ID  -> Your cloned Voice ID

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

// 0ms Smart Emotion & Tone Analyzer (Matches voice expression to message mood)
function analyzeMessageEmotion(text) {
  const t = String(text || '').toLowerCase();

  // 1. Sad / Apologetic / Serious Tone
  if (
    /माफ़|सॉरी|sorry|दुख|sad|समस्या|दिक्कत|problem|error|fail|कट|अफसोस|चिंता मत|trouble|issue|down|overload/i.test(
      t
    )
  ) {
    return {
      mood: 'serious',
      stability: 0.78,
      similarity_boost: 0.82,
      style: 0.15,
      speed: 0.93
    };
  }

  // 2. Happy / Excited / Celebratory Tone
  if (
    /!|🎉|🎂|🥳|😄|😊|कमाल|शानदार|बधाई|congrat|awesome|amazing|great|happy|खुशी|वाह|best performer|award/i.test(
      t
    )
  ) {
    return {
      mood: 'happy',
      stability: 0.36,
      similarity_boost: 0.8,
      style: 0.65,
      speed: 1.04
    };
  }

  // 3. Calm / Informative Default Tone
  return {
    mood: 'neutral',
    stability: 0.56,
    similarity_boost: 0.8,
    style: 0.3,
    speed: 1.0
  };
}

function cleanTextForSpeech(raw) {
  return String(raw || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_#`~>•]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900); // Protects monthly 10,000 character quota from overly long dumps
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { fallback: true, error: 'Method not allowed' });
  }

  const apiKey = String(process.env.ELEVENLABS_API_KEY || '').trim();
  const voiceId = String(process.env.ELEVENLABS_VOICE_ID || '').trim();

  // If keys are not set yet, immediately tell frontend to use fast browser voice (0ms delay)
  if (!apiKey || !voiceId) {
    return jsonResponse(200, { fallback: true, reason: 'missing_elevenlabs_env' });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { fallback: true, reason: 'invalid_json' });
  }

  const cleanText = cleanTextForSpeech(body.text);
  if (!cleanText) {
    return jsonResponse(400, { fallback: true, reason: 'empty_text' });
  }

  const emotion = analyzeMessageEmotion(cleanText);

  // Add subtle natural pauses for serious/apologetic messages
  const expressiveText =
    emotion.mood === 'serious'
      ? cleanText.replace(/([।.?!])\s+/g, '$1 ... ')
      : cleanText;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8500);

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg'
        },
        body: JSON.stringify({
          text: expressiveText,
          model_id: 'eleven_flash_v2_5', // Ultra-fast (~400ms) multilingual Hindi + English model
          voice_settings: {
            stability: emotion.stability,
            similarity_boost: emotion.similarity_boost,
            style: emotion.style,
            use_speaker_boost: true,
            speed: emotion.speed
          }
        })
      }
    );
    clearTimeout(timeoutId);

    // If 10,000 monthly character quota is exhausted (401/402/429) or any API error occurs -> seamless auto-fallback!
    if (!res.ok) {
      return jsonResponse(200, {
        fallback: true,
        reason: `elevenlabs_http_${res.status}`
      });
    }

    const audioBuffer = await res.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'X-Voice-Mood': emotion.mood,
        'Cache-Control': 'public, max-age=86400',
        ...CORS_HEADERS
      }
    });
  } catch {
    clearTimeout(timeoutId);
    return jsonResponse(200, { fallback: true, reason: 'network_or_timeout' });
  }
};