import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2, AlertTriangle, Shield, Info, X, Settings } from "lucide-react";
import { getMayaResponse, getMayaAudio, resetMayaSession, extractAndUpdateMemory } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import Visualizer from "./components/Visualizer";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";
import { db, auth, logOut } from "./firebase";
import { doc, onSnapshot, collection, addDoc, getDoc, setDoc, increment } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import Login from "./components/Login";
import AdminPanel from "./components/AdminPanel";

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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userMemory, setUserMemory] = useState<string>("");

  const [appState, setAppState] = useState<AppState>("idle");
  const [firebaseOfflineError, setFirebaseOfflineError] = useState(false);
  const [sysSettings, setSysSettings] = useState<SystemSettings | null>(null);
  const [broadcast, setBroadcast] = useState<BroadcastData | null>(null);
  const [dismissedBroadcastTime, setDismissedBroadcastTime] = useState<number>(0);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    let unsubMemory: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        // Record the login
        setDoc(doc(db, "user_logins", user.uid), {
          email: user.email || "Unknown",
          lastLogin: Date.now(),
          loginCount: increment(1)
        }, { merge: true }).catch(err => console.error("Tracking Error:", err));
        
        // Listen to User Memory
        unsubMemory = onSnapshot(
          doc(db, "user_memory", user.uid),
          (memDoc) => {
            if (memDoc.exists()) {
              setUserMemory(memDoc.data().memory || "");
            } else {
              setUserMemory("");
            }
          },
          (err) => {
            console.error("Failed to load user memory", err);
          }
        );
      } else {
        if (unsubMemory) unsubMemory();
        setUserMemory("");
      }
      setAuthLoading(false);
    });
    return () => {
      unsubAuth();
      if (unsubMemory) unsubMemory();
    };
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

  // System Settings Header Listener
  useEffect(() => {
    let currentSettings: Partial<SystemSettings> = { isMaintenance: false, appVersion: "1.0.0", emergencyMessage: "", systemPrompt: "" };

    const unsubGlobal = onSnapshot(doc(db, "settings", "global_config"), (docSnap) => {
      if (docSnap.exists()) {
        currentSettings = { ...currentSettings, ...docSnap.data() };
        setSysSettings(currentSettings as SystemSettings);
      } else {
        setSysSettings({ isMaintenance: false, appVersion: "1.0.0", emergencyMessage: "" } as SystemSettings);
      }
    });

    const unsubMaya = onSnapshot(doc(db, "settings", "maya_config"), (docSnap) => {
      if (docSnap.exists()) {
        currentSettings = { ...currentSettings, systemPrompt: docSnap.data().systemPrompt };
        setSysSettings(currentSettings as SystemSettings);
        resetMayaSession(); 
      }
    });

    // Global Broadcast Listener
    const unsubBroadcast = onSnapshot(doc(db, "settings", "broadcast"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBroadcast({
          message: data.message || "",
          timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.timestamp || 0)
        });
      }
    });

    return () => {
      unsubGlobal();
      unsubMaya();
      unsubBroadcast();
    };
  }, []);

  const saveMessageToFirestore = async (msg: Omit<ChatMessage, "id">) => {
    const newMsg: ChatMessage = {
      ...msg,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now()
    };
    
    // Update local UI immediately
    setMessages(prev => [...prev, newMsg]);

    // Push to Firestore so the Live Logs on Admin Panel can see it
    if (currentUser?.uid) {
      try {
        await addDoc(collection(db, "messages"), {
          sender: newMsg.sender,
          text: newMsg.text,
          timestamp: newMsg.timestamp,
          userId: currentUser.uid
        });
      } catch (e) {
        // Silent catch for permission issues
      }
    }
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
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  const handleTextCommand = useCallback(async (finalTranscript: string) => {
    if (!finalTranscript.trim()) {
      setAppState("idle");
      return;
    }

    await saveMessageToFirestore({ sender: "user", text: finalTranscript });
    
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
      await saveMessageToFirestore({ sender: "maya", text: responseText });
      
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
      responseText = await getMayaResponse(finalTranscript, messagesRef.current, currentUser?.displayName || "User", sysSettings?.systemPrompt, userMemory);
      await saveMessageToFirestore({ sender: "maya", text: responseText });
      
      // Update memory in background
      if (currentUser?.uid) {
        extractAndUpdateMemory(currentUser.displayName || "User", userMemory, finalTranscript, responseText).then(async (newMemory) => {
          if (newMemory && newMemory !== userMemory) {
            setUserMemory(newMemory);
            await setDoc(doc(db, "user_memory", currentUser.uid), { memory: newMemory }, { merge: true });
          }
        });
      }

      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getMayaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }
      setAppState("idle");
    }
  }, [isMuted, isSessionActive]);

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
        
        const session = new LiveSessionManager("User");
        session.isMuted = isMuted;
        liveSessionRef.current = session;
        
        session.onStateChange = (state) => {
          setAppState(state);
        };
        
        session.onMessage = (sender, text) => {
          saveMessageToFirestore({ sender, text });
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

  // Handle Authentication flow
  if (authLoading) {
    return (
      <div className="h-[100dvh] w-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
      </div>
    );
  }

  // Handle Missing Firebase Database
  if (firebaseOfflineError) {
    return (
      <div className="h-[100dvh] w-screen bg-[#050505] text-white flex flex-col items-center justify-center font-sans p-6 text-center">
        <Shield className="text-red-500 mb-6 mx-auto" size={64} />
        <h1 className="text-2xl md:text-3xl font-bold mb-4 text-red-50">Database Connection Failed</h1>
        <div className="bg-red-950/30 border border-red-900 p-6 rounded-2xl max-w-lg mb-8 backdrop-blur-md">
          <p className="text-red-200 mb-4 font-medium">
            Firestore Database has not been created yet in your project.
          </p>
          <ul className="text-red-400 text-sm text-left list-decimal list-inside space-y-2">
            <li>Go to <a href="https://console.firebase.google.com/" target="_blank" className="text-red-300 underline">Firebase Console</a></li>
            <li>Select your project <b>gen-lang-client-0122088221</b></li>
            <li>Ensure <b>Firestore Database</b> (not Datastore) is created using 'Start in production mode'.</li>
            <li>Make sure your API Key (`AIzaSyD8LP80vLAa...`) in Google Cloud has no domain restrictions blocking `firestore.googleapis.com`.</li>
            <li>Or check if your ad-blocker or proxy is blocking Firestore connections.</li>
          </ul>
        </div>
        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full transition-colors font-medium">
          I've created it, Retry
        </button>
      </div>
    );
  }

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

      {/* Anime Background */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/maya-bg.jpg')", opacity: 0.9 }}
      />
      {/* Dark Gradient Overlay for readability */}
      <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-[#050505]/95 via-[#050505]/40 to-[#050505]/95 pointer-events-none" />

      {/* About/How to use Dialog */}
      <AnimatePresence>
        {showAboutDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0a0a0a] border border-white/10 p-6 md:p-8 rounded-2xl max-w-lg w-full text-white shadow-2xl relative"
            >
              <button 
                onClick={() => setShowAboutDialog(false)}
                className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-full hover:bg-white/5 transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-bold mb-4 text-red-500">About Maya AI</h2>
              <div className="space-y-4 text-white/80 text-sm md:text-base leading-relaxed">
                <p>Maya AI ek advanced personal assistant hai jo aapke sawalon ka jawab dene aur tasks asan karne ke liye design ki gayi hai.</p>
                <h3 className="text-lg font-semibold text-white mt-4 border-b border-white/10 pb-2">Kaise Use Karein?</h3>
                <ul className="list-disc pl-5 space-y-3">
                  <li><strong className="text-white">Voice Mode:</strong> "Start Session" dabayein aur bolna shuru karein. Maya aapki aawaz sunkar automatically jawab degi.</li>
                  <li><strong className="text-white">Text Mode:</strong> Keyboard icon par click karein aur apna message type karke bhejenge to Maya bol kar jawab degi.</li>
                  <li><strong className="text-white">Browser Actions:</strong> Aap Maya ko web pages open karne (e.g., "Open YouTube") ya themes change karne bol sakte hain.</li>
                  <li><strong className="text-white">Clear History:</strong> Delete icon (trash) daba kar aap purani chat bhoolne ko keh sakte hain.</li>
                </ul>
              </div>
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setShowAboutDialog(false)}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-medium transition-colors border border-red-500/50"
                >
                  Super! Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Privacy Policy Dialog */}
      <AnimatePresence>
        {showPrivacyDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0a0a0a] border border-white/10 p-6 md:p-8 rounded-2xl max-w-lg w-full text-white shadow-2xl relative"
            >
              <button 
                onClick={() => setShowPrivacyDialog(false)}
                className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-full hover:bg-white/5 transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-bold mb-4 text-red-500">Privacy Policy</h2>
              <div className="space-y-4 text-white/80 text-sm md:text-base leading-relaxed">
                <p>Maya AI par hum aapki privacy ka samman karte hain. Hum aapka koi bhi personal data bina ijazat ke save nahi karte.</p>
                <p>Hamari site par Google AdSense ke ads dikhaye jate hain jo cookies ka istemal karte hain taaki aapko behtar ads dikhaye ja sakein.</p>
                <p>Aapki voice recording aur chat history sirf aapke personal browser storage aur app functionality ke liye istemal hoti hai, and servers par permanently store nahi ki jaati hai (jab tak specify na ho).</p>
              </div>
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setShowPrivacyDialog(false)}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-medium transition-colors border border-red-500/50"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdminPanel && currentUser?.email === 'xrihman@gmail.com' && (
          <AdminPanel onClose={() => setShowAdminPanel(false)} />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-center z-20 shrink-0 px-6 py-4 md:px-12 md:py-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-black border border-red-500/50 flex items-center justify-center font-bold text-sm text-red-100 shadow-[0_0_10px_rgba(220,38,38,0.5)]">
            M
          </div>
          <h1 className="text-xl font-serif font-medium tracking-wide opacity-90">Maya</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPrivacyDialog(true)}
            className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-white/10"
            title="Privacy Policy"
          >
            <Shield size={18} className="opacity-70" />
          </button>
          <button
            onClick={() => setShowAboutDialog(true)}
            className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-white/10"
            title="How to use Maya"
          >
            <Info size={18} className="opacity-70" />
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-white/10"
              title="Clear Chat History"
            >
              <Trash2 size={18} className="opacity-70" />
            </button>
          )}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX size={18} className="opacity-70" />
            ) : (
              <Volume2 size={18} className="opacity-70" />
            )}
          </button>
          
          {currentUser?.email === 'xrihman@gmail.com' && (
            <button
              onClick={() => setShowAdminPanel(true)}
              className="p-2 rounded-full bg-red-600/20 hover:bg-red-500/40 text-red-100 transition-colors border border-red-500/30"
              title="Admin Panel"
            >
              <Settings size={18} className="opacity-90" />
            </button>
          )}

          {currentUser ? (
            <button
              onClick={() => logOut()}
              className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-white/10"
              title="Log Out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          ) : (
            <button
              onClick={() => {
                if (isLoggingIn) return;
                setIsLoggingIn(true);
                import("./firebase").then(mod => {
                  mod.signInWithGoogle().catch(err => {
                    if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
                      console.error("Login failed", err);
                    }
                  }).finally(() => {
                    setIsLoggingIn(false);
                  });
                });
              }}
              disabled={isLoggingIn}
              className={`px-4 py-1.5 rounded-full ${isLoggingIn ? 'bg-red-900/50 cursor-not-allowed' : 'bg-red-600/20 hover:bg-red-600/40'} text-red-100 transition-colors border border-red-500/30 text-sm font-medium flex items-center gap-2 shadow-[0_0_15px_rgba(220,38,38,0.3)]`}
              title="Log In to save memories"
            >
              {isLoggingIn ? 'Wait...' : 'Sign In'}
            </button>
          )}
        </div>
      </header>

      {/* Main Content - Visualizer & Chat */}
      <main className="absolute inset-0 flex flex-row items-center justify-between w-full h-full z-10 overflow-hidden pt-20 pb-24 px-4 md:px-12 pointer-events-none">
        
        {/* Left Column: Maya Status */}
        <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
          <div className="h-6">
            <AnimatePresence>
              {appState === "processing" && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-2 text-cyan-300/80 text-sm md:text-base italic font-serif"
                >
                  <Loader2 size={16} className="animate-spin" />
                  Replying...
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Center Visualizer & Status Area */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          {/* <Visualizer state={appState} /> */ /* Visualizer disabled per user request */}
          
          <div className="absolute top-[25%] left-1/2 -translate-x-1/2 w-full flex justify-center z-10 pointer-events-auto">
            <div className="maya-main-container">
              <div className="maya-avatar-wrapper">
                <div className="maya-pulse-ring"></div>
                <div className="maya-pulse-ring delay-1"></div>
                
                <img 
                  src="https://i.postimg.cc/ZnRXSx4Z/Adobe-Express-file.png" 
                  alt="Maya AI" 
                  className="maya-transparent-img"
                />
              </div>

              <div className="maya-info">
                <div className="maya-glitch-text" data-text="MAYA_SYSTEM_v2.0">MAYA_SYSTEM_v2.0</div>
                <div className="maya-status-bar">
                  <span className="blinking-dot"></span> SECURE CONNECTION ACTIVE
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: User Status */}
        <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
          <div className="h-6 flex justify-end">
            <AnimatePresence>
              {appState === "listening" && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-2 text-red-300/80 text-sm md:text-base italic"
                >
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Listening...
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </main>

      {/* Controls */}
      <footer className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-center pb-12 md:pb-16 z-20 shrink-0 gap-6">
        <AnimatePresence>
          {showTextInput && (
            <motion.form 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onSubmit={handleTextSubmit}
              className="w-full max-w-md flex items-center gap-2 bg-black/60 border border-red-500/30 rounded-full p-2 pl-5 backdrop-blur-2xl shadow-[0_0_50px_rgba(220,38,38,0.3)] mb-4 z-[100]"
            >
              <input 
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-red-100/30 text-sm md:text-base font-medium"
                autoFocus
                autoComplete="off"
              />
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="submit"
                disabled={!textInput.trim()}
                className="p-3 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:hover:bg-red-600 transition-all shadow-[0_0_20px_rgba(220,38,38,0.5)]"
              >
                <Send size={20} />
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleListening}
            className={`
              group relative flex items-center gap-4 px-10 py-5 rounded-full font-bold tracking-widest uppercase text-sm transition-all duration-500 overflow-hidden
              ${
                isSessionActive
                  ? "bg-red-600/10 text-red-500 border-2 border-red-500/30 shadow-[0_0_20px_rgba(220,38,38,0.2)]"
                  : "bg-red-600/90 text-white border-2 border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:shadow-[0_0_50px_rgba(220,38,38,0.6)]"
              }
            `}
          >
            {isSessionActive ? (
              <>
                <MicOff size={22} className="relative z-10" />
                <span className="relative z-10">End Session</span>
              </>
            ) : (
              <>
                <Mic size={22} className="relative z-10 group-hover:scale-110 transition-transform" />
                <span className="relative z-10">Start Session</span>
              </>
            )}
            
            {/* Pulsing effect for "Start" state */}
            {!isSessionActive && (
              <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-20" />
            )}
          </motion.button>
          
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className={`p-5 rounded-full border transition-all shadow-2xl group ${showTextInput ? 'bg-red-600 border-red-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
            title="Type a message"
          >
            <Keyboard size={24} className={showTextInput ? 'text-white' : 'opacity-70 group-hover:opacity-100'} />
          </button>
        </div>
      </footer>
    </div>
  );
}
