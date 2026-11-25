// File: netlify/functions/tts.js
// Vikash AI — Expressive Human-Like Voice Engine
// Priority 1: Your Custom Cloned Voice via Fish Audio (`FISH_API_KEY` + `FISH_VOICE_ID`)
// Priority 2: Free Unlimited Neural AI Voice (`hi-IN-MadhurNeural` via `ws` WebSocket)
// Priority 3: Frontend Browser Voice fallback

import crypto from 'node:crypto';
import WebSocket from 'ws';

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

// Conversational Prosody & Emotion Analyzer
function analyzeConversationalTone(text) {
  const t = String(text || '').toLowerCase();

  // 1. Empathetic / Apologetic / Serious
  if (
    /माफ़|सॉरी|sorry|दुख|sad|समस्या|दिक्कत|problem|error|fail|कट|अफसोस|चिंता मत|trouble|issue|down|overload/i.test(
      t
    )
  ) {
    return {
      mood: 'empathetic',
      fishSpeed: 0.94,
      fishVolume: -1,
      temperature: 0.65,
      topP: 0.72,
      edgeRate: '-6%',
      edgePitch: '-3Hz'
    };
  }

  // 2. Excited / Warm / Celebratory
  if (
    /!|🎉|🎂|🥳|😄|😊|कमाल|शानदार|बधाई|congrat|awesome|amazing|great|happy|खुशी|वाह|best performer|award|भाई|यार/i.test(
      t
    )
  ) {
    return {
      mood: 'warm_excited',
      fishSpeed: 1.04,
      fishVolume: 1,
      temperature: 0.85,
      topP: 0.85,
      edgeRate: '+4%',
      edgePitch: '+3Hz'
    };
  }

  // 3. Natural Friendly Conversation (Default)
  return {
    mood: 'conversational',
    fishSpeed: 1.0,
    fishVolume: 0,
    temperature: 0.75,
    topP: 0.78,
    edgeRate: '+0%',
    edgePitch: '+0Hz'
  };
}

function shapeConversationalText(raw) {
  let clean = String(raw || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_#`~>•]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);

  // Add natural conversational pauses so it sounds spoken, not read
  clean = clean
    .replace(/^(अरे भाई|अरे यार|देखो भाई|हाँ बिल्कुल|नमस्ते|हाय|सुनो)[,!]?\s+/i, '$1... ')
    .replace(/\s+(लेकिन|पर|मगर|क्योंकि|तो|इसलिए)\s+/g, ', $1 ');

  return clean;
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Priority 1: Fish Audio Custom Cloned Voice
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

// Priority 2: Free Unlimited Neural AI Voice (Microsoft Edge Neural TTS via `ws` WebSocket)
async function synthesizeEdgeNeuralVoice(text, tone) {
  const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
  const CHROMIUM_FULL_VERSION = '130.0.2849.68';
  const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;

  const WIN_EPOCH_OFFSET = 11644473600n;
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  let ticks = (nowSec + WIN_EPOCH_OFFSET) * 10000000n;
  ticks -= ticks % 3000000000n;
  const secMsGec = crypto
    .createHash('sha256')
    .update(`${ticks}${TRUSTED_CLIENT_TOKEN}`)
    .digest('hex')
    .toUpperCase();

  const reqId = crypto.randomUUID().replace(/-/g, '');
  const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${reqId}`;

  return new Promise((resolve, reject) => {
    const audioChunks = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          ws.close();
        } catch {}
        reject(new Error('Edge Neural TTS timeout'));
      }
    }, 7500);

    const ws = new WebSocket(wsUrl, {
      headers: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'
      }
    });

    ws.on('open', () => {
      const configMsg =
        `X-Timestamp:${new Date().toISOString()}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: {
                  sentenceBoundaryEnabled: 'false',
                  wordBoundaryEnabled: 'false'
                },
                outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
              }
            }
          }
        });
      ws.send(configMsg);

      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='hi-IN'><voice name='hi-IN-MadhurNeural'><prosody rate='${tone.edgeRate}' pitch='${tone.edgePitch}'>${escapeXml(text)}</prosody></voice></speak>`;

      const ssmlMsg =
        `X-RequestId:${reqId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${new Date().toISOString()}\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml;
      ws.send(ssmlMsg);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (buf.length > 2) {
          const headerLen = buf.readUInt16BE(0);
          const audioData = buf.subarray(2 + headerLen);
          if (audioData.length > 0) {
            audioChunks.push(audioData);
          }
        }
      } else {
        const str = data.toString('utf8');
        if (str.includes('Path:turn.end')) {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            try {
              ws.close();
            } catch {}
            if (audioChunks.length > 0) {
              resolve(Buffer.concat(audioChunks));
            } else {
              reject(new Error('Empty Edge Neural audio'));
            }
          }
        }
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    ws.on('close', () => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        if (audioChunks.length > 0) resolve(Buffer.concat(audioChunks));
        else reject(new Error('Socket closed before audio'));
      }
    });
  });
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
          'Cache-Control': 'public, max-age=86400',
          ...CORS_HEADERS
        }
      });
    }
  }

  // 2. Auto-Fallback to Free Unlimited WebSocket (`ws`) Neural AI Voice (`hi-IN-MadhurNeural`)
  try {
    const neuralMp3 = await synthesizeEdgeNeuralVoice(spokenText, tone);
    if (neuralMp3 && neuralMp3.length > 0) {
      return new Response(neuralMp3, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'X-Voice-Source': 'ws-neural-madhur',
          'X-Voice-Mood': tone.mood,
          'Cache-Control': 'public, max-age=86400',
          ...CORS_HEADERS
        }
      });
    }
  } catch {}

  // 3. Emergency Browser Offline Voice Fallback
  return jsonResponse(200, { fallback: true, reason: 'all_neural_tts_unavailable' });
};