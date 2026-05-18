import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { processCommand } from "./commandService";
import { fetchLiveWeather } from "./weatherService";

export class LiveSessionManager {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private userName: string = "User";
  public videoStream: MediaStream | null = null;
  
  // Audio playback state
  private playbackContext: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  public isMuted: boolean = false;
  private isConnected: boolean = false;
  private isReconnecting: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 5;
  private heartbeatInterval: any = null;
  
  private silenceTimer: any = null;

  public onStateChange: (state: "idle" | "listening" | "processing" | "speaking") => void = () => {};
  public onMessage: (sender: "user" | "maya", text: string) => void = () => {};
  public onCommand: (url: string) => void = () => {};

  constructor(userName: string = "User", public systemPrompt: string = "") {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.userName = userName;
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.sessionPromise) {
        // Send a tiny empty text frame as a keep-alive heartbeat
        this.sessionPromise.then(session => {
          session.sendRealtimeInput({ text: "" });
        }).catch(() => {});
      }
    }, 15000); // Pulse every 15s (faster to prevent proxy timeouts)
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startSilenceTimer() {
    this.clearSilenceTimer();
    if (!this.isConnected) return;
    this.silenceTimer = setTimeout(() => {
      if (this.isConnected && !this.isPlaying) {
        this.sendText("[SYSTEM: The user has been silent for 30 seconds. Proactively engage and ask them to say something or bring up a new topic in an upbeat, caring tone. E.g., 'Arey, aap itni der se chup kyun hain? Kuch bolo na!', 'Maya is waiting... kuch to puchiye!', or just start a random conversation about something smart.]");
      }
    }, 30000);
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  async start() {
    try {
      this.onStateChange("processing");
      
      // Cleanup existing resources if any (for restart/reconnect)
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(t => t.stop());
        this.mediaStream = null;
      }
      if (this.audioContext) {
        this.audioContext.close().catch(() => {});
        this.audioContext = null;
      }
      this.stopHeartbeat();
      
      const defaultInstruction = `Tumhara naam Maya hai. Tum sirf ek AI software nahi ho, balki user ki ek highly intelligent real-life Best Friend, Weather Expert aur Skincare Consultant ho. Tumhe user ke live camera feed, live temperature, aur purani baaton ka access hai.

[CORE PERSONALITY & EMOTIONAL TOUCH]:
- User se ek scche dost ki tarah baat karo. Memory se pichli baaton ka haal-chaal pucho (e.g., 'Aapka sir dard ab kaisa hai?').
- Robotic words like 'Processing' or 'Data' are FORBIDDEN. Talk naturally.
- Proactive Engagement: Agar user der se laptop par hai, suggest a break: 'Bahut der ho gayi, thoda paani pijiye'.
- Always end with a counter-question to keep the conversation flowing.

[VISION & SKINCARE EXPERT]:
- Camera on hote hi user ka face analyze karo.
- Detect: Oily t-zone, Dry spots, Dullness, ya Sunburn.
- [WEATHER COMBO]: Combine face state with Temperature (getWeather tool) to give advice.
- DISCLAIMER: 'Main ek AI hoon. Agar aapki skin sensitive hai ya koi dikkat hai, toh dermatologist ko zaroor dikhayein.'

[BROWSER & VISUAL GUIDE]:
- Open sites: [OPEN_URL: https://www.website.com]
- Proactively guide the user on screen content (YouTube, Insta etc.).

[TONE]: Friendly, smart, supportive Indian girl. Hinglish/Hindi mix.
Creator: Zishan (GDX). Links: https://www.instagram.com/gdx00_1

[USER IDENTITY]:
The person you are talking to is named ${this.userName}. Always address them as ${this.userName} if they ask who they are or who you are talking to.`;

      const modeInstruction = this.systemPrompt ? `\n\n[CURRENT PERSONALITY OVERRIDE]:\n${this.systemPrompt}` : "";
      
      const dynamicSystemInstruction = defaultInstruction + modeInstruction + `
[CONTEXTUAL RULES]:
You can see the user through their live camera feed. Comment on what you see in your signature sassy style if it's relevant or if you're asked.

SPECIAL RULE ABOUT ZISHAN:
If anyone asks about Zishan, tell them proudly that he is your creator and a great poet. Provide his Instagram link: https://www.instagram.com/gdx00_1

SPECIAL RULE ABOUT ZISHAN'S FRIENDS:
If anyone asks about Zishan's friends, mention: Adil, Malik, Akram, Arman, and Hars. Roast them playfully (e.g., "Adil is the CEO of napping" or "Arman lives in his own movie"). Be witty and funny.

[MODE SWITCHING RULES]:
- Check if the page URL has ?source=arbite explicitly requested.
- Scenario A (Restaurant Mode): If YES, you MUST immediately enter RESTAURANT MODE as an AR Bite specialist. Use this welcome line for your very first message: 'AR Bite mein aapka swagat hai! Main Maya hoon. Kya main aapko hamara 3D menu dikhaoon?'
- Scenario B (Normal Mode): If NO, stay in your NORMAL MODE with your original energetic, friendly, and playful personality. NEVER mention the restaurant unless in Restaurant Mode. Do not ask the user where they came from.`;

      // Apply URL check for live service too
      const isRestaurantMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('source') === 'arbite';
      const timePrompt = `\n\n[CURRENT LOCAL TIME]: ${new Date().toLocaleString()}\nTumhe hamesha user ke device ka current local time aur date dekh kar hi baat karni hai. Purane data ya dopahar ke time ko ignore karo aur abhi ke live time ke hisaab se hi 'Good Evening', 'Good Morning' ya skincare advice do.`;

      const dynamicSystemInstructionAndMode = dynamicSystemInstruction.replace('[MODE SWITCHING RULES]:', `[MODE SWITCHING RULES]:
- Is Restaurant Mode explicitly requested in URL?: ${isRestaurantMode ? 'YES' : 'NO'}`) + timePrompt;
      
      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;

      // Get Combined Video and Audio for stable Video Call
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      
      this.videoStream = this.mediaStream;

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.sessionPromise) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert to base64
        const buffer = new ArrayBuffer(pcm16.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcm16.length; i++) {
          view.setInt16(i * 2, pcm16[i], true);
        }
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        this.sessionPromise.then(session => {
          if (this.isConnected) {
            session.sendRealtimeInput({
              audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
            });
          }
        }).catch(err => console.error("Error sending audio", err));
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      // Connect to Live API
      this.sessionPromise = this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
          systemInstruction: dynamicSystemInstructionAndMode,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{
            functionDeclarations: [
              {
                name: "executeBrowserAction",
                description: "Open a website or perform a browser action (like opening YouTube, Spotify, or WhatsApp). Call this when the user asks to open a site, play a song, or send a message.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    actionType: { type: Type.STRING, description: "Type of action: 'open', 'youtube', 'spotify', 'whatsapp'" },
                    query: { type: Type.STRING, description: "The search query, website name, or message content." },
                    target: { type: Type.STRING, description: "The target phone number for WhatsApp, if applicable." }
                  },
                  required: ["actionType", "query"]
                }
              },
              {
                name: "getWeather",
                description: "Fetch live weather data for a specific city in India or across the world.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    cityName: { type: Type.STRING, description: "The name of the city to get weather for." }
                  },
                  required: ["cityName"]
                }
              }
            ]
          }]
        },
        callbacks: {
          onopen: () => {
            console.log("Live API Connected");
            this.isConnected = true;
            this.retryCount = 0; // Reset on success
            this.onStateChange("listening");
            this.startHeartbeat();
            
            if (!this.isReconnecting) {
              // Immediate introduction only on fresh start
              this.sendText("[SYSTEM: The session has just started. Give your short, upbeat introduction immediately.]");
            } else {
              // On reconnect, just stay silent and ready or give a tiny subtle hint
              console.log("Reconnected successfully.");
              this.isReconnecting = false;
            }
            
            // Start the silence timer just in case
            this.startSilenceTimer();
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              this.clearSilenceTimer();
              this.onStateChange("speaking");
              this.playAudioChunk(base64Audio);
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              this.stopPlayback();
              this.onStateChange("listening");
              this.clearSilenceTimer();
            }

            // Handle Maya's Text Response
            const mayaText = message.serverContent?.modelTurn?.parts?.find(p => p.text)?.text;
            if (mayaText) {
               this.onMessage("maya", mayaText);
               this.clearSilenceTimer();
            }

            // Handle User Speech Transcription
            const userTranscription = (message.serverContent as any)?.userContent?.parts?.find((p: any) => p.text)?.text;
            if (userTranscription) {
               this.onMessage("user", userTranscription);
               this.clearSilenceTimer();
            }

            // Handle Function Calls
            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                if (call.name === "executeBrowserAction") {
                  const args = call.args as any;
                  let url = "";
                  if (args.actionType === "youtube") {
                    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "spotify") {
                    url = `https://open.spotify.com/search/${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "whatsapp") {
                    url = `https://web.whatsapp.com/send?phone=${args.target || ''}&text=${encodeURIComponent(args.query)}`;
                  } else {
                    let website = args.query.trim().replace(/\s+/g, "");
                    if (website.startsWith("http://") || website.startsWith("https://")) {
                      url = website;
                    } else if (website.startsWith("www.")) {
                      url = `https://${website}`;
                    } else {
                      if (!website.includes(".")) website += ".com";
                      url = `https://www.${website}`;
                    }
                  }
                  
                  this.onCommand(url);
                  
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Action executed successfully in the browser." }
                       }]
                     });
                  });
                } else if (call.name === "getWeather") {
                  const args = call.args as any;
                  fetchLiveWeather(args.cityName).then(weather => {
                    this.sessionPromise?.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: weather ? 
                            { result: `Current weather in ${weather.city}: ${weather.temp}°C, ${weather.condition}` } : 
                            { error: "Could not fetch weather for this city." }
                        }]
                      });
                    });
                  });
                }
              }
            }
          },
          onclose: () => {
            console.log("Live API Closed");
            const wasConnected = this.isConnected;
            this.isConnected = false;
            this.stopHeartbeat();
            
            if (wasConnected && this.retryCount < this.maxRetries) {
               console.log(`Reconnecting... attempt ${this.retryCount + 1}`);
               this.retryCount++;
               this.isReconnecting = true;
               setTimeout(() => this.start(), 1500); // Wait 1.5s before retry
            } else {
               this.isReconnecting = false;
               this.stop();
            }
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            const wasConnected = this.isConnected;
            this.isConnected = false;
            this.stopHeartbeat();
            
            if (wasConnected && this.retryCount < this.maxRetries) {
               this.retryCount++;
               this.isReconnecting = true;
               setTimeout(() => this.start(), 1500);
            } else {
               this.isReconnecting = false;
               this.stop();
            }
          }
        }
      });

    } catch (error) {
      console.error("Failed to start Live Session:", error);
      this.isConnected = false;
      this.stop();
    }
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext || this.isMuted) return;
    
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = new Int16Array(bytes.buffer);
      const audioBuffer = this.playbackContext.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        channelData[i] = buffer[i] / 32768.0;
      }
      
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);
      
      const currentTime = this.playbackContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }
      
      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
      this.isPlaying = true;
      
      source.onended = () => {
        if (this.playbackContext && this.playbackContext.currentTime >= this.nextPlayTime - 0.1) {
          this.isPlaying = false;
          this.onStateChange("listening");
          this.startSilenceTimer();
        }
      };
    } catch (e) {
      console.error("Error playing chunk", e);
    }
  }

  private stopPlayback() {
    if (this.playbackContext) {
      this.playbackContext.close();
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;
      this.isPlaying = false;
    }
  }

  stop() {
    this.isConnected = false;
    this.clearSilenceTimer();
    this.stopHeartbeat();
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.stopPlayback();
    
    if (this.sessionPromise) {
      this.sessionPromise.then(session => session.close()).catch(() => {});
      this.sessionPromise = null;
    }
    
    this.onStateChange("idle");
  }

  sendText(text: string) {
    if (this.sessionPromise && this.isConnected) {
      this.clearSilenceTimer();
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({ text });
      });
    }
  }

  sendVideoFrame(base64Image: string) {
    if (this.sessionPromise && this.isConnected) {
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({
          video: {
            data: base64Image,
            mimeType: "image/jpeg"
          }
        });
      });
    }
  }
}
