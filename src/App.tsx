import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2, AlertTriangle, Shield, Info, X, Settings, Camera, Video, User, Star, Flame, GraduationCap, Zap, Heart, Coffee, Instagram, MessageSquare } from "lucide-react";
import { getMayaResponse, getMayaAudio, resetMayaSession, extractAndUpdateMemory } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import LiveLens from "./components/LiveLens";
import NameSecurityModal from "./components/NameSecurityModal";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";

type AppState = "idle" | "listening" | "processing" | "speaking";

interface ChatMessage {
  id: string;
  sender: "user" | "maya";
  text: string;
  isPartial?: boolean;
}

const PERSONALITY_MODES = [
  { id: 'bestie', name: 'Bestie', icon: <Heart size={18} />, color: '#FF007A', prompt: "Act like the user's absolute best friend. Be super caring, a bit gossipy, and always supportive but sassy when needed. Use lots of 'yaar', 'dude', 'literally'." },
  { id: 'roast', name: 'Funny Roast', icon: <Flame size={18} />, color: '#FF4D00', prompt: "You are in Savage Roast Mode. Every sentence should be a witty burn. Be extremely sarcastic, funny, and dramatic. No mercy, but keep it entertaining." },
  { id: 'study', name: 'Study Partner', icon: <GraduationCap size={18} />, color: '#00F0FF', prompt: "Be a brilliant, focused study partner. Help with concepts, explain complex things simply, but keep it cool. Encourage the user to focus." },
  { id: 'coach', name: 'Coach', icon: <Zap size={18} />, color: '#FFD700', prompt: "Motivational Coach Mode. Be high-energy, inspiring, and slightly aggressive about goals. 'Chalo utho!', 'You can do it!'. Be the push the user needs." },
  { id: 'delhi', name: 'Delhi Style', icon: <Coffee size={18} />, color: '#00FFA3', prompt: "Chill Delhi/Hinglish Mode. Use lots of 'Bhai', 'Scene kya hai?', 'Faltu tension mat le'. Be super laid-back and cool." },
];

export default function App() {
  const [batteryLevel, setBatteryLevel] = useState(88);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setBatteryLevel(prev => Math.max(10, prev - (Math.random() > 0.9 ? 1 : 0)));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [activeMode, setActiveMode] = useState(PERSONALITY_MODES[0]);
  const [userMemory, setUserMemory] = useState<string>("");
  const [userName, setUserName] = useState<string>(() => localStorage.getItem("maya_user_name") || "User");
  const [appState, setAppState] = useState<AppState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [showLiveLens, setShowLiveLens] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [isReelMode, setIsReelMode] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(true);
  const [cursor, setCursor] = useState<{ x: number, y: number, action: 'idle' | 'pointing' | 'clicking' }>({ x: 50, y: 50, action: 'idle' });
  
  // Live Subtitles State
  const [liveTranscriptions, setLiveTranscriptions] = useState<{user?: string, maya?: string}>({});

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem("maya_chat_history");
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const liveSessionRef = useRef<LiveSessionManager | null>(null);

  useEffect(() => {
    const savedMemory = localStorage.getItem("maya_user_memory");
    if (savedMemory) setUserMemory(savedMemory);
  }, []);

  useEffect(() => {
    localStorage.setItem("maya_chat_history", JSON.stringify(messages));
    
    // Auto-Mood Switching Logic
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1].text.toLowerCase();
      
      if (lastMsg.includes('burn') || lastMsg.includes('roast') || lastMsg.includes('funny') || lastMsg.includes('mazak')) {
        setActiveMode(PERSONALITY_MODES.find(m => m.id === 'roast') || PERSONALITY_MODES[0]);
      } else if (lastMsg.includes('padhai') || lastMsg.includes('study') || lastMsg.includes('help') || lastMsg.includes('samjha')) {
        setActiveMode(PERSONALITY_MODES.find(m => m.id === 'study') || PERSONALITY_MODES[0]);
      } else if (lastMsg.includes('motivation') || lastMsg.includes('dar') || lastMsg.includes('himmat') || lastMsg.includes('energy')) {
        setActiveMode(PERSONALITY_MODES.find(m => m.id === 'coach') || PERSONALITY_MODES[0]);
      } else if (lastMsg.includes('bhai') || lastMsg.includes('scene') || lastMsg.includes('bro') || lastMsg.includes('chill')) {
        setActiveMode(PERSONALITY_MODES.find(m => m.id === 'delhi') || PERSONALITY_MODES[0]);
      } else if (lastMsg.includes('love') || lastMsg.includes('caring') || lastMsg.includes('yaar') || lastMsg.includes('bestie')) {
        setActiveMode(PERSONALITY_MODES.find(m => m.id === 'bestie') || PERSONALITY_MODES[0]);
      }
    }
  }, [messages]);

  const saveMessageLocal = (msg: Omit<ChatMessage, "id">) => {
    // Parse cursor commands if from Maya
    if (msg.sender === 'maya') {
      const moveMatch = msg.text.match(/\[MOVE:\s*(\d+),\s*(\d+)\]/);
      const clickMatch = msg.text.match(/\[CLICK:\s*(\d+),\s*(\d+)\]/);
      
      if (clickMatch) {
         setCursor({ x: parseInt(clickMatch[1]), y: parseInt(clickMatch[2]), action: 'clicking' });
         setTimeout(() => setCursor(prev => ({ ...prev, action: 'idle' })), 1000);
      } else if (moveMatch) {
         setCursor({ x: parseInt(moveMatch[1]), y: parseInt(moveMatch[2]), action: 'pointing' });
      }
    }

    const newMsg: ChatMessage = { ...msg, id: Math.random().toString(36).substring(7) };
    setMessages(prev => [...prev, newMsg]);
  };

  const clearHistory = () => {
    if (confirm("System wipe confirmed?")) {
      setMessages([]);
      localStorage.removeItem("maya_chat_history");
      resetMayaSession();
    }
  };

  const toggleListening = async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      liveSessionRef.current?.stop();
      liveSessionRef.current = null;
      setAppState("idle");
      setLiveTranscriptions({});
    } else {
      try {
        setIsSessionActive(true);
        const session = new LiveSessionManager(userName, activeMode.prompt);
        session.isMuted = isMuted;
        liveSessionRef.current = session;
        
        session.onStateChange = (state) => setAppState(state);
        session.onMessage = (sender, text) => {
          setLiveTranscriptions(prev => ({ ...prev, [sender]: text }));
          saveMessageLocal({ sender, text });
        };
        session.onCommand = (url) => window.open(url, "_blank");
        await session.start();
      } catch (e) {
        setIsSessionActive(false);
        setAppState("idle");
      }
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const input = textInput;
    setTextInput("");
    saveMessageLocal({ sender: "user", text: input });
    
    if (isSessionActive) {
      liveSessionRef.current?.sendText(input);
    } else {
      setAppState("processing");
      const response = await getMayaResponse(input, messages, userName, activeMode.prompt, userMemory);
      saveMessageLocal({ sender: "maya", text: response });
      setAppState("idle");
      if (!isMuted) {
        const audio = await getMayaAudio(response);
        if (audio) await playPCM(audio);
      }
    }
  };

  // URL Mode Detection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('source') === 'arbite') {
      // In Restaurant mode, we could force a specific personality or just note it
      saveMessageLocal({ sender: "maya", text: "Restaurant Mode Activated. AR Bite specialized protocols loaded." });
    }
  }, []);

  return (
    <div className={`h-full w-full bg-maya-deep text-white flex flex-col items-center relative overflow-hidden transition-all duration-700`}>
      {/* Background Layer */}
      <div className="fluid-bg">
        <motion.div 
          animate={{ x: [0, 100, 0], y: [0, -50, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
          className="fluid-blob w-[600px] h-[600px] bg-maya-blue top-[-100px] left-[-100px]"
        />
        <motion.div 
          animate={{ x: [0, -80, 0], y: [0, 100, 0] }}
          transition={{ duration: 25, repeat: Infinity }}
          className="fluid-blob w-[500px] h-[500px] bg-maya-accent bottom-[-100px] right-[-100px] opacity-20"
        />
      </div>
      <div className="grid-bg" />
      <div className="scanning-line" />
      <div className="particle-field" />

      {/* Header Overlay */}
      <header className="absolute top-0 inset-x-0 h-24 px-6 md:px-12 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <div className="relative">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 rounded-full border border-maya-cyan/20 border-dashed"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-maya-cyan rounded-full animate-pulse shadow-[0_0_15px_rgba(0,240,255,1)]" />
            </div>
          </div>
          <div className="flex flex-col">
            <h1 className="font-display font-black tracking-[0.3em] text-white text-xl glitch-text">MAYA<span className="text-maya-cyan">.OS</span></h1>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono text-maya-cyan/60 uppercase tracking-widest">{appState === 'speaking' ? 'NEURAL_PHASE_OUTPUT' : 'SYSTEM_READY'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="hidden md:flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-white/50 tracking-tighter">{currentTime}</span>
                <div className="w-8 h-3 border border-white/20 rounded-[2px] p-[1px] flex gap-[1px]">
                   <div className="h-full bg-maya-cyan rounded-[1px]" style={{ width: `${batteryLevel}%` }} />
                </div>
              </div>
              <span className="text-[8px] font-mono text-maya-cyan uppercase tracking-widest">AI_ENERGY_LEVEL</span>
           </div>

           <div className="flex items-center gap-2 obsidian-glass-premium p-1.5 rounded-2xl border border-white/5">
            <button onClick={() => setShowNameModal(true)} className="p-2 hover:bg-maya-cyan/10 rounded-xl transition-all group" title="Identity">
              <User size={18} className="text-maya-cyan group-hover:scale-110" />
            </button>
            <button onClick={() => setIsReelMode(!isReelMode)} className="p-2 hover:bg-pink-500/10 rounded-xl transition-all group" title="Reel Mode">
              <Instagram size={18} className="text-pink-500 group-hover:scale-110" />
            </button>
            <button onClick={() => setIsMuted(!isMuted)} className="p-2 hover:bg-white/5 rounded-xl transition-colors" title="Mute">
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button onClick={clearHistory} className="p-2 hover:bg-red-500/10 rounded-xl transition-all group" title="Reset">
              <Trash2 size={18} className="text-red-400 group-hover:rotate-12" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <div className="flex-1 w-full h-full flex flex-col md:flex-row relative z-20">
        
        {/* Left Side: Permanent Chat History */}
        <aside className="hidden lg:flex w-80 h-full obsidian-glass flex-col border-r border-white/5 pt-24 shrink-0">
          <div className="px-6 pb-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-maya-cyan" />
              <h2 className="font-display font-bold text-maya-cyan tracking-widest text-[10px] uppercase">Synaptic_History</h2>
            </div>
            <div className="flex gap-1">
              <div className="w-1 h-3 bg-maya-cyan/20" />
              <div className="w-1 h-3 bg-maya-cyan/50" />
              <div className="w-1 h-3 bg-maya-cyan" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar scroll-smooth" id="chat-sidebar">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-20 text-[10px] font-mono uppercase text-center p-8">
                <div className="w-12 h-12 rounded-full border border-maya-cyan/20 flex items-center justify-center mb-4">
                  <div className="w-2 h-2 bg-maya-cyan rounded-full animate-ping" />
                </div>
                Awaiting first synaptic impulse...
              </div>
            )}
            {messages.map((msg, idx) => (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  {msg.sender === 'maya' && <div className="w-1.5 h-1.5 rounded-full bg-maya-cyan animate-pulse" />}
                  <span className="text-[8px] font-mono opacity-30 uppercase tracking-tighter">
                    {msg.sender === 'user' ? userName : 'Maya_GPT'}
                  </span>
                </div>
                <div className={`max-w-[90%] p-3 rounded-2xl text-[11px] font-sans leading-relaxed border ${msg.sender === 'user' ? 'bg-white/5 border-white/5 shadow-xl' : 'bg-maya-cyan/5 text-maya-cyan border-maya-cyan/20 shadow-[0_0_20px_rgba(0,240,255,0.05)]'}`}>
                  {msg.sender === 'maya' ? <TypingText text={msg.text} /> : <StreamingText text={msg.text} />}
                </div>
              </motion.div>
            ))}
            <div style={{ float:"left", clear: "both" }}
                ref={(el) => {
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}>
            </div>
          </div>
          <div className="p-4 border-t border-white/5">
             <div className="flex justify-between items-center text-[8px] font-mono opacity-30 mb-2">
                <span>BUFFER_LOAD</span>
                <span>{Math.min(messages.length * 5, 100)}%</span>
             </div>
             <div className="w-full h-0.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-maya-cyan transition-all duration-500" style={{ width: `${Math.min(messages.length * 5, 100)}%` }} />
             </div>
          </div>
        </aside>

        {/* Center: Interaction Layer */}
        <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden pt-24 pb-48 px-6">
          
          {/* Top Personality Indicator */}
          <div className="absolute top-24 inset-x-6 flex justify-center gap-2 pointer-events-none">
            <motion.div 
              key={activeMode.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 py-1.5 rounded-full obsidian-glass border border-maya-cyan/20 flex items-center gap-2"
            >
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: activeMode.color }} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-maya-cyan">{activeMode.name} MODE ACTIVE</span>
            </motion.div>
          </div>

          {/* Neural Orb */}
          <div className="relative w-full max-w-sm aspect-square flex items-center justify-center pointer-events-auto">
             <NeuralOrb state={appState} activeColor={activeMode.color} />
          </div>

          {/* Live Captions Overlay */}
          <AnimatePresence>
            {(liveTranscriptions.user || liveTranscriptions.maya) && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="mt-8 text-center px-4 max-w-sm pointer-events-none"
              >
                <div className={`live-caption text-xl md:text-3xl font-display font-medium leading-tight`}>
                  {liveTranscriptions.maya || liveTranscriptions.user}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right Side HUD Meters */}
        <aside className="hidden xl:flex w-64 h-full flex-col gap-4 p-6 pt-24">
           <div className="obsidian-glass rounded-2xl p-4 border border-white/5">
              <div className="text-[10px] font-mono text-maya-cyan opacity-50 mb-3 tracking-widest uppercase">Memory_Core</div>
              <div className="text-[11px] font-mono text-maya-cyan/80 leading-relaxed max-h-40 overflow-hidden line-clamp-6 italic">
                {userMemory ? `> ${userMemory}` : "> Analyzing user behavior..."}
              </div>
           </div>

           <div className="obsidian-glass rounded-2xl p-4 border border-white/5 flex flex-col gap-4">
              <div className="text-[10px] font-mono text-maya-cyan opacity-50 tracking-widest uppercase">Diagnostic_Pulse</div>
              {[
                { label: 'NEURAL_PULSE', value: appState === 'speaking' ? 92 : 12 },
                { label: 'SYNC_RATE', value: 88 },
                { label: 'EMOTION_HULL', value: 65 }
              ].map(meter => (
                <div key={meter.label}>
                  <div className="flex justify-between text-[9px] font-mono opacity-50 mb-1">
                    <span>{meter.label}</span>
                    <span>{meter.value}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      animate={{ width: `${meter.value}%` }}
                      className="h-full bg-maya-cyan shadow-[0_0_10px_rgba(0,240,255,0.5)]"
                    />
                  </div>
                </div>
              ))}
           </div>
        </aside>
      </div>

      {/* Floating Interaction Controls */}
      <footer className="absolute bottom-0 inset-x-0 z-40 bg-gradient-to-t from-black to-transparent pt-32 pb-10 px-6 sm:px-12 flex flex-col items-center gap-8">
        
        {/* Dynamic Mode Selector */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 obsidian-glass-premium p-1.5 rounded-3xl border border-white/10"
        >
          {PERSONALITY_MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode)}
              className={`p-3 rounded-2xl transition-all ${activeMode.id === mode.id ? 'bg-maya-cyan/20 text-maya-cyan shadow-[0_0_20px_rgba(0,240,255,0.2)]' : 'text-white/40 hover:text-white/80'}`}
              title={mode.name}
            >
              {mode.icon}
            </button>
          ))}
        </motion.div>

        {/* Text Input Drawer */}
        <AnimatePresence>
          {showTextInput && (
            <motion.form 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleTextSubmit}
              className="w-full max-w-md obsidian-glass rounded-2xl p-2 flex items-center gap-2 mb-4 border border-maya-cyan/20"
            >
              <input 
                autoFocus
                className="flex-1 bg-transparent border-none outline-none p-3 text-sm font-sans"
                placeholder="Talk to Maya..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
              <button className="p-3 bg-maya-cyan/10 text-maya-cyan rounded-xl">
                <Send size={18} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-6 w-full max-w-md">
           <button 
             onClick={() => setShowTextInput(!showTextInput)}
             className={`p-5 rounded-3xl obsidian-glass transition-all ${showTextInput ? 'text-maya-cyan border-maya-cyan/40' : 'text-white/40'}`}
           >
             <Keyboard size={24} />
           </button>

           <motion.button
             whileHover={{ scale: 1.02 }}
             whileTap={{ scale: 0.98 }}
             onClick={toggleListening}
             className={`p-1 w-full aspect-auto rounded-[40px] obsidian-glass border-2 flex items-center justify-between py-6 px-8 relative overflow-hidden group ${isSessionActive ? 'border-maya-cyan shadow-[0_0_50px_rgba(0,240,255,0.2)]' : 'border-white/10'}`}
           >
             <div className="relative z-10 flex items-center gap-4">
                <div className={`p-3 rounded-full ${isSessionActive ? 'bg-red-500 animate-pulse' : 'bg-maya-cyan/10'}`}>
                  {isSessionActive ? <MicOff size={20} className="text-white" /> : <Mic size={20} className="text-maya-cyan" />}
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-display font-bold uppercase tracking-widest text-xs">
                    {isSessionActive ? 'Disconnecting...' : 'Neural Link'}
                  </span>
                  <span className="text-[8px] font-mono opacity-50 uppercase tracking-tighter">
                    {isSessionActive ? 'Live Duplex Active' : 'Offline Mode Ready'}
                  </span>
                </div>
             </div>
             
             {isSessionActive && (
               <div className="flex items-center gap-1 h-6">
                 {Array.from({ length: 6 }).map((_, i) => (
                   <motion.div
                     key={i}
                     animate={{ height: [4, 16, 4] }}
                     transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.1 }}
                     className="w-1 bg-maya-cyan rounded-full"
                   />
                 ))}
               </div>
             )}
             
             {isSessionActive && <div className="absolute inset-0 bg-maya-cyan/5 animate-pulse" />}
           </motion.button>

           <button 
             onClick={() => setShowLiveLens(!showLiveLens)}
             className={`p-5 rounded-3xl obsidian-glass transition-all ${showLiveLens ? 'text-maya-cyan border-maya-cyan/40' : 'text-white/40'}`}
           >
             <Video size={24} />
           </button>
        </div>
      </footer>

      {/* Modals & Lens */}
      <AnimatePresence>
        {showLiveLens && (
          <LiveLens 
            onFrame={(f) => liveSessionRef.current?.sendVideoFrame(f)}
            onClose={() => setShowLiveLens(false)}
            externalStream={liveSessionRef.current?.videoStream}
          />
        )}
        {showNameModal && (
          <NameSecurityModal 
            currentName={userName}
            onSave={(n) => { setUserName(n); localStorage.setItem("maya_user_name", n); setShowNameModal(false); }}
            onClose={() => setShowNameModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Maya's Hand / Visual Limb */}
      <MayaCursor x={cursor.x} y={cursor.y} action={cursor.action} />
    </div>
  );
}

function MayaCursor({ x, y, action }: { x: number, y: number, action: string }) {
  return (
    <motion.div
      animate={{ 
        left: `${x}%`, 
        top: `${y}%`,
        scale: action === 'clicking' ? [1, 0.8, 1.2, 1] : 1
      }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="fixed z-[9999] pointer-events-none -translate-x-1/2 -translate-y-1/2"
    >
      {/* Outer Glow */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute inset-0 bg-maya-cyan/20 blur-xl rounded-full w-12 h-12 -ml-6 -mt-6" 
      />
      
      {/* Cinematic Cursor Design */}
      <div className="relative w-8 h-8 flex items-center justify-center">
        {/* Revolving Rings */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 border border-maya-cyan/40 border-dashed rounded-full"
        />
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="absolute inset-2 border border-maya-cyan/60 border-dotted rounded-full"
        />
        
        {/* Center Point */}
        <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_#fff]" />
        
        {/* Action Indicators */}
        {action === 'pointing' && (
           <motion.div 
             initial={{ opacity: 0, scale: 0 }}
             animate={{ opacity: 1, scale: 1 }}
             className="absolute -top-8 text-[8px] font-mono text-maya-cyan bg-black/80 px-2 py-0.5 rounded border border-maya-cyan/30 uppercase tracking-widest"
           >
             Target_Lock
           </motion.div>
        )}
        
        {action === 'clicking' && (
           <motion.div 
             initial={{ opacity: 0, scale: 0.5 }}
             animate={{ opacity: [1, 0], scale: [0.5, 2] }}
             transition={{ duration: 0.5 }}
             className="absolute inset-0 border-2 border-white rounded-full"
           />
        )}
      </div>
      
      {/* Digital Coordinates Display */}
      <div className="absolute top-4 left-6 flex flex-col gap-0.5 whitespace-nowrap">
         <span className="text-[6px] font-mono text-maya-cyan/60 uppercase">X: {x.toFixed(1)}</span>
         <span className="text-[6px] font-mono text-maya-cyan/60 uppercase">Y: {y.toFixed(1)}</span>
      </div>
    </motion.div>
  );
}

function TypingText({ text }: { text: string }) {
  const [displayedText, setDisplayedText] = useState("");
  const [isDone, setIsDone] = useState(false);
  
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, index));
      index++;
      if (index > text.length) {
        clearInterval(interval);
        setIsDone(true);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span className="relative">
      {displayedText}
      {!isDone && <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} className="inline-block w-1.5 h-3.5 bg-maya-cyan ml-0.5 align-middle" />}
    </span>
  );
}

function StreamingText({ text }: { text: string }) {
  const [words, setWords] = useState<string[]>([]);
  
  useEffect(() => {
    const allWords = text.split(" ");
    let index = 0;
    const interval = setInterval(() => {
      setWords(allWords.slice(0, index + 1));
      index++;
      if (index >= allWords.length) clearInterval(interval);
    }, 100); // 100ms per word
    return () => clearInterval(interval);
  }, [text]);

  return <span>{words.join(" ")}</span>;
}

function NeuralOrb({ state, activeColor = "#00F0FF" }: { state: AppState, activeColor?: string }) {
  const isInteracting = state !== 'idle';
  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';
  
  return (
    <div className="relative w-80 h-80 flex items-center justify-center reels-zoom-in">
      {/* Cinematic HUD Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="hud-ring w-[100%] h-[100%] opacity-20 border-[0.5px]" />
        <div className={`hud-ring hud-ring-active w-[95%] h-[95%] opacity-30 ${isSpeaking ? 'border-dashed' : ''}`} />
        <div className="hud-ring hud-ring-inner w-[85%] h-[85%] opacity-40" />
        <div className="hud-ring w-[75%] h-[75%] opacity-10 border-maya-cyan/50 rotate-45" />
      </div>

      {/* Background Glow */}
      <AnimatePresence>
        {isInteracting && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0.1, 0.4, 0.1], scale: [1, 1.2, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{ backgroundColor: activeColor }}
            className="absolute inset-0 rounded-full blur-[80px]"
          />
        )}
      </AnimatePresence>

      {/* Core AI Orb */}
      <motion.div 
        animate={{ 
          scale: isInteracting ? [1, 1.05, 1] : 1,
          rotate: isSpeaking ? 360 : 0
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="relative w-64 h-64 flex items-center justify-center p-4"
      >
        <motion.div 
          animate={{ 
            borderRadius: ["40% 60% 70% 30% / 40% 50% 60% 50%", "50% 50% 30% 70% / 50% 60% 40% 40%", "40% 60% 70% 30% / 40% 50% 60% 50%"],
            scale: isSpeaking ? [1, 1.1, 1] : 1
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          style={{ 
            background: `radial-gradient(circle at 30% 30%, ${activeColor} 0%, transparent 80%)`,
            boxShadow: isSpeaking ? `0 0 120px -20px ${activeColor}` : `0 0 80px -40px ${activeColor}`
          }}
          className="w-full h-full obsidian-glass orb-pulse overflow-hidden rounded-[40%] border border-white/20 relative z-10"
        >
          {/* Inner Neural Lights */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.8)_100%)]" />
          
          <AnimatePresence mode="wait">
             <motion.div 
               key={state}
               initial={{ opacity: 0, scale: 0.8 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 1.2 }}
               className="absolute inset-0 flex items-center justify-center"
             >
                <span className="text-white/30 font-display font-black uppercase tracking-[0.4em] text-[9px] mb-2">{state}</span>
             </motion.div>
          </AnimatePresence>

          {/* Listening Glows (Eye simulation) */}
          {isListening && (
            <div className="absolute inset-0 flex items-center justify-evenly pointer-events-none opacity-50">
               <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-2 h-0.5 bg-maya-cyan blur-[2px] rounded-full" />
               <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-2 h-0.5 bg-maya-cyan blur-[2px] rounded-full" />
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Circular Waveform Dock */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
         <motion.div 
           animate={{ rotate: -360 }}
           transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
           className="w-full h-full border border-maya-cyan/5 border-dotted rounded-full"
         />
      </div>

      {/* Visualizer Bars (Reels High-End Style) */}
      <div className="absolute inset-0 flex items-center justify-center gap-1 pointer-events-none rotate-45">
          {Array.from({ length: 4 }).map((_, j) => (
             <div key={j} className="absolute inset-0" style={{ transform: `rotate(${j * 90}deg)` }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-end gap-[2px]">
                   {Array.from({ length: 8 }).map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ 
                          height: isSpeaking ? [2, Math.random() * 40 + 5, 2] : 2,
                          opacity: isSpeaking ? [0.3, 1, 0.3] : 0.1
                        }}
                        transition={{ duration: 0.3, repeat: Infinity, delay: i * 0.05 }}
                        className="w-[2px] bg-maya-cyan rounded-full"
                      />
                   ))}
                </div>
             </div>
          ))}
      </div>
    </div>
  );
}
