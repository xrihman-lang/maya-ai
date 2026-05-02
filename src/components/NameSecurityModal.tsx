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
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<'verify' | 'setup' | 'change'>('setup');

  useEffect(() => {
    const savedPass = localStorage.getItem("maya_user_password");
    if (savedPass && currentName !== "User") {
      setIsLocked(true);
      setStep('verify');
    } else {
      setStep('setup');
    }
  }, [currentName]);

  const handleVerify = () => {
    const savedPass = localStorage.getItem("maya_user_password");
    if (password === savedPass) {
      setStep('change');
      setError("");
      setPassword(""); // Clear for new password entry if needed
    } else {
      setError("Incorrect Password! Maya doesn't recognize you.");
    }
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter a name.");
      return;
    }

    // Special check for 'Zishan'
    if (trimmedName.toLowerCase() === "zishan") {
      setError("Pehle se yeh naam use hai, iske aage koi number lagao (e.g. Zishan001)");
      return;
    }

    if (step === 'setup' || step === 'change') {
      if (password.length < 4) {
        setError("Password must be at least 4 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match!");
        return;
      }
      
      localStorage.setItem("maya_user_password", password);
      onSave(trimmedName);
      onClose();
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
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
              {step === 'verify' ? <Lock className="text-red-500" size={32} /> : <User className="text-red-500" size={32} />}
            </div>
          </div>

          <h2 className="text-xl font-bold text-center mb-2 tracking-tight">
            {step === 'verify' ? 'Identity Verification' : 'Profile Security'}
          </h2>
          <p className="text-white/40 text-xs text-center mb-8 px-4">
            {step === 'verify' 
              ? 'Enter your secret password to unlock your profile.' 
              : 'Set a name and a password so Maya always remembers you.'}
          </p>

          <div className="space-y-4">
            {(step === 'setup' || step === 'change') && (
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
                placeholder={step === 'verify' ? "Enter Password" : "New Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
              />
            </div>

            {(step === 'setup' || step === 'change') && (
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
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-red-500 text-[10px] uppercase tracking-widest font-bold text-center"
              >
                {error}
              </motion.p>
            )}
          </div>

          <div className="mt-8 flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={step === 'verify' ? handleVerify : handleSave}
              className="flex-3 py-4 bg-red-600 hover:bg-red-500 rounded-2xl text-sm font-bold shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all flex items-center justify-center gap-2"
            >
              {step === 'verify' ? (
                <>Unlock <ShieldCheck size={18} /></>
              ) : (
                <>Save Profile <Check size={18} /></>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
