import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, signInWithGoogle, logOut } from "../firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { LogOut, Save, Shield, Settings, MessageSquare, AlertCircle } from "lucide-react";

export default function AdminDashboard({ onExit }: { onExit: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings states
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [appVersion, setAppVersion] = useState("1.0.0");
  const [emergencyMessage, setEmergencyMessage] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  
  // Maya Persona config
  const [systemPrompt, setSystemPrompt] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && u.email === "mohdalikhan990x@gmail.com") {
        fetchSettings();
      } else {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const fetchSettings = async () => {
    try {
      // Global config
      try {
        const globalDoc = await getDoc(doc(db, "settings", "global_config"));
        if (globalDoc.exists()) {
          setIsMaintenance(globalDoc.data().isMaintenance || false);
          setAppVersion(globalDoc.data().appVersion || "1.0.0");
          setEmergencyMessage(globalDoc.data().emergencyMessage || "");
        }
      } catch (e: any) { 
        if(!e.message?.includes('offline')) console.error("Global config check failed:", e); 
      }

      // Broadcast
      try {
        const broadcastDoc = await getDoc(doc(db, "settings", "broadcast"));
        if (broadcastDoc.exists()) {
          setBroadcastMessage(broadcastDoc.data().message || "");
        }
      } catch (e: any) { 
        if(!e.message?.includes('offline')) console.error("Broadcast check failed:", e); 
      }

      // Maya config
      try {
        const mayaDoc = await getDoc(doc(db, "settings", "maya_config"));
        if (mayaDoc.exists()) {
          setSystemPrompt(mayaDoc.data().systemPrompt || "");
        }
      } catch (e: any) { 
        if(!e.message?.includes('offline')) console.error("Maya config check failed:", e); 
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || user.email !== "mohdalikhan990x@gmail.com") return;
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "global_config"), {
        isMaintenance,
        appVersion,
        emergencyMessage,
      }, { merge: true });

      await setDoc(doc(db, "settings", "broadcast"), {
        message: broadcastMessage,
        timestamp: Date.now()
      }, { merge: true });

      await setDoc(doc(db, "settings", "maya_config"), {
        systemPrompt,
        updatedAt: Date.now()
      }, { merge: true });

      alert("Settings saved successfully!");
    } catch (e) {
      console.error(e);
      alert("Error saving settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-red-500 font-sans">Loading...</div>;
  }

  if (!user || user.email !== "mohdalikhan990x@gmail.com") {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center font-sans text-white p-6">
        <Shield size={64} className="text-red-500 mb-6" />
        <h1 className="text-2xl font-bold mb-4">Maya Command Center</h1>
        <p className="text-white/60 mb-8 max-w-sm text-center">Protected area. Only authorized administrators can access this panel.</p>
        
        {user ? (
          <div className="flex flex-col items-center gap-4">
            <div className="text-red-400 text-sm">Access Denied for {user.email}</div>
            <button onClick={logOut} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg">Sign Out</button>
            <button onClick={onExit} className="text-white/50 hover:text-white mt-4 underline text-sm">Back to Chat</button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <button onClick={signInWithGoogle} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-lg transition-colors">
              Admin Login (Google)
            </button>
            <button onClick={onExit} className="text-white/50 hover:text-white mt-4 underline text-sm">Back to Chat</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10 mb-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Shield className="text-red-500" />
            <h1 className="text-xl font-bold">Maya Control Panel</h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={onExit} className="text-white/60 hover:text-white text-sm">Exit</button>
            <button onClick={logOut} className="bg-red-950 hover:bg-red-900 border border-red-900/50 p-2 rounded-lg text-red-200 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Global System Settings */}
          <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-2xl shadow-xl">
            <div className="flex items-center gap-2 mb-6 text-red-400">
              <Settings size={20} />
              <h2 className="text-lg font-semibold">Global Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                <div>
                  <h3 className="font-medium text-white/90">Maintenance Mode</h3>
                  <p className="text-xs text-white/50">Lock out public users</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={isMaintenance} onChange={e => setIsMaintenance(e.target.checked)} />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">App Version</label>
                <input 
                  type="text" 
                  value={appVersion}
                  onChange={e => setAppVersion(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 p-3 rounded-xl focus:border-red-500 focus:outline-none text-sm" 
                  placeholder="e.g. 2.5.0"
                />
              </div>

            </div>
          </div>

          {/* Broadcasts & Alerts */}
          <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-2xl shadow-xl">
            <div className="flex items-center gap-2 mb-6 text-orange-400">
              <AlertCircle size={20} />
              <h2 className="text-lg font-semibold">Announcements</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Global Broadcast (Pop-up)</label>
                <input 
                  type="text" 
                  value={broadcastMessage}
                  onChange={e => setBroadcastMessage(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 p-3 rounded-xl focus:border-orange-500 focus:outline-none text-sm" 
                  placeholder="Type announcement here..."
                />
                <p className="text-[10px] text-white/40 mt-1">Leaves a pop-up alert at the top of the chat.</p>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">Emergency Ribbon (Header)</label>
                <input 
                  type="text" 
                  value={emergencyMessage}
                  onChange={e => setEmergencyMessage(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 p-3 rounded-xl focus:border-orange-500 focus:outline-none text-sm" 
                  placeholder="e.g. Servers are currently slow..."
                />
                <p className="text-[10px] text-white/40 mt-1">Shows a pulsing red ribbon over the visualizer.</p>
              </div>
            </div>
          </div>

          {/* Maya Persona & Logic (Full Width) */}
          <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-2xl shadow-xl md:col-span-2">
            <div className="flex items-center gap-2 mb-6 text-purple-400">
              <MessageSquare size={20} />
              <h2 className="text-lg font-semibold">Maya Intelligence & Persona</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Core System Prompt (Behavior Instructions)</label>
                <textarea 
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:border-purple-500 focus:outline-none text-sm min-h-[150px] leading-relaxed" 
                  placeholder="Define Maya's persona, language, structure, and rules... Leave blank to use defaults."
                />
                <p className="text-xs text-white/40 mt-2">
                  This overrides Maya's default AI prompt. You can change her language, witty behavior, and knowledge constraints instantly.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button 
            disabled={saving}
            onClick={handleSave} 
            className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 px-8 py-4 rounded-xl font-medium shadow-2xl transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            <span>{saving ? "Saving Changes..." : "Deploy Config"}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
