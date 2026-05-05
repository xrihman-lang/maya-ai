import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2, AlertTriangle, Shield, Info, X, Settings, Camera, Video, User } from "lucide-react";
import { getMayaResponse, getMayaAudio, resetMayaSession, extractAndUpdateMemory } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import Visualizer from "./components/Visualizer";
import CameraCapture from "./components/CameraCapture";
import LiveLens from "./components/LiveLens";
import NameSecurityModal from "./components/NameSecurityModal";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";

type AppState = "idle" | "listening" | "processing" | "speaking";

interface ChatMessage {
  id: string;
  sender: "user" | "maya";
  text: string;
  timestamp?: number;
}

interface SystemSettings {
  isMaintenance: boolean;
  appVersion: string;
  emergencyMessage: string;
  systemPrompt?: string;
}

interface BroadcastData {
  message: string;
  timestamp: number;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [userMemory, setUserMemory] = useState<string>("");
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem("maya_user_name") || "User";
  });

  const [appState, setAppState] = useState<AppState>("idle");
  const [sysSettings, setSysSettings] = useState<SystemSettings | null>(null);
  const [broadcast, setBroadcast] = useState<BroadcastData | null>(null);
  const [dismissedBroadcastTime, setDismissedBroadcastTime] = useState<number>(0);

  const [logoError, setLogoError] = useState(false);

  // Removed Firebase Auth logic
  useEffect(() => {
    // Load local memory if any
    const savedMemory = localStorage.getItem("maya_user_memory");
    if (savedMemory) {
      setUserMemory(savedMemory);
    }
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem("maya_chat_history");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to parse chat history", e);
    }
    return [];
  });
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
    try {
      localStorage.setItem("maya_chat_history", JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save chat history", e);
    }
  }, [messages]);

  // Local settings only (removed Firestore listeners)
  useEffect(() => {
    setSysSettings({ isMaintenance: false, appVersion: "1.0.0", emergencyMessage: "" });
  }, []);

  const saveMessageLocal = async (msg: Omit<ChatMessage, "id">) => {
    const newMsg: ChatMessage = {
      ...msg,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now()
    };
    
    // Update local UI immediately
    setMessages(prev => [...prev, newMsg]);
  };

  const clearHistory = async () => {
    if (confirm("Are you sure you want to clear the chat history?")) {
      setMessages([]);
      localStorage.removeItem("maya_chat_history");
      resetMayaSession();
    }
  };

  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  const [showTextInput, setShowTextInput] = useState(false);
  const [showLiveLens, setShowLiveLens] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleNameChange = (newName: string) => {
    setUserName(newName);
    localStorage.setItem("maya_user_name", newName);
    resetMayaSession();
    saveMessageLocal({ sender: "maya", text: `Theek hai! Ab se main aapko ${newName} bulaungi. 😊` });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  const handleTextCommand = useCallback(async (finalTranscript: string) => {
    if (!finalTranscript.trim()) {
      setAppState("idle");
      return;
    }

    await saveMessageLocal({ sender: "user", text: finalTranscript });
    
    // If live session is active, send text through it
    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.sendText(finalTranscript);
      return;
    }

    setAppState("processing");

    // 1. Check for browser commands
    const commandResult = processCommand(finalTranscript);

    let responseText = "";

    if (commandResult.isBrowserAction) {
      responseText = commandResult.action;
      await saveMessageLocal({ sender: "maya", text: responseText });
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getMayaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }

      setAppState("idle");

      setTimeout(() => {
        if (commandResult.url) {
          window.open(commandResult.url, "_blank");
        }
      }, 1500);
    } else {
      // 2. General Chit-Chat via Gemini
      responseText = await getMayaResponse(finalTranscript, messagesRef.current, userName, sysSettings?.systemPrompt, userMemory);
      await saveMessageLocal({ sender: "maya", text: responseText });
      
      // Update memory in background
      extractAndUpdateMemory(userName, userMemory, finalTranscript, responseText).then(async (newMemory) => {
        if (newMemory && newMemory !== userMemory) {
          setUserMemory(newMemory);
          localStorage.setItem("maya_user_memory", newMemory);
        }
      });

      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getMayaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }
      setAppState("idle");
    }
  }, [isMuted, isSessionActive, userName, userMemory, sysSettings]);

  const handleImageCapture = async (base64Image: string) => {
    setAppState("processing");
    await saveMessageLocal({ sender: "user", text: "[Sent a photo]" });
    
    try {
      const responseText = await getMayaResponse("I sent you a photo. What can you see?", messagesRef.current, userName, sysSettings?.systemPrompt, userMemory, base64Image);
      await saveMessageLocal({ sender: "maya", text: responseText });
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getMayaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }
      setAppState("idle");
    } catch (error) {
      console.error("Image processing error:", error);
      setAppState("idle");
    }
  };

  const [isProcessingLiveFrame, setIsProcessingLiveFrame] = useState(false);

  const handleLiveFrame = useCallback(async (base64Image: string) => {
    // If we have an active real-time session, send the frame directly through it
    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.sendVideoFrame(base64Image);
      return;
    }

    if (isProcessingLiveFrame || appState === 'speaking' || appState === 'processing') return;
    
    setIsProcessingLiveFrame(true);
    try {
      const livePrompt = "You are in a live video call. Briefly comment on what you see right now or if something changed. Keep it sasssy and very short (one sentence). If nothing much is happening, just say nothing.";
      const responseText = await getMayaResponse(livePrompt, messagesRef.current, userName, sysSettings?.systemPrompt, userMemory, base64Image);
      
      // Only react if she actually has something interesting to say (not 'nothing')
      if (responseText && !responseText.toLowerCase().includes("nothing") && responseText.length > 5) {
        await saveMessageLocal({ sender: "maya", text: responseText });
        
        if (!isMuted) {
          setAppState("speaking");
          const audioBase64 = await getMayaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
        }
      }
    } catch (e) {
      console.error("Live analysis failed", e);
    } finally {
      setIsProcessingLiveFrame(false);
      setAppState("idle");
    }
  }, [isProcessingLiveFrame, appState, isMuted, sysSettings, userMemory]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      resetMayaSession();
    } else {
      try {
        setIsSessionActive(true);
        resetMayaSession();
        
        const session = new LiveSessionManager(userName);
        session.isMuted = isMuted;
        liveSessionRef.current = session;
        
        session.onStateChange = (state) => {
          setAppState(state);
        };
        
        session.onMessage = (sender, text) => {
          saveMessageLocal({ sender, text });
        };
        
        session.onCommand = (url) => {
          setTimeout(() => {
            window.open(url, "_blank");
          }, 1000);
        };

        await session.start();
      } catch (e) {
        console.error("Failed to start session", e);
        setIsSessionActive(false);
        setAppState("idle");
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    
    handleTextCommand(textInput);
    setTextInput("");
  };

  // Handle Maintenance Mode
  if (sysSettings?.isMaintenance || sysSettings?.isUpdating) {
    return (
      <div className="h-[100dvh] w-screen bg-[#050505] text-white flex flex-col items-center justify-center font-sans">
        <Shield className="text-red-500 mb-6" size={64} />
        <h1 className="text-3xl font-bold mb-4">Under Maintenance</h1>
        <p className="text-white/60 mb-8 max-w-md text-center">
          Maya is currently under maintenance for version {sysSettings?.appVersion || "1.0.0"}. Please check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-screen bg-[#050505] text-white flex flex-col items-center justify-between font-sans relative overflow-hidden m-0 p-0">
      {/* Global Broadcast Message Top Banner */}
      <AnimatePresence>
        {broadcast?.message && broadcast.timestamp > dismissedBroadcastTime && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-0 left-0 w-full z-[100] p-4 font-sans"
          >
            <div className="max-w-4xl mx-auto bg-gradient-to-r from-orange-500 to-red-600 rounded-xl shadow-2xl p-4 flex items-center justify-between border border-orange-400/50">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-white shrink-0" size={24} />
                <p className="text-white font-medium text-sm md:text-base leading-snug">
                  {broadcast.message}
                </p>
              </div>
              <button 
                onClick={() => setDismissedBroadcastTime(broadcast.timestamp)}
                className="px-4 py-2 shrink-0 bg-black/20 hover:bg-black/40 text-white rounded-lg transition-colors font-medium text-sm"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emergency Message Broadcast (Legacy / Config) */}
      <AnimatePresence>
        {sysSettings?.emergencyMessage && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute top-20 left-0 w-full z-50 px-4 flex justify-center pointer-events-none"
          >
            <div className="bg-red-600/90 text-white text-sm font-medium px-4 py-2 rounded-full border border-red-400/50 shadow-lg backdrop-blur-md flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              {sysSettings.emergencyMessage}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Elements */}
      <div className="grid-bg" />
      <div className="scanning-line" />
      <ParticleBackground />

      {/* About/How to use Dialog */}
      <AnimatePresence>
        {showAboutDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#001B2E]/90 backdrop-blur-xl font-sans">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#001b2e] border border-[#00f0ff]/20 p-6 md:p-8 rounded-2xl max-w-lg w-full text-white shadow-[0_0_50px_rgba(0,240,255,0.1)] relative"
            >
              <button 
                onClick={() => setShowAboutDialog(false)}
                className="absolute top-4 right-4 p-2 text-[#00f0ff]/50 hover:text-[#00f0ff] rounded-full hover:bg-[#00f0ff]/5 transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-bold mb-4 text-[#00f0ff] tracking-tight">System Protocol: MAYA</h2>
              <div className="space-y-4 text-white/80 text-sm md:text-base leading-relaxed font-mono">
                <p>{">"} Maya AI is an advanced neural interface designed for seamless interaction and task automation.</p>
                <h3 className="text-lg font-semibold text-[#00f0ff] mt-4 border-b border-[#00f0ff]/10 pb-2">Operational Guidelines</h3>
                <ul className="list-disc pl-5 space-y-3 opacity-90">
                  <li><strong className="text-[#00f0ff]">Neutral Voice:</strong> "Start Talking" initiates a secure real-time neural link.</li>
                  <li><strong className="text-[#00f0ff]">Data Input:</strong> Use the terminal interface for text commands.</li>
                  <li><strong className="text-[#00f0ff]">Visual Link:</strong> Activate the camera for visual situational awareness.</li>
                  <li><strong className="text-[#00f0ff]">Reset:</strong> Use the system wipe (trash icon) to clear local cache.</li>
                </ul>
              </div>
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setShowAboutDialog(false)}
                  className="bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] px-6 py-2 rounded-lg font-medium transition-all border border-[#00f0ff]/30"
                >
                  Confirm Awareness
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Privacy Policy Dialog */}
      <AnimatePresence>
        {showPrivacyDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#001B2E]/90 backdrop-blur-xl font-sans">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#001b2e] border border-[#00f0ff]/20 p-6 md:p-8 rounded-2xl max-w-lg w-full text-white shadow-[0_0_50px_rgba(0,240,255,0.1)] relative"
            >
              <button 
                onClick={() => setShowPrivacyDialog(false)}
                className="absolute top-4 right-4 p-2 text-[#00f0ff]/50 hover:text-[#00f0ff] rounded-full hover:bg-[#00f0ff]/5 transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-bold mb-4 text-[#00f0ff] tracking-tight">Security Protocol</h2>
              <div className="space-y-4 text-white/80 text-sm md:text-base leading-relaxed font-mono">
                <p>{">"} Neural link encryption active. User privacy is a priority within the MAYA environment.</p>
                <p>{">"} No personal biometric data is stored outside the local neural core. External nodes (AdSense) may use cookies for contextual awareness.</p>
                <p>{">"} Current historical logs are stored strictly within the user's primary browser storage device.</p>
              </div>
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setShowPrivacyDialog(false)}
                  className="bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] px-6 py-2 rounded-lg font-medium transition-all border border-[#00f0ff]/30"
                >
                  Acknowledge
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-center z-20 shrink-0 px-6 py-4 md:px-12 md:py-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#00f0ff]/5 border border-[#00f0ff]/20 flex items-center justify-center font-bold text-lg text-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.2)]">
            M
          </div>
          <div className="hidden md:block">
            <h1 className="text-xl font-bold tracking-[0.2em] text-[#00f0ff]">MAYA</h1>
            <p className="text-[10px] font-mono text-[#00f0ff]/40 uppercase tracking-widest">Neural OS v8.2.0</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNameModal(true)}
            className="p-2 rounded-lg bg-[#00f0ff]/5 hover:bg-[#00f0ff]/10 text-[#00f0ff]/70 hover:text-[#00f0ff] transition-all border border-[#00f0ff]/10 flex items-center gap-2 px-3"
            title="Set user identity"
          >
            <User size={16} />
            <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:inline">{userName}</span>
          </button>
          <button
            onClick={() => setShowPrivacyDialog(true)}
            className="p-2 rounded-lg bg-[#00f0ff]/5 hover:bg-[#00f0ff]/10 text-[#00f0ff]/70 transition-all border border-[#00f0ff]/10"
            title="Security Protocols"
          >
            <Shield size={16} />
          </button>
          <button
            onClick={() => setShowAboutDialog(true)}
            className="p-2 rounded-lg bg-[#00f0ff]/5 hover:bg-[#00f0ff]/10 text-[#00f0ff]/70 transition-all border border-[#00f0ff]/10"
            title="System Info"
          >
            <Info size={16} />
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="p-2 rounded-lg bg-red-500/5 hover:bg-red-500/10 text-red-400/70 transition-all border border-red-500/10"
              title="System Wipe"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-lg bg-[#00f0ff]/5 hover:bg-[#00f0ff]/10 text-[#00f0ff]/70 transition-all border border-[#00f0ff]/10"
            title={isMuted ? "Audio Offline" : "Audio Online"}
          >
            {isMuted ? (
              <VolumeX size={16} />
            ) : (
              <Volume2 size={16} />
            )}
          </button>
        </div>
      </header>

      {/* Main HUD Interface */}
      <main className="absolute inset-0 flex flex-col md:flex-row items-center justify-between w-full h-full z-10 overflow-hidden pt-24 pb-32 px-6 md:px-12 pointer-events-none">
        
        {/* Left HUD: System Status */}
        <div className="hidden md:flex w-64 flex-col gap-6 pointer-events-auto">
          <HUDPanel title="NEURAL_LOAD">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between font-mono text-[10px] text-[#00f0ff]/70">
                <span>SYNAPTIC_PULSE</span>
                <span className="text-[#00f0ff]">98.2%</span>
              </div>
              <div className="w-full h-1 bg-[#00f0ff]/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "98.2%" }}
                  className="h-full bg-[#00f0ff]"
                />
              </div>
              <div className="flex justify-between font-mono text-[10px] text-[#00f0ff]/70">
                <span>CORE_TEMP</span>
                <span className="text-[#00f0ff]">32°C</span>
              </div>
              <div className="w-full h-1 bg-[#00f0ff]/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "45%" }}
                  className="h-full bg-cyan-400"
                />
              </div>
            </div>
          </HUDPanel>

          <AnimatePresence>
            {appState === "processing" && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3 p-4 bg-[#00f0ff]/5 border border-[#00f0ff]/20 rounded-lg"
              >
                <Loader2 size={16} className="text-[#00f0ff] animate-spin" />
                <span className="text-xs font-mono text-[#00f0ff] uppercase tracking-widest">Analyzing Neural Stream...</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Center: AI CORE */}
        <div className="flex-1 h-full flex items-center justify-center relative pointer-events-auto">
          <AICore state={appState} />
        </div>

        {/* Right HUD: Memory Trace */}
        <div className="hidden md:flex w-64 flex-col gap-6 pointer-events-auto">
          <HUDPanel title="MEMORY_TRACE">
             <div className="font-mono text-[10px] text-[#00f0ff]/60 leading-relaxed overflow-hidden max-h-48 scrollbar-hide">
                {userMemory ? (
                  <p className="line-clamp-6 whitespace-pre-wrap lowercase">{">"} {userMemory}</p>
                ) : (
                  <p className="opacity-40 italic">{">"} current memory state: null</p>
                )}
             </div>
          </HUDPanel>

          <AnimatePresence>
            {appState === "listening" && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-3 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg justify-end"
              >
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Vocal Stream Passive</span>
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Floating Interaction Controls */}
      <footer className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-center pb-10 md:pb-12 z-20 shrink-0 gap-6">
        <AnimatePresence>
          {showTextInput && (
            <motion.form 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onSubmit={handleTextSubmit}
              className="w-full max-w-lg flex items-center gap-2 bg-[#001B2E]/60 border border-[#00f0ff]/20 rounded-xl p-2 pl-6 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,240,255,0.1)] mb-4 z-[100]"
            >
              <input 
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Neural Input Terminal..."
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-[#00f0ff]/30 text-sm md:text-base font-mono"
                autoFocus
                autoComplete="off"
              />
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={!textInput.trim()}
                className="p-3 rounded-lg bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] disabled:opacity-30 transition-all border border-[#00f0ff]/20"
              >
                <Send size={20} />
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showCamera && (
            <CameraCapture 
              onCapture={handleImageCapture}
              onClose={() => setShowCamera(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showLiveLens && (
            <LiveLens 
              onFrame={handleLiveFrame}
              onClose={() => setShowLiveLens(false)}
              externalStream={isSessionActive ? liveSessionRef.current?.videoStream : null}
            />
          )}
        </AnimatePresence>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-2xl px-6">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={toggleListening}
            className={`
              relative px-10 py-5 rounded-2xl font-bold text-lg transition-all duration-500 flex-1 w-full border uppercase tracking-[0.2em]
              ${
                isSessionActive
                  ? "bg-[#00f0ff]/5 text-[#00f0ff] border-[#00f0ff]/30 shadow-[0_0_30px_rgba(0,240,255,0.1)]"
                  : "bg-[#00f0ff]/10 text-white border-[#00f0ff]/40 shadow-[0_0_40px_rgba(0,240,255,0.2)] hover:bg-[#00f0ff]/20"
              }
            `}
          >
            <div className="flex items-center justify-center gap-4">
              {isSessionActive ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse" />
                  Neural Link Established
                </>
              ) : (
                <>
                  <Mic size={24} className="text-[#00f0ff]" />
                  Initiate Neural Link
                </>
              )}
            </div>
          </motion.button>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-center">
            <ControlButton 
              active={showLiveLens} 
              onClick={() => {
                const newShow = !showLiveLens;
                setShowLiveLens(newShow);
                if (newShow && !isSessionActive) toggleListening();
              }}
              icon={<Video size={20} />}
              label="VISUAL_LINK"
            />
            <ControlButton 
              active={showCamera} 
              onClick={() => setShowCamera(!showCamera)}
              icon={<Camera size={20} />}
              label="SNAP_MODULE"
            />
            <ControlButton 
              active={showTextInput} 
              onClick={() => setShowTextInput(!showTextInput)}
              icon={<Keyboard size={20} />}
              label="TERMINAL"
            />
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {showNameModal && (
          <NameSecurityModal 
            currentName={userName}
            onSave={handleNameChange}
            onClose={() => setShowNameModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components for futuristic HUD

function HUDPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel p-4 rounded-xl relative overflow-hidden group">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-3 bg-[#00f0ff]" />
        <h3 className="text-[10px] font-mono text-[#00f0ff] uppercase tracking-[0.3em] font-bold">{title}</h3>
      </div>
      {children}
      <div className="absolute top-0 right-0 p-1 opacity-20">
        <div className="w-4 h-4 border-t border-r border-[#00f0ff]" />
      </div>
      <div className="absolute bottom-0 left-0 p-1 opacity-20">
        <div className="w-4 h-4 border-b border-l border-[#00f0ff]" />
      </div>
    </div>
  );
}

function ControlButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center gap-2 p-4 rounded-xl border transition-all group relative overflow-hidden
        ${active ? 'bg-[#00f0ff]/20 border-[#00f0ff]/50' : 'bg-[#00f0ff]/5 border-[#00f0ff]/10 hover:bg-[#00f0ff]/10'}
      `}
      title={label}
    >
      <div className={`${active ? 'text-[#00f0ff]' : 'text-[#00f0ff]/50 group-hover:text-[#00f0ff]'} transition-colors`}>
        {icon}
      </div>
      <span className={`text-[8px] font-mono uppercase tracking-[0.2em] ${active ? 'text-[#00f0ff]' : 'text-[#00f0ff]/30'}`}>
        {label}
      </span>
      {active && (
        <motion.div 
          layoutId="active-glow"
          className="absolute inset-0 bg-[#00f0ff]/5 pointer-events-none"
        />
      )}
    </button>
  );
}

function AICore({ state }: { state: AppState }) {
  const isInteracting = state !== 'idle';
  
  return (
    <div className="relative w-80 h-80 flex items-center justify-center">
      {/* Outer Thin Ring */}
      <div className="maya-core-ring w-full h-full rotate-cw border-[#00f0ff]/10 border-dashed" />
      
      {/* Middle Segmented Arc Layer */}
      <motion.div 
        animate={{ rotate: isInteracting ? 360 : 0 }}
        transition={{ duration: isInteracting ? 4 : 20, repeat: Infinity, ease: "linear" }}
        className="absolute w-[85%] h-[85%]"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full opacity-40">
          <circle cx="50" cy="50" r="48" fill="none" stroke="#00f0ff" strokeWidth="0.5" strokeDasharray="10 20" />
        </svg>
      </motion.div>

      {/* Rotating Data Arcs */}
      <motion.div 
        animate={{ rotate: isInteracting ? -360 : 0 }}
        transition={{ duration: isInteracting ? 2 : 30, repeat: Infinity, ease: "linear" }}
        className="absolute w-[70%] h-[70%]"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full text-[#00f0ff]">
          <path d="M 50 2 A 48 48 0 0 1 98 50" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-60" />
          <path d="M 50 98 A 48 48 0 0 1 2 50" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-60" />
        </svg>
      </motion.div>

      {/* Inner Glow Core */}
      <div className={`w-[45%] h-[45%] rounded-full bg-[#00f0ff]/5 border border-[#00f0ff]/40 flex flex-col items-center justify-center pulse-glow z-10 shadow-[0_0_50px_rgba(0,240,255,0.1)] relative`}>
        {/* Core Text */}
        <div className="text-2xl font-bold tracking-[0.3em] text-[#00f0ff] mb-1">MAYA</div>
        
        {/* State Label */}
        <div className="text-[8px] font-mono uppercase tracking-widest text-[#00f0ff]/50">
          {state}
        </div>

        {/* Circular Waveform (Only when speaking or listening) */}
        {isInteracting && (
           <div className="absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full opacity-40">
                <motion.circle 
                  cx="50" cy="50" r="40" 
                  fill="none" stroke="#00f0ff" 
                  strokeWidth="0.5"
                  animate={{ r: [38, 42, 38], opacity: [0.2, 0.5, 0.2] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              </svg>
           </div>
        )}
      </div>

      {/* Reactive Bars */}
      <div className="absolute inset-x-0 -bottom-12 flex justify-center h-8 gap-1 items-end pointer-events-none">
        {state !== 'idle' && Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            animate={{ 
              height: [8, Math.random() * 24 + 8, 8],
              opacity: [0.3, 1, 0.3]
            }}
            transition={{ 
              duration: 0.4, 
              repeat: Infinity, 
              delay: i * 0.05,
              ease: "easeInOut"
            }}
            className="w-[3px] bg-[#00f0ff] rounded-full"
          />
        ))}
      </div>
    </div>
  );
}

function ParticleBackground() {
  const particles = Array.from({ length: 40 });
  
  return (
    <div className="particle-container">
      {particles.map((_, i) => (
        <motion.div
          key={i}
          className="particle"
          initial={{ 
            x: Math.random() * 100 + "vw", 
            y: Math.random() * 100 + "vh",
            scale: Math.random() * 0.5 + 0.5,
            opacity: Math.random() * 0.2 + 0.1
          }}
          animate={{ 
            y: ["-10vh", "110vh"],
            x: [
              Math.random() * 100 + "vw",
              (Math.random() * 100 - 10) + "vw"
            ]
          }}
          transition={{ 
            duration: Math.random() * 20 + 20, 
            repeat: Infinity, 
            ease: "linear",
            delay: -Math.random() * 20
          }}
        />
      ))}
    </div>
  );
}
