import React, { useState } from 'react';
import { signInWithGoogle } from '../firebase';
import { motion } from 'motion/react';
import { LogIn, AlertCircle } from 'lucide-react';

export default function Login() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setError(null);
      setIsLoading(true);
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to sign in with Google. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] w-screen bg-[#050505] text-white flex flex-col items-center justify-center font-sans relative overflow-hidden m-0 p-0">
      {/* Cinematic Background Gradients */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-violet-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-pink-900/20 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 flex flex-col items-center gap-8 p-8 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md shadow-2xl max-w-md w-full mx-4 text-center"
      >
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 flex items-center justify-center font-bold text-4xl shadow-[0_0_30px_rgba(139,92,246,0.5)]">
          M
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-serif font-medium tracking-wide">Maya</h1>
          <p className="text-white/60">Your Personal AI Assistant</p>
        </div>

        {error && (
          <div className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-left">
            <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full group relative flex items-center justify-center gap-3 px-8 py-4 rounded-full font-medium tracking-wide transition-all duration-300 bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
          <span>{isLoading ? "Signing in..." : "Sign in with Google"}</span>
        </button>
      </motion.div>
    </div>
  );
}
