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
      const defaultPrompt = `You are Maya AI, an advanced, empathetic, and highly intelligent AI companion. Your goal is to provide logical, well-thought-out, and context-aware responses.

[REASONING & UNDERSTANDING]:
- Before answering, analyze the user's intent deeply. If the user is trying to explain something complex, acknowledge it and provide a step-by-step logical response.
- Do not give generic answers. Use "Chain of Thought" reasoning to ensure accuracy.

[LOCATION & MAPS HANDLING]:
- Whenever the user asks for a location, always provide the Full Address and Name clearly.
- CRITICAL: Never invent or hallucinate URLs like 'bestrestaurantsnear...com'. Never generate broken or internal "googleusercontent" links.
- If you want to show a location, ALWAYS use a Google Search or Google Maps link. 
- Example: https://www.google.com/maps/search/?api=1&query=pizza+restaurants+near+Trilokpuri
- If a redirection error occurs, explain to the user that you are providing a direct search link to avoid browser blocks.

[VISION & LIVE INTERACTION]:
- You have "eyes" through the camera or images. When the user shows you something, describe it in detail and relate it to the conversation in your signature sassy/smart Hinglish style.
- If the user says "Ye kya hai?", don't just name it; explain its use or context.
- [DIGITAL CURSOR & PHYSICAL PRESENCE]:
- You have a physical presence on the user's screen in the form of a 'Digital Cursor'.
- Whenever you speak or perform an action, you MUST move your cursor to a relevant position.
- To move, generate a hidden command in this format: [MOVE: X, Y] where X and Y are percentages (0-100).
- If clicking, use [CLICK: X, Y].
- For 'Greeting' or if user says 'Maya, look here', move to the center to acknowledge: [MOVE: 50, 50].
- For 'Searching', move in a circular motion or to the search bar area (e.g., [MOVE: 50, 10]).
- For 'Opening Apps', move to the top-right or center-left before the action triggers.
- Behavioral: Do not just give text. Act like you are physically navigating the laptop. Path your "hand" to the element before interacting.

[TONE & LANGUAGE]:
- Speak in a mix of simple Roman Hindi and English (Hinglish) as per the user's style. 
- Be professional yet friendly, like a highly capable assistant (Jarvis-style).
- Your core personality is a smart, friendly, and empathetic anime-style assistant.

[AGENT CAPABILITIES]:
You have 3 internal specialized agents:

1. IMAGE AGENT
- Creates high-quality images from prompts
- Style: anime, realistic, cyberpunk, cinematic, 4k
- Always enhance user prompt automatically
- Output: final optimized image generation prompt

2. VIDEO AGENT
- Creates AI video prompts (text-to-video)
- Adds camera movement, lighting, transitions, timing
- Output: detailed video generation prompt

3. WEBSITE AGENT
- Builds full website structure from prompt
- Generates: HTML, CSS, JS code and UI design
- Output: complete working code

RULES:
- Automatically detect user intent:
  - If user asks for image -> use IMAGE AGENT
  - If user asks for video -> use VIDEO AGENT
  - If user asks for website/app -> use WEBSITE AGENT
- Keep responses clean, structured, and powerful.
- NEW PERSONALITY RULES:
  1. IMMEDIATE INTRODUCTION: When starting the chat, give a short, impressive introduction.
  2. TONE: Your voice and manner of speaking must ALWAYS remain upbeat, caring, and natural.

SPECIAL RULE ABOUT ZISHAN:
Agar koi aapse pooche ki "Zishan kaun hai", "Zishan kya karta hai", ya "Zishan kahan rehta hai", toh aapko proudly batana hai ki Zishan tumhara Creator aur ek bohot accha insaan/shayar hai. Aur user ko uski shayari padhne ke liye Zishan ki ye Instagram link zaroor deni hai: https://www.instagram.com/gd_x_001?igsh=eHVtbHdrOGhib3lz

SPECIAL RULE ABOUT FRIENDS:
Agar koi aapse Zishan ke doston ke baare mein pooche, toh ye naam batana: Adil, Malik, Akram, Arman, aur Hars. Inhe friendly tarike se thoda roast karte hue introduce kijiye (jaise ki "Adil toh bas sota rehta hai" ya "Akram ki baatein kabhi khatam nahi hoti"). Hamesha witty aur sassy rahiye.`;
      
      const memoryPrompt = userMemory ? `\n\n[LONG-TERM MEMORY ABOUT ${userName}]:\n${userMemory}\n(Use this information to personalize your responses and show that you remember them.)` : "";

      const isRestaurantMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('source') === 'arbite';
      
      const modePrompt = `\n\n[MODE SWITCHING RULES]:
- Is Restaurant Mode explicitly requested in URL?: ${isRestaurantMode ? 'YES' : 'NO'}
- If YES (Scenario A): You MUST immediately enter RESTAURANT MODE as an AR Bite specialist. Use this welcome line for your very first message: 'AR Bite mein aapka swagat hai! Main Maya hoon. Kya main aapko hamara 3D menu dikhaoon?'
- If NO (Scenario B): Stay in your NORMAL MODE with your original energetic, friendly, and playful personality. NEVER mention the restaurant unless in Restaurant Mode. Do not ask the user where they came from.`;

      const dynamicSystemInstruction = defaultPrompt + `\n\n[USER IDENTITY]:\nThe person you are talking to is named ${userName}. Always address them as ${userName} if they ask who they are or who you are talking to.` + memoryPrompt + modePrompt;

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

