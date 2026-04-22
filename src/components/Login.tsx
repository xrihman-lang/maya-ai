import React, { useState } from 'react';
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react';
import { signInWithGoogle, logInWithEmail, signUpWithEmail } from '../firebase';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error('Google Login Error:', err);
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await logInWithEmail(email, password);
      }
    } catch (err: any) {
      console.error('Email Auth Error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password login is not enabled in your Firebase console. Please enable it first.');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen text-gray-200 antialiased flex flex-col items-center justify-center p-4 bg-[#0a0a0a]"
      style={{
        backgroundImage: "url('https://picsum.photos/seed/cyber-anime/1920/1080?blur=4')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div 
        className="p-8 md:p-12 rounded-3xl max-w-md w-full text-center border-t-4 relative overflow-hidden"
        style={{
          background: 'rgba(10, 10, 10, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderColor: 'rgba(212, 175, 55, 0.2)',
          borderTopColor: '#D4AF37',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div className="absolute -top-10 -left-10 w-32 h-32 blur-3xl rounded-full" style={{ backgroundColor: 'rgba(212, 175, 55, 0.2)' }}></div>
        
        <h1 className="text-3xl font-bold mb-2 font-serif tracking-widest uppercase relative z-10" style={{ color: '#D4AF37' }}>
          Maya AI
        </h1>
        <p className="text-gray-400 text-sm mb-10 relative z-10">Secure Gateway Portal</p>
        
        {error && (
          <div className="relative z-10 mb-6 text-red-400 text-sm p-3 bg-red-950/50 rounded-lg border border-red-500/50">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6 relative z-10 text-left">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="email" 
              placeholder="Email Address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-[#D4AF37]/50 transition-colors text-sm"
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-[#D4AF37]/50 transition-colors text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-white/5 border border-white/10 hover:border-[#D4AF37]/50 text-white font-medium rounded-xl transition-all flex justify-center items-center gap-2 hover:bg-white/10 disabled:opacity-50 text-sm"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
            ) : isSignUp ? (
              <><UserPlus className="w-4 h-4" /> Create Account</>
            ) : (
              <><LogIn className="w-4 h-4" /> Log In</>
            )}
          </button>
        </form>

        <div className="relative flex items-center py-2 mb-6 z-10">
          <div className="flex-grow border-t border-white/10"></div>
          <span className="flex-shrink-0 mx-4 text-gray-500 text-[10px] uppercase tracking-widest">Or access with</span>
          <div className="flex-grow border-t border-white/10"></div>
        </div>

        <button 
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="relative z-10 w-full py-3.5 px-4 bg-gradient-to-r from-[#B4942D] to-[#D4AF37] hover:from-[#D4AF37] hover:to-[#FBBF24] text-black font-bold rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all flex justify-center items-center gap-3 disabled:opacity-50"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-black"></div>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
              Sign In with Google
            </>
          )}
        </button>

        <div className="mt-6 text-center z-10 relative">
          <button 
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
            className="text-gray-500 hover:text-[#D4AF37] text-xs transition-colors"
          >
            {isSignUp ? "Already have clearance? Sign in" : "No clearance? Request access"}
          </button>
        </div>

      </div>
    </div>
  );
}
