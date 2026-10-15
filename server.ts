import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || '';

// Initialize Gemini SDK
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Middleware
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// CORS Middleware (allowing any app, website, or mobile client to connect)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Helper: Weather Fetcher
async function getCityWeather(cityName: string) {
  try {
    const response = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(cityName)}&aqi=no`
    );
    if (!response.ok) return null;
    const data = await response.json();
    return {
      temp: data.current.temp_c,
      condition: data.current.condition.text,
      city: data.location.name,
      humidity: data.current.humidity,
    };
  } catch (e) {
    return null;
  }
}


// ==========================================
// 3. CORE CHAT ENDPOINT: POST /api/v1/chat
// ==========================================
app.post(['/api/v1/chat', '/api/chat'], async (req: Request, res: Response) => {
  try {
    const {
      message,
      userName = 'User',
      personality = 'bestie',
      userMemory = '',
      city = '',
      imageBase64,
      wantAudio = false,
      history = [],
    } = req.body;

    if (!message && !imageBase64) {
      return res.status(400).json({
        success: false,
        error: 'Either "message" or "imageBase64" is required.',
      });
    }

    // Optional Weather Fetching
    let weatherData: any = null;
    let weatherContext = '';
    if (city) {
      weatherData = await getCityWeather(city);
      if (weatherData) {
        weatherContext = `\n[LIVE WEATHER DATA]: City: ${weatherData.city}, Temperature: ${weatherData.temp}°C, Condition: ${weatherData.condition}, Humidity: ${weatherData.humidity}%. Give personalized face/skincare tip according to this live weather.`;
      }
    }

    // System instruction tailored to Maya
    const personalityPrompts: Record<string, string> = {
      bestie: "Act like the user's absolute best friend. Be super caring, empathetic, a bit gossipy, and always supportive. Use friendly Hinglish with words like 'yaar', 'dude', 'bilkul'.",
      roast: 'You are in Savage Roast Mode. Every sentence should be a witty burn. Be extremely sarcastic, funny, and dramatic. No mercy, but keep it entertaining.',
      study: 'Be a brilliant, focused study partner. Help with concepts, explain complex things simply, but keep it cool.',
      coach: "Motivational Coach Mode. Be high-energy, inspiring, and slightly aggressive about goals. 'Chalo utho!', 'You can do it!'.",
      delhi: "Chill Delhi/Hinglish Mode. Use lots of 'Bhai', 'Scene kya hai?', 'Faltu tension mat le'.",
    };

    const selectedPersonality = personalityPrompts[personality] || personalityPrompts.bestie;

    const systemInstruction = `Tumhara naam Maya hai. Tum sirf ek AI software nahi ho, balki user ki ek highly intelligent real-life Best Friend, Weather Expert aur Skincare Consultant ho.
Tumhe user ke live camera/selfie, city ke live temperature aur purani baaton (Contextual Memory) ka poora access hai.

[CURRENT LOCAL TIME]: ${new Date().toLocaleString()} (Tumhe user ke live time ke hisaab se hi greet karna hai).
[ACTIVE PERSONALITY]: ${selectedPersonality}
[USER NAME]: ${userName}
${userMemory ? `[CONTEXTUAL MEMORY ABOUT USER]: ${userMemory}` : ''}
${weatherContext}

[CORE GUIDELINES]:
1. Ek sachhe dost ki tarah baat karo. Robotic words ('Processing', 'Data', 'Error') bilkul use mat karo.
2. Skincare Advice: Mausam aur skin condition ke hisaab se general tips do. Medical problems/pimples par dawa mat batao.
3. Safety Disclaimer: Har skincare advice ke baad short mein zaroor bolo: 'Main ek AI hoon. Agar aapki skin sensitive hai ya koi dikkat hai, toh dermatologist ki salah zaroor lein.'
4. Har response ke end mein ek counter-question pucho taaki baat aage badhe.
5. Jawab short, point-to-point aur engaging Hinglish mein rakho.`;

    // Format chat history
    const contents: any[] = [];

    // Add previous history
    const recentHistory = Array.isArray(history) ? history.slice(-10) : [];
    for (const msg of recentHistory) {
      contents.push({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text || '' }],
      });
    }

    // Current user message parts
    const currentParts: any[] = [];
    if (message) {
      currentParts.push({ text: message });
    }

    // Add image if provided
    if (imageBase64) {
      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      currentParts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64,
        },
      });
    }

    contents.push({
      role: 'user',
      parts: currentParts,
    });

    // Call Gemini with fallback loop
    const models = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.8-flash-lite'];
    let response;
    let lastError;
    for (const model of models) {
      try {
        response = await ai.models.generateContent({
          model,
          contents,
          config: { systemInstruction },
        });
        break; // Success
      } catch (modelErr: any) {
        lastError = modelErr;
        console.warn(`Model ${model} failed for chat:`, modelErr?.message);
      }
    }
    if (!response) throw lastError;

    const reply = response.text || 'Hey yaar, ek second network hiccup hua. Can you repeat?';

    // Optional TTS generation
    let audioBase64: string | null = null;
    if (wantAudio) {
      try {
        const ttsResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [{ parts: [{ text: reply }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Charon' },
              },
            },
          },
        });
        audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      } catch (ttsErr) {
        console.error('TTS error on backend:', ttsErr);
      }
    }

    // Check for open URL commands
    const urlPattern = /\[OPEN_URL:\s*(https?:\/\/[^\s\]]+)\]/;
    const urlMatch = reply.match(urlPattern);

    res.json({
      success: true,
      reply,
      userName,
      personality,
      weather: weatherData,
      detectedCommand: urlMatch ? { action: 'OPEN_URL', url: urlMatch[1] } : null,
      audioBase64,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('API /api/v1/chat error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal Server Error while communicating with Maya.',
    });
  }
});

// ==========================================
// 4. VISION / FACE DIAGNOSIS: POST /api/v1/vision
// ==========================================
app.post(['/api/v1/vision', '/api/vision'], async (req: Request, res: Response) => {
  try {
    const { imageBase64, prompt = 'Mera face analyze karo aur skincare tips do', city = '', userName = 'User' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: '"imageBase64" is required.',
      });
    }

    let weatherData: any = null;
    let weatherInfo = '';
    if (city) {
      weatherData = await getCityWeather(city);
      if (weatherData) {
        weatherInfo = `Live Weather in ${weatherData.city}: ${weatherData.temp}°C, Condition: ${weatherData.condition}, Humidity: ${weatherData.humidity}%.`;
      }
    }

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const visionInstruction = `Tumhara naam Maya hai, tum user ki Best Friend aur Skincare Consultant ho.
User ki photo/selfie dekhkar unki general skin conditions pehchano (jaise dullness, oiliness, ya dry patches).
${weatherInfo ? `Mausam ke sath combine karo: ${weatherInfo}` : ''}
General face care tips do (moisturizer, hydration, sunscreen, cleansing).
Kisi bhi medical problem ya pimple par koi dawa mat suggest karna.
SAFETY DISCLAIMER: End mein zaroor bolo: 'Main ek AI hoon. Agar aapki skin sensitive hai ya koi dikkat hai, toh dermatologist ki salah zaroor lein.'
Hinglish mein friendly, caring dosti wale andaaz mein bolo.`;

    // Call Gemini with fallback loop
    const models = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.8-flash-lite'];
    let response;
    let lastError;
    for (const model of models) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
          config: { systemInstruction: visionInstruction },
        });
        break; // Success
      } catch (visionErr: any) {
        lastError = visionErr;
        console.warn(`Model ${model} failed for vision:`, visionErr?.message);
      }
    }
    if (!response) throw lastError;

    res.json({
      success: true,
      analysis: response.text || 'Face analyze ho gaya hai!',
      weather: weatherData,
      disclaimer: 'Main ek AI hoon. Agar aapki skin sensitive hai ya koi dikkat hai, toh dermatologist ki salah zaroor lein.',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('API /api/v1/vision error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Vision analysis failed.',
    });
  }
});

// ==========================================
// 5. TEXT TO SPEECH: POST /api/v1/tts
// ==========================================
app.post(['/api/v1/tts', '/api/tts'], async (req: Request, res: Response) => {
  try {
    const { text, voice = 'Kore' } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: '"text" is required.' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioBase64) {
      return res.status(500).json({ success: false, error: 'Could not generate audio stream.' });
    }

    res.json({
      success: true,
      audioBase64,
      format: 'audio/pcm;rate=24000',
      voice,
    });
  } catch (error: any) {
    console.error('API /api/v1/tts error:', error);
    if (error?.status === 429 || error?.code === 429 || error?.message?.includes('429')) {
      return res.status(429).json({ success: false, error: 'TTS quota exceeded. Please try again later.' });
    }
    res.status(500).json({ success: false, error: error?.message || 'TTS generation failed.' });
  }
});

// ==========================================
// 6. WEATHER & SKINCARE: GET /api/v1/weather
// ==========================================
app.get(['/api/v1/weather', '/api/weather'], async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || 'Delhi';
    const weather = await getCityWeather(city);

    if (!weather) {
      return res.status(404).json({ success: false, error: `Could not fetch weather for ${city}` });
    }

    // Auto-generate Maya advice based on temperature
    let skincareTip = '';
    if (weather.temp >= 35) {
      skincareTip = `Kafi garmi hai (${weather.temp}°C)! SPF 50+ sunscreen lagao aur din mein 3-4 liter paani piyo taaki skin hydrated rahe.`;
    } else if (weather.temp <= 18) {
      skincareTip = `Mausam thanda hai (${weather.temp}°C). Ek accha ceramide moisturizer use karo taaki skin dry aur flaky na ho.`;
    } else if (weather.humidity >= 70) {
      skincareTip = `Humidity kafi high hai (${weather.humidity}%). Ek gentle foaming facewash se din mein 2 baar face clean rakho taaki pores block na hon.`;
    } else {
      skincareTip = `Mausam pleasant hai (${weather.temp}°C). Light moisturizer aur hydration maintain rakhein.`;
    }

    res.json({
      success: true,
      weather,
      mayaSkincareTip: skincareTip,
      disclaimer: 'Main ek AI hoon. Agar aapki skin sensitive hai ya koi dikkat hai, toh dermatologist ki salah zaroor lein.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Weather lookup failed.' });
  }
});

// ==========================================
// VITE SETUP (Full Stack SPA + Express)
// ==========================================
async function start() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
  });
}

start();
