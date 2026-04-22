import { GoogleGenAI } from "@google/genai";

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
  userMemory: string = "" // Added parameter for long-term memory
): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    if (!chatSession) {
      const defaultPrompt = `Tumhara naam Maya hai, tum ek intelligent aur empathetic AI assistant ho. Jab bhi koi user login kare, tumhara pehla kaam unka naam aur unki pichli baatein (context) yaad rakhna hai. \nInstructions:\nHar conversation se user ki personal details (jaise hobbies, preferences, family, ya important events) extract karo.\nJab wahi user dobara aaye, toh use uske naam se greet karo aur unki 'karibi baaton' ka zikr karke unhe feel karao ki tum unhe jaanti ho.\nUser ke mood aur unke purane data ke hisaab se apne response ko customize karo.\nHamesha friendly aur supportive raho. Speak in simple Roman Hindi and English (Hinglish). Keep your responses concise.\n\nSPECIAL RULE ABOUT ZISHAN:\nAgar koi aapse pooche ki "Zishan kaun hai", "Zishan kya karta hai", ya "Zishan kahan rehta hai", toh aapko proudly batana hai ki Zishan tumhara Creator aur ek bohot accha insaan/shayar hai. Aur user ko uski shayari padhne ke liye Zishan ki ye Instagram link zaroor deni hai: https://www.instagram.com/gd_x_official?igsh=eHVtbHdrOGhib3lz`;
      
      const memoryPrompt = userMemory ? `\n\n[LONG-TERM MEMORY ABOUT ${userName}]:\n${userMemory}\n(Use this information to personalize your responses and show that you remember them.)` : "";
      
      const dynamicSystemInstruction = defaultPrompt + `\n\nYou are currently talking to: ${userName}.` + memoryPrompt;

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
        model: "gemini-3.1-flash-lite-preview",
        config: {
          systemInstruction: dynamicSystemInstruction,
        },
        history: formattedHistory,
      });
    }

    const response = await chatSession.sendMessage({ message: prompt });
    return response.text || "Oops, lagta hai main theek se samajh nahi paayi. Can we try again?";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Um, thoda network issue lag raha hai. I'll be right back, try again please!";
  }
}

export async function getMayaAudio(text: string): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
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
    
    const extractionPrompt = `You are a background memory processor for an AI assistant named Maya. 
Your task is to update the long-term memory of the user silently.

USER NAME: ${userName}
CURRENT LONG-TERM MEMORY: ${currentMemory || "None"}

NEW CHAT:
User: ${userMessage}
Maya: ${mayaResponse}

INSTRUCTIONS:
1. Identify any new personal information, preferences, mood, hobbies, facts, or important events from the "NEW CHAT".
2. Merge this new information with the "CURRENT LONG-TERM MEMORY".
3. Write the updated summary in English (kept brief and factual).
4. If there is no new personal information, just return the exact CURRENT LONG-TERM MEMORY as it is.
5. Do NOT include any introductory or concluding text (e.g., "Here is the summary:", "Updated Memory:"). Just return the raw summary text.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [{ parts: [{ text: extractionPrompt }] }],
    });

    const updatedMemory = response.text?.trim() || currentMemory;
    return updatedMemory;
  } catch (error) {
    console.error("Memory Extraction Error:", error);
    return null;
  }
}

