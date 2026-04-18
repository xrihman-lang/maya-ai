import React, { useState, useEffect } from "react";
import { auth, db, signInEmailAuth, signInWithGoogle, logOut } from "../firebase";
import { collection, doc, getDocs, onSnapshot, setDoc, updateDoc, collectionGroup, query, orderBy, limit, serverTimestamp } from "firebase/firestore";
import { Users, MessageSquare, Clock, AlertTriangle, LogOut, Loader2, Database, ShieldAlert, Activity } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  messageCount?: number;
}

interface SystemSettings {
  isMaintenance: boolean;
  isUpdating?: boolean;
  appVersion: string;
  emergencyMessage: string;
}

interface LiveActivity {
  id: string;
  userId: string;
  sender: string;
  text: string;
  timestamp: number;
}

export default function AdminDashboard({ onExit }: { onExit: () => void }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Dashboard Data
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({ isMaintenance: false, isUpdating: false, appVersion: "1.0.0", emergencyMessage: "" });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [todaySessions, setTodaySessions] = useState(0);
  const [activeNow, setActiveNow] = useState(0);
  const [liveActivities, setLiveActivities] = useState<LiveActivity[]>([]);
  const [broadcastInput, setBroadcastInput] = useState("");

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (u) {
        if (u.email === "mohdalikhan990x@gmail.com") {
          setIsAdmin(true);
          fetchData();
        } else {
          setIsAdmin(false);
          alert("Access Denied: You are not authorized to view the Admin Dashboard.");
          onExit();
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch Users
      const usersSnap = await getDocs(collection(db, "users"));
      const userList: AdminUser[] = [];
      
      let todayCount = 0;
      let activeCount = 0;
      const startOfDay = new Date().setHours(0,0,0,0);
      const fiveMinsAgo = Date.now() - 5 * 60 * 1000;

      for (const d of usersSnap.docs) {
        const udata = d.data() as AdminUser;
        let count = 0;
        try {
           const maxMessages = await getDocs(collection(db, "users", d.id, "messages"));
           count = maxMessages.size;
           
           const msgs = maxMessages.docs.map(m => m.data() as any);
           todayCount += msgs.filter((m: any) => m.timestamp >= startOfDay).length;
           
           if (msgs.some((m: any) => m.timestamp >= fiveMinsAgo)) {
              activeCount++;
           }
        } catch(e) {}

        userList.push({
          ...udata,
          id: d.id,
          messageCount: count
        });
      }
      setUsers(userList);
      setTodaySessions(todayCount);
      setActiveNow(activeCount);
    } catch (e) {
      console.error("Fetch Data Error", e);
    }
  };

  // Live Activity Listener
  useEffect(() => {
    if (!isAdmin) return;
    try {
      const q = query(collectionGroup(db, "messages"), orderBy("timestamp", "desc"), limit(10));
      const unsub = onSnapshot(q, (snap) => {
        const msgs = snap.docs.map(d => ({
          id: d.id,
          userId: d.ref.parent.parent?.id || "Unknown",
          sender: d.data().sender,
          text: d.data().text,
          timestamp: d.data().timestamp
        }));
        setLiveActivities(msgs);
      }, (err) => {
        console.error("Live Activity Error:", err);
      });
      return () => unsub();
    } catch (e) {
      console.error("Failed to setup collectionGroup query", e);
    }
  }, [isAdmin]);

  // Settings Listener
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(doc(db, "settings", "global_config"), (docSnap: any) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as SystemSettings);
      } else {
        // Initialize settings if they don't exist
        setDoc(docSnap.ref, {
          isMaintenance: false,
          isUpdating: false,
          appVersion: "1.0.0",
          emergencyMessage: ""
        }).catch(console.error);
      }
    });
    return () => unsub();
  }, [isAdmin]);

  const handleUpdateSettings = async (updates: Partial<SystemSettings>) => {
    setSettingsLoading(true);
    try {
      await updateDoc(doc(db, "settings", "global_config"), updates);
    } catch (e) {
      console.error(e);
      alert("Failed to update settings. See console.");
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastInput.trim()) return;
    setSettingsLoading(true);
    try {
      await setDoc(doc(db, "settings", "broadcast"), {
        message: broadcastInput,
        timestamp: serverTimestamp()
      });
      alert("Broadcast sent successfully!");
      setBroadcastInput("");
    } catch (e) {
      console.error(e);
      alert("Failed to send broadcast");
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleClearBroadcast = async () => {
    setSettingsLoading(true);
    try {
      await setDoc(doc(db, "settings", "broadcast"), {
        message: "",
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
      alert("Failed to clear broadcast");
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const cred = await signInEmailAuth(email, password);
      if (cred.user.email !== "mohdalikhan990x@gmail.com") {
        alert("Access Denied: You are not authorized to view the Admin Dashboard.");
        onExit(); // Boot them out immediately
      }
    } catch (e: any) {
      if (e.code === 'auth/operation-not-allowed') {
        setLoginError("Email/Password Auth is disabled in Firebase Console! Please go to Firebase Console -> Authentication -> Sign-in method -> Enable Email/Password. Alternatively, use Google Login.");
      } else {
        setLoginError(e.message || "Login failed");
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const cred = await signInWithGoogle();
      // the auth listener handles checking the email, but we can't easily wait for it without returning a credential from signInWithGoogle,
      // so the useEffect onAuthStateChanged catches it as well.
    } catch (e: any) {
      setLoginError(e.message || "Google Login failed");
    }
  };

  const formatTimeAgo = (ms: number) => {
    const diff = Math.floor((Date.now() - ms) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff/60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)} hr ago`;
    return `${Math.floor(diff/86400)} d ago`;
  };

  if (loading) {
    return <div className="h-[100dvh] w-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-red-500" size={32} /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[100dvh] w-screen bg-[#050505] text-white flex flex-col items-center justify-center font-sans tracking-wide">
        <div className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat opacity-20" style={{ backgroundImage: "url('/maya-bg.jpg')" }} />
        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-red-950/80 via-black to-black pointer-events-none" />

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="z-10 bg-black/50 p-8 rounded-2xl border border-red-900/50 backdrop-blur-xl shadow-2xl max-w-sm w-full mx-4">
          <div className="flex flex-col items-center mb-8 gap-3">
            <ShieldAlert size={40} className="text-red-500" />
            <h1 className="text-2xl font-bold text-red-50">Admin Access</h1>
            <p className="text-sm text-red-400 text-center">Restricted zone. Authorized personnel only.</p>
          </div>

          <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Admin Email" className="bg-red-950/20 border border-red-900/30 rounded-lg px-4 py-3 outline-none focus:border-red-500 placeholder:text-red-900/50 text-red-100" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="bg-red-950/20 border border-red-900/30 rounded-lg px-4 py-3 outline-none focus:border-red-500 placeholder:text-red-900/50 text-red-100" />
            
            {loginError && <p className="text-xs text-red-400 bg-red-950/30 p-2 rounded border border-red-900/50">{loginError}</p>}

            <button type="submit" className="bg-red-600 hover:bg-red-500 text-white font-medium py-3 rounded-lg transition-colors mt-2">Login as Admin</button>
          </form>

          <div className="mt-6 flex flex-col gap-4 items-center">
            <div className="text-xs text-red-800 uppercase tracking-widest text-center flex items-center gap-2">
              <span className="w-8 h-px bg-red-900/50" />
              OR
              <span className="w-8 h-px bg-red-900/50" />
            </div>
            <button onClick={handleGoogleLogin} className="w-full bg-white/5 hover:bg-white/10 text-red-100 border border-red-900/30 font-medium py-3 rounded-lg transition-colors">
              Continue with Google
            </button>
          </div>
          
          <button onClick={onExit} className="mt-8 mx-auto block text-sm text-red-500 hover:text-red-400 transition-colors">Return to App</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#050505] text-white font-sans overflow-y-auto">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 bg-[#050505]/90 backdrop-blur-lg border-b border-red-900/50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Database className="text-red-500" />
          <h1 className="text-xl font-bold tracking-wider text-red-50 hidden sm:block">MAYA COMMAND CENTER</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors">Client View</button>
          <button onClick={logOut} className="flex items-center gap-2 bg-red-950 hover:bg-red-900 border border-red-900/50 px-4 py-2 rounded-md transition-colors text-sm font-medium">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8 pb-20">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay: 0.1}} className="bg-red-950/20 border border-red-900/30 p-6 rounded-2xl flex items-center gap-4">
            <div className="p-4 bg-red-900/20 rounded-xl text-red-500"><Users size={28} /></div>
            <div>
              <p className="text-sm font-medium text-red-400/80 uppercase tracking-widest">Total Users</p>
              <p className="text-3xl font-bold text-red-50 mt-1">{users.length}</p>
            </div>
          </motion.div>
          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay: 0.2}} className="bg-red-950/20 border border-red-900/30 p-6 rounded-2xl flex items-center gap-4">
            <div className="p-4 bg-red-900/20 rounded-xl text-red-500"><MessageSquare size={28} /></div>
            <div>
              <p className="text-sm font-medium text-red-400/80 uppercase tracking-widest">Today's Sessions</p>
              <p className="text-3xl font-bold text-red-50 mt-1">{todaySessions}</p>
            </div>
          </motion.div>
          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay: 0.3}} className="bg-red-950/20 border border-red-900/30 p-6 rounded-2xl flex items-center gap-4">
            <div className="p-4 bg-red-900/20 rounded-xl text-green-500"><Clock size={28} /></div>
            <div>
              <p className="text-sm font-medium text-green-400/80 uppercase tracking-widest">Active Now</p>
              <p className="text-lg font-bold text-green-50 mt-1">{activeNow} Users</p>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Controls Column */}
          <motion.div initial={{opacity:0, x:-20}} animate={{opacity:1, x:0}} transition={{delay: 0.4}} className="lg:col-span-1 space-y-6">
            <div className="bg-[#0a0a0a] border border-red-900/30 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-red-200 mb-6 flex items-center gap-2"><AlertTriangle size={18}/> Remote Control Hub</h2>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-red-950/20 rounded-xl border border-red-900/20">
                  <div>
                    <p className="font-medium text-red-100">Update Toggle</p>
                    <p className="text-xs text-red-400 mt-1">Blocks users during upgrade</p>
                  </div>
                  <button 
                    onClick={() => handleUpdateSettings({ isMaintenance: !settings.isMaintenance })}
                    disabled={settingsLoading}
                    className={`relative w-12 h-6 rounded-full transition-colors ${settings.isMaintenance ? "bg-red-600" : "bg-red-950 border border-red-900/50"}`}
                  >
                    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-all ${settings.isMaintenance ? "translate-x-6" : ""}`} />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-red-300">App Version</label>
                  <div className="flex gap-2">
                    <input 
                      value={settings.appVersion} 
                      onChange={e => setSettings({...settings, appVersion: e.target.value})}
                      className="flex-1 bg-black border border-red-900/50 rounded-lg px-3 py-2 text-red-100 outline-none focus:border-red-500" 
                    />
                    <button 
                      onClick={() => handleUpdateSettings({ appVersion: settings.appVersion })}
                      disabled={settingsLoading}
                      className="bg-red-900/40 border border-red-900/50 px-4 rounded-lg hover:bg-red-800/40 text-red-200 text-sm font-medium transition-colors"
                    >Save</button>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="text-sm font-medium text-red-300">Global Broadcast Alert</label>
                  <textarea 
                    value={broadcastInput} 
                    onChange={e => setBroadcastInput(e.target.value)}
                    placeholder="Type a warning or announcement here..."
                    className="w-full bg-black border border-red-900/50 rounded-lg px-3 py-2 text-red-100 outline-none focus:border-red-500 min-h-[100px] resize-none" 
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSendBroadcast}
                      disabled={settingsLoading || !broadcastInput.trim()}
                      className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-medium py-2 rounded-lg transition-colors text-sm disabled:opacity-50"
                    >
                      Send Alert
                    </button>
                    <button 
                      onClick={handleClearBroadcast}
                      disabled={settingsLoading}
                      className="px-6 bg-red-950/50 border border-red-900/50 hover:bg-red-900 text-red-200 font-medium py-2 rounded-lg transition-colors text-sm"
                    >
                      Clear Alert
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Live Activity Table Column */}
          <motion.div initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} transition={{delay: 0.5}} className="lg:col-span-2">
             <div className="bg-[#0a0a0a] border border-red-900/30 rounded-2xl p-6 h-full flex flex-col">
              <h2 className="text-lg font-bold text-red-200 mb-6 flex items-center gap-2"><Activity size={18}/> Live Activity Table</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-red-900/30 text-xs uppercase tracking-widest text-red-400/80">
                      <th className="pb-4 font-medium">User ID (or Name)</th>
                      <th className="pb-4 font-medium">Last Message</th>
                      <th className="pb-4 font-medium text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveActivities.map((act) => (
                      <tr key={act.id} className="border-b border-red-950/30 last:border-0 hover:bg-red-950/20 transition-colors">
                        <td className="py-4 font-mono text-xs text-red-300">
                          {act.userId.slice(0, 10)}...
                        </td>
                        <td className="py-4 pr-4">
                          <p className={`text-sm ${act.sender === 'maya' ? 'text-violet-400' : 'text-red-100'} line-clamp-1`}>
                            {act.sender === 'maya' ? '🤖 ' : '👤 '} {act.text}
                          </p>
                        </td>
                        <td className="py-4 text-right text-xs text-red-500/80 whitespace-nowrap">
                          {formatTimeAgo(act.timestamp)}
                        </td>
                      </tr>
                    ))}
                    {liveActivities.length === 0 && (
                      <tr><td colSpan={3} className="py-8 text-center text-red-900/50 italic text-sm">No recent activity found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
             </div>
          </motion.div>
        
        </div>
      </main>
    </div>
  );
}
