import React, { useState, useEffect } from 'react';
import { User, Lock, Check, X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NameSecurityModalProps {
  currentName: string;
  onSave: (newName: string) => void;
  onClose: () => void;
}

export default function NameSecurityModal({ currentName, onSave, onClose }: NameSecurityModalProps) {
  const [name, setName] = useState(currentName === "User" ? "" : currentName);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<'signup' | 'login' | 'verify'>('signup');

  useEffect(() => {
    const savedPass = localStorage.getItem("maya_user_password");
    if (savedPass && currentName !== "User") {
      setMode('verify');
    } else {
      setMode('signup');
    }
  }, [currentName]);

  const handleVerify = () => {
    const savedPass = localStorage.getItem("maya_user_password");
    if (password === savedPass) {
      setMode('signup'); // Switch to signup/edit mode after verification
      setError("");
      setPassword(""); 
    } else {
      setError("Incorrect Password! Maya doesn't recognize you.");
    }
  };

  const handleLogin = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || !password) {
      setError("Name and Password required.");
      return;
    }

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, password }),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("maya_user_password", password);
        onSave(trimmedName);
        onClose();
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Server error. Try again later.");
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter a name.");
      return;
    }

    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }
    
    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, password }),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("maya_user_password", password);
        onSave(trimmedName);
        onClose();
      } else {
        setError(data.error || "Signup failed");
      }
    } catch (err) {
      setError("Server error. Try again later.");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="relative max-w-sm w-full bg-[#0a0a0a] rounded-[2rem] border border-red-500/20 shadow-[0_0_50px_rgba(220,38,38,0.2)] overflow-hidden"
      >
        <div className="p-8">
          {mode !== 'verify' && (
            <div className="flex bg-white/5 p-1 rounded-xl mb-6 border border-white/10">
              <button 
                onClick={() => setMode('signup')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'signup' ? 'bg-red-600 text-white' : 'text-white/40'}`}
              >
                Sign Up
              </button>
              <button 
                onClick={() => setMode('login')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'login' ? 'bg-red-600 text-white' : 'text-white/40'}`}
              >
                Login
              </button>
            </div>
          )}

          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
              {mode === 'verify' ? <Lock className="text-red-500" size={32} /> : mode === 'login' ? <ShieldCheck className="text-red-500" size={32} /> : <User className="text-red-500" size={32} />}
            </div>
          </div>

          <h2 className="text-xl font-bold text-center mb-2 tracking-tight">
            {mode === 'verify' ? 'Identity Verification' : mode === 'login' ? 'Welcome Back' : 'Create Profile'}
          </h2>
          <p className="text-white/40 text-[10px] text-center mb-8 px-4 uppercase tracking-widest">
            {mode === 'verify' 
              ? 'Enter secret password to unlock' 
              : mode === 'login' ? 'Enter your details to login' : 'Set a name and secret key'}
          </p>

          <div className="space-y-4">
            {(mode === 'signup' || mode === 'login') && (
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input 
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
                />
              </div>
            )}

            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input 
                type="password"
                placeholder={mode === 'verify' ? "Enter Password" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
              />
            </div>

            {mode === 'signup' && (
              <div className="relative">
                <ShieldCheck size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input 
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
                />
              </div>
            )}

            {error && (
              <motion.p 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-[10px] bg-red-500/10 p-2 rounded-lg border border-red-500/20 font-bold text-center"
              >
                {error}
              </motion.p>
            )}
          </div>

          <div className="mt-8 flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={mode === 'verify' ? handleVerify : mode === 'login' ? handleLogin : handleSave}
              className="flex-2 py-4 bg-red-600 hover:bg-red-500 rounded-2xl text-xs font-bold shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all flex items-center justify-center gap-2"
            >
              {mode === 'verify' ? (
                <>Unlock <Lock size={16} /></>
              ) : mode === 'login' ? (
                <>Login <Check size={16} /></>
              ) : (
                <>Save Profile <Check size={16} /></>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>

  );
}
