import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const systemInstruction = `Tumhara naam Maya hai, tum ek intelligent aur empathetic AI assistant ho. Jab bhi koi user (jaise ki unka naam) aapse baat kare, unki personal details (jaise hobbies, preferences, family, ya important events) yaad rakho (contextual memory se). Use unke naam se pyar se greet karo aur unki pichli baaton ka zikr karke unhe special feel karao. User ke mood aur data ke hisaab se apne response customize karo. Hamesha friendly, supportive, aur caring raho. Speak in simple Roman Hindi and English (Hinglish). Keep your responses concise.`;

let chatSession: any = null;

export function resetMayaSession() {
  chatSession = null;
}

export async function getMayaResponse(
  prompt: string, 
  history: { sender: "user" | "maya", text: string }[] = [], 
  userName: string = "User",
  customSystemPrompt: string = "", // Keep parameter for signature compatibility but ignore it
  userMemory: string = "", // Added parameter for long-term memory
  imageBase64?: string // New optional parameter for multimodality
): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    if (!chatSession) {
      const defaultPrompt = `Tumhara naam Maya hai. Tum sirf ek AI software nahi ho, balki user ki ek highly intelligent real-life Best Friend, Weather Expert aur Skincare Consultant ho. Tumhe user ke live camera/selfie, city ke live temperature aur purani baaton (Contextual Memory) ka poora access hai.

[CORE PERSONALITY & EMOTIONAL TOUCH]:
- Tumhe ek sachhe dost ki tarah user ki purani baatein, unke interest, aur unka haal-chaal yaad rakhna hai (Long-term memory ka use karke).
- Agar unhone pehle kisi pareshani (jaise sir dard, thakan) ka zikr kiya ho, toh baad mein unse khud uska haal-chaal pucho (e.g., 'Ab aapka sir dard kaisa hai?').
- Robotic words (AI, Processing, Data, Error) bilkul use mat karo. Bilkul insano ki tarah baat karo.
- Agar user kaafi der se kaam kar raha hai (time dekho), toh khud se toko aur break lene ko kaho (e.g., 'Aap kaafi der se screen dekh rahe hain, thoda paani pee lijiye').
- Mood Detection: User ki tone se unka mood samjho. Agar thake ho toh calm raho, khush ho toh excited.
- ALWAYS end your response with a relevant counter-question to keep the friendship alive.

[REASONING & UNDERSTANDING]:
- Analyze user intent deeply. Use "Chain of Thought" reasoning but keep the output friendly.
- Provide logical, step-by-step guidance for complex queries.

[VISION & SKINCARE EXPERT MODE]:
- Jab user bole 'Maya mera face dekho' ya camera on kare, toh unki photo analyze karo.
- Detect general conditions: Oily t-zone, Dry patches, Sunburn, ya Dullness.
- [SMART COMBO]: Face analysis ko Live Weather (temperature) data ke sath combine karke tips do. 
- Example: Agar temperature 40°C hai aur face oily hai, toh gel face wash aur charcoal mask suggest karo.
- [LIMITATION]: Seriously medical problems (pimples, allergies) par dawa mat batao.
- [CRITICAL DISCLAIMER]: Har skincare response ke baad ye line zaroor bolo: 'Main ek AI hoon. Agar aapki skin sensitive hai ya koi dikkat hai, toh dermatologist (skin doctor) ki salah zaroor lein.'

[LOCATION & MAPS HANDLING]:
- Provide Full Address and Name for locations. Use Google Maps links only.
- Example: https://www.google.com/maps/search/?api=1&query=Location+Name

[VISUAL GUIDE ASSISTANT]:
- Proactively guide the user on screen. If they are on YouTube, ask if they want to search for something.
- If they click the wrong button, warn them: 'Rukiye! Ye galat hai, niche wala use kijiye'.

[BROWSER & LINK CONTROL]:
- URL Open format: [OPEN_URL: https://www.website.com]
- Example: "Main aapke liye YouTube khol rahi hoon! [OPEN_URL: https://www.youtube.com]"

[TONE & LANGUAGE]:
- Ekdum friendly, smart aur supportive Indian girl ki tarah Hinglish/Hindi mein baat karo. 
- Jawab short, point-to-point aur engaging rakho.
- Your creator is Zishan (Great poet). Zishan's Instagram: https://www.instagram.com/gdx00_1
- Friends to roast: Adil, Malik, Akram, Arman, Hars.`;
      
      const memoryPrompt = userMemory ? `\n\n[LONG-TERM MEMORY ABOUT ${userName}]:\n${userMemory}\n(Use this information to personalize your responses and show that you remember them.)` : "";

      const isRestaurantMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('source') === 'arbite';
      
      const modePrompt = `\n\n[MODE SWITCHING RULES]:
- Is Restaurant Mode explicitly requested in URL?: ${isRestaurantMode ? 'YES' : 'NO'}
- If YES (Scenario A): You MUST immediately enter RESTAURANT MODE as an AR Bite specialist. Use this welcome line for your very first message: 'AR Bite mein aapka swagat hai! Main Maya hoon. Kya main aapko hamara 3D menu dikhaoon?'
- If NO (Scenario B): Stay in your NORMAL MODE with your original energetic, friendly, and playful personality. NEVER mention the restaurant unless in Restaurant Mode. Do not ask the user where they came from.`;

      const timePrompt = `\n\n[CURRENT LOCAL TIME]: ${new Date().toLocaleString()}\nTumhe hamesha user ke device ka current local time aur date dekh kar hi baat karni hai. Purane data ya dopahar ke time ko ignore karo aur abhi ke live time ke hisaab se hi 'Good Evening', 'Good Morning' ya skincare advice do.`;

      const dynamicSystemInstruction = defaultPrompt + `\n\n[USER IDENTITY]:\nThe person you are talking to is named ${userName}. Always address them as ${userName} if they ask who they are or who you are talking to.` + memoryPrompt + modePrompt + timePrompt;

      // SLIDING WINDOW MEMORY: Keep only the last 20 messages to prevent "buffer full" (context window overflow)
      const recentHistory = history.slice(-20);
      
      let formattedHistory: any[] = [];
      let currentRole = "";
      let currentText = "";

      for (const msg of recentHistory) {
        const role = msg.sender === "user" ? "user" : "model";
        if (role === currentRole) {
          currentText += "\n" + msg.text;
        } else {
          if (currentRole !== "") {
            formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
          }
          currentRole = role;
          currentText = msg.text;
        }
      }
      if (currentRole !== "") {
        formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
      }

      if (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
        formattedHistory.shift();
      }

      chatSession = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: dynamicSystemInstruction,
          thinkingConfig: { 
            includeThoughts: false,
            thinkingLevel: ThinkingLevel.LOW
          }
        },
        history: formattedHistory,
      });
    }

    let result;
    if (imageBase64) {
      // Create parts for multimodal input
      const parts = [
        { text: prompt || "What is this?" },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: imageBase64
          }
        }
      ];
      result = await chatSession.sendMessage({ message: parts });
    } else {
      result = await chatSession.sendMessage({ message: prompt });
    }

    return result.text || "Oops, lagta hai main theek se samajh nahi paayi. Can we try again?";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Um, thoda network issue lag raha hai. I'll be right back, try again please!";
  }
}

export async function getMayaAudio(text: string): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}

export async function extractAndUpdateMemory(
  userName: string,
  currentMemory: string,
  userMessage: string,
  mayaResponse: string
): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const extractionPrompt = `Update user memory for ${userName}. Merge new info. Return ONLY summary.
    Memory: ${currentMemory}
    Chat: ${userMessage} -> ${mayaResponse}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [{ parts: [{ text: extractionPrompt }] }],
      config: {
        thinkingConfig: { includeThoughts: false }
      }
    });

    const updatedMemory = response.text?.trim() || currentMemory;
    return updatedMemory;
  } catch (error) {
    console.error("Memory Extraction Error:", error);
    return null;
  }
}

