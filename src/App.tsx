import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2, LogOut, Shield } from "lucide-react";
import { getMayaResponse, getMayaAudio, resetMayaSession } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import Visualizer from "./components/Visualizer";
import PermissionModal from "./components/PermissionModal";
import Login from "./components/Login";
import AdminDashboard from "./components/AdminDashboard";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";
import { auth, db, logOut } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc, getDoc, query, orderBy, addDoc, deleteDoc, getDocs } from "firebase/firestore";

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
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [appState, setAppState] = useState<AppState>("idle");
  const [showAdminRoute, setShowAdminRoute] = useState(false);
  const [firebaseOfflineError, setFirebaseOfflineError] = useState(false);
  const [sysSettings, setSysSettings] = useState<SystemSettings | null>(null);
  const [broadcast, setBroadcast] = useState<BroadcastData | null>(null);
  const [dismissedBroadcastTime, setDismissedBroadcastTime] = useState<number>(0);

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

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userRef);
          let role = currentUser.email === "mohdalikhan990x@gmail.com" ? "admin" : "user";
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              email: currentUser.email,
              name: currentUser.displayName || "User",
              role: role,
              createdAt: new Date().toISOString()
            });
          } else {
            role = userSnap.data().role;
          }
          setIsAdmin(role === "admin");
        } catch (err: any) {
          console.error("Error initializing user document:", err);
          if (err.message && err.message.includes("client is offline")) {
            setFirebaseOfflineError(true);
          }
          setIsAdmin(currentUser.email === "mohdalikhan990x@gmail.com"); 
        }
      } else {
        setIsAdmin(false);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // System Settings Header Listener
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "global_config"), (docSnap) => {
      if (docSnap.exists()) {
        setSysSettings(docSnap.data() as SystemSettings);
      } else {
        setSysSettings({ isMaintenance: false, appVersion: "1.0.0", emergencyMessage: "" });
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
      unsub();
      unsubBroadcast();
    };
  }, []);

  // Firestore Messages Listener
  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }
    
    const messagesRef = collection(db, "users", user.uid, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      setMessages(fetchedMessages);
    }, (error) => {
      console.error("Firestore Error: ", error);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const saveMessageToFirestore = async (msg: Omit<ChatMessage, "id">) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "users", user.uid, "messages"), {
        ...msg,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error("Error saving message", e);
    }
  };

  const clearHistory = async () => {
    if (!user) return;
    if (confirm("Are you sure you want to clear the chat history?")) {
      try {
        const messagesRef = collection(db, "users", user.uid, "messages");
        const snapshot = await getDocs(messagesRef);
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        setMessages([]);
        resetMayaSession();
      } catch (e) {
        console.error("Error clearing history", e);
      }
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
      responseText = await getMayaResponse(finalTranscript, messagesRef.current, user?.displayName || "User");
      await saveMessageToFirestore({ sender: "maya", text: responseText });
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getMayaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }
      setAppState("idle");
    }
  }, [isMuted, isSessionActive, user]);

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
        
        const session = new LiveSessionManager(user?.displayName || "User");
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
        setShowPermissionModal(true);
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
    setShowTextInput(false);
  };

  if (!isAuthReady) {
    return <div className="h-[100dvh] w-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-red-500" size={32} /></div>;
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
            <li>Click <b>Build</b> → <b>Firestore Database</b></li>
            <li>Click <b>Create Database</b></li>
            <li>Select <b>Start in production mode</b></li>
          </ul>
        </div>
        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full transition-colors font-medium">
          I've created it, Retry
        </button>
      </div>
    );
  }

  // Handle Maintenance Mode
  if ((sysSettings?.isMaintenance || sysSettings?.isUpdating) && !isAdmin) {
    return (
      <div className="h-[100dvh] w-screen bg-[#050505] text-white flex flex-col items-center justify-center font-sans">
        <Shield className="text-red-500 mb-6" size={64} />
        <h1 className="text-3xl font-bold mb-4">Under Maintenance</h1>
        <p className="text-white/60 mb-8 max-w-md text-center">
          Maya is currently under maintenance for version {sysSettings?.appVersion || "1.0.0"}. Please check back later.
        </p>
        <button onClick={logOut} className="px-6 py-3 bg-red-900/30 border border-red-900 hover:bg-red-900/50 rounded-full transition-colors">
          Logout
        </button>
      </div>
    );
  }

  if (showAdminRoute) {
    return <AdminDashboard onExit={() => setShowAdminRoute(false)} />;
  }

  if (!user) {
    return <Login />;
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

      {showPermissionModal && (
        <PermissionModal 
          onClose={() => setShowPermissionModal(false)} 
        />
      )}

      {/* Anime Background */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/maya-bg.jpg')", opacity: 0.9 }}
      />
      {/* Dark Gradient Overlay for readability */}
      <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-[#050505]/95 via-[#050505]/40 to-[#050505]/95 pointer-events-none" />

      {/* Header */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-center z-20 shrink-0 px-6 py-4 md:px-12 md:py-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-black border border-red-500/50 flex items-center justify-center font-bold text-sm text-red-100 shadow-[0_0_10px_rgba(220,38,38,0.5)]">
            M
          </div>
          <h1 className="text-xl font-serif font-medium tracking-wide opacity-90">Maya</h1>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowAdminRoute(true)}
              className="p-2 rounded-full bg-red-950/50 hover:bg-red-900 border border-red-900/50 transition-colors"
              title="Admin Panel"
            >
              <Shield size={18} className="text-red-400" />
            </button>
          )}
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
          <button
            onClick={logOut}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10 ml-2"
            title="Log Out"
          >
            <LogOut size={18} className="opacity-70" />
          </button>
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

        {/* Center Visualizer (Fixed Full Screen Background) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <Visualizer state={appState} />
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
      <footer className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-center pb-6 md:pb-8 z-20 shrink-0 gap-4">
        <AnimatePresence>
          {showTextInput && (
            <motion.form 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onSubmit={handleTextSubmit}
              className="w-full max-w-md flex items-center gap-2 bg-white/5 border border-white/10 rounded-full p-1 pl-4 backdrop-blur-md shadow-2xl"
            >
              <input 
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type a message to Maya..."
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-sm"
                autoFocus
              />
              <button 
                type="submit"
                disabled={!textInput.trim()}
                className="p-2 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600 transition-colors"
              >
                <Send size={16} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleListening}
            className={`
              group relative flex items-center gap-3 px-8 py-4 rounded-full font-medium tracking-wide transition-all duration-300 shadow-2xl
              ${
                isSessionActive
                  ? "bg-red-600/20 text-red-400 border border-red-500/50 hover:bg-red-600/30"
                  : "bg-black/60 text-red-100 border border-red-500/30 hover:bg-red-950/80 hover:border-red-500/80 hover:scale-105"
              }
            `}
          >
            {isSessionActive ? (
              <>
                <MicOff size={20} />
                <span>End Session</span>
              </>
            ) : (
              <>
                <Mic size={20} className="group-hover:animate-bounce" />
                <span>Start Session</span>
              </>
            )}
          </button>
          
          {!isSessionActive && (
            <button
              onClick={() => setShowTextInput(!showTextInput)}
              className="p-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors shadow-2xl"
              title="Type instead"
            >
              <Keyboard size={20} className="opacity-70" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
