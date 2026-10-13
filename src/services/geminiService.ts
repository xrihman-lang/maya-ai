export function resetMayaSession() {
  // Client session reset helper
}

export async function getMayaResponse(
  prompt: string, 
  history: { sender: "user" | "maya", text: string }[] = [], 
  userName: string = "User",
  customSystemPrompt: string = "", 
  userMemory: string = "", 
  imageBase64?: string 
): Promise<string> {
  try {
    const response = await fetch("/api/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: prompt,
        userName,
        userMemory,
        imageBase64,
        history: history.slice(-20),
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server returned ${response.status}`);
    }

    const data = await response.json();
    return data.reply || "Arey yaar, thoda sa network hiccup hua. Ek baar phir bolo na!";
  } catch (error) {
    console.error("Maya Response Error:", error);
    return "Um, thoda connection issue lag raha hai. I'll be right back, try again please!";
  }
}

export async function getMayaAudio(text: string): Promise<string | null> {
  try {
    const response = await fetch("/api/v1/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.audioBase64 || null;
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
    const prompt = `[SYSTEM: Update user memory for ${userName}. Current memory: "${currentMemory}". User said: "${userMessage}". Maya said: "${mayaResponse}". Return only bullet points of updated personal facts to remember about ${userName}. No extra conversational text.]`;
    
    const response = await fetch("/api/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: prompt,
        userName,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.reply?.trim() || currentMemory;
  } catch (error) {
    console.error("Memory Extraction Error:", error);
    return null;
  }
}
