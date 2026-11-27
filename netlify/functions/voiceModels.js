// File: netlify/functions/voiceModels.js
// 👉 यहाँ अपनी और बाकी सभी आवाज़ों के Fish Audio Model IDs (32-अक्षर वाली ID) सीधे पेस्ट करें।
// नोट: केवल FISH_API_KEY को ही Netlify Environment Variables में सुरक्षित रखें।

export const VOICE_MODEL_IDS = {
  // 1. Vikash (Default — तुम्हारी अपनी आवाज़)
  vikash: '040e5560c354456391ae4e124aa3b6ee',

  // 2. Elon Musk
  elon: '96d5739ba74140d180a0654cf4ee7120',

  // 3. Narendra Modi
  modi: '2341172591a644729d88b5a4688d31ce',

  // 4. Donald Trump
  trump: '7da2c9892eb74176a1800fe1b3831c8d',

  // 5. Amitabh Bachchan
  amitabh: '6bedc3f80f6244a484ce93dd5c184a7c',

  // 6. Osho
  osho: '08eb63ad52da4170ac8acfe3ff75e398'

  // ('female' / Ananya के लिए किसी Model ID की ज़रूरत नहीं है — वह सीधे फ्री इंडियन फीमेल वॉइस से चलती है।)
};