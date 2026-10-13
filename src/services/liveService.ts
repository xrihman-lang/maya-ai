import { playPCM } from "../utils/audioUtils";

export class LiveSessionManager {
  private mediaStream: MediaStream | null = null;
  public videoStream: MediaStream | null = null;
  public isMuted: boolean = false;
  private isListening: boolean = false;
  private userName: string = "User";
  private recognition: any = null;
  private lastCapturedFrame: string | null = null;

  public onStateChange: (state: "idle" | "listening" | "processing" | "speaking") => void = () => {};
  public onMessage: (sender: "user" | "maya", text: string) => void = () => {};
  public onCommand: (url: string) => void = () => {};

  constructor(userName: string = "User", public systemPrompt: string = "") {
    this.userName = userName;
  }

  async start() {
    try {
      this.onStateChange("processing");

      // Request media stream for camera and microphone
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });
        this.videoStream = this.mediaStream;
      } catch (mediaErr) {
        console.warn("Could not acquire video/audio stream:", mediaErr);
      }

      // Initialize Web Speech API for voice recognition if available
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = "hi-IN"; // Supports Hinglish/Hindi & English

        this.recognition.onstart = () => {
          this.isListening = true;
          this.onStateChange("listening");
        };

        this.recognition.onresult = async (event: any) => {
          const lastResult = event.results[event.results.length - 1];
          if (lastResult.isFinal) {
            const transcript = lastResult[0].transcript.trim();
            if (transcript) {
              await this.processUserInput(transcript);
            }
          }
        };

        this.recognition.onerror = (event: any) => {
          console.warn("Speech recognition notice:", event.error);
          if (event.error !== "no-speech") {
            this.onStateChange("idle");
          }
        };

        this.recognition.onend = () => {
          // Restart recognition if session is still active
          if (this.isListening) {
            try {
              this.recognition.start();
            } catch {
              // Ignore restart collision
            }
          }
        };

        try {
          this.recognition.start();
        } catch (recErr) {
          console.warn("Recognition start failed:", recErr);
        }
      } else {
        console.warn("Web Speech API not supported in this browser.");
      }

      this.isListening = true;
      this.onStateChange("listening");

      // Give a warm initial greeting if freshly connected
      setTimeout(async () => {
        if (this.isListening) {
          const introGreeting = `Arey ${this.userName}! Maya is here, batao kya scene hai?`;
          this.onMessage("maya", introGreeting);
          if (!this.isMuted) {
            await this.speak(introGreeting);
          }
        }
      }, 500);

    } catch (error) {
      console.error("Live session failed to start:", error);
      this.stop();
    }
  }

  async processUserInput(text: string) {
    if (!text.trim()) return;

    this.onStateChange("processing");
    this.onMessage("user", text);

    try {
      const response = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          userName: this.userName,
          imageBase64: this.lastCapturedFrame || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      const reply = data.reply || "Kuch samajh nahi aaya, ek baar repeat karoge?";

      this.onStateChange("speaking");
      this.onMessage("maya", reply);

      // Check for command execution (e.g., OPEN_URL)
      const urlPattern = /\[OPEN_URL:\s*(https?:\/\/[^\s\]]+)\]/;
      const match = reply.match(urlPattern);
      if (match) {
        this.onCommand(match[1]);
      }

      if (!this.isMuted) {
        await this.speak(reply);
      }

      if (this.isListening) {
        this.onStateChange("listening");
      } else {
        this.onStateChange("idle");
      }
    } catch (err) {
      console.error("Error processing voice input:", err);
      this.onMessage("maya", "Network me thodi dikkat hui, phir se try karein!");
      if (this.isListening) {
        this.onStateChange("listening");
      }
    }
  }

  private async speak(text: string) {
    try {
      const cleanText = text.replace(/\[OPEN_URL:[^\]]+\]/g, "").trim();
      if (!cleanText) return;

      const ttsRes = await fetch("/api/v1/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText }),
      });

      if (ttsRes.ok) {
        const ttsData = await ttsRes.json();
        if (ttsData.audioBase64) {
          await playPCM(ttsData.audioBase64);
        }
      }
    } catch (e) {
      console.warn("TTS playback error:", e);
    }
  }

  sendText(text: string) {
    this.processUserInput(text);
  }

  sendVideoFrame(base64Image: string) {
    this.lastCapturedFrame = base64Image;
  }

  stop() {
    this.isListening = false;

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
      this.recognition = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
      this.videoStream = null;
    }

    this.onStateChange("idle");
  }
}
