import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Code2, Gamepad2, Cpu, Terminal, Sparkles, Binary } from 'lucide-react';

export default function WelcomePage({ onEnter }: { onEnter: () => void }) {
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Simulate loading
    const duration = 3000;
    const interval = 30;
    let current = 0;
    const timer = setInterval(() => {
      current += (100 / (duration / interval));
      if (current >= 100) {
        current = 100;
        setLoadingComplete(true);
        clearInterval(timer);
      }
      setProgress(Math.floor(current));
    }, interval);

    return () => clearInterval(timer);
  }, []);

  const handleEnter = () => {
    setExiting(true);
    setTimeout(() => {
      onEnter();
    }, 1000);
  };

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          key="welcome-page"
          initial={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
          transition={{ duration: 1, ease: 'easeInOut' }}
          className="fixed inset-0 z-[99999] bg-black text-white overflow-hidden flex flex-col items-center justify-center font-sans"
        >
          {/* Background Lighting & Particles */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Ambient glows */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-maya-cyan/20 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
            
            {/* Digital Grid / Lines */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_20%,transparent_100%)]" />

            {/* Floating Tech/Game Icons */}
            {[
              { Icon: Cpu, color: 'text-maya-cyan', size: 32 },
              { Icon: Gamepad2, color: 'text-purple-500', size: 40 },
              { Icon: Code2, color: 'text-white/40', size: 28 },
              { Icon: Terminal, color: 'text-maya-cyan/60', size: 36 },
              { Icon: Binary, color: 'text-purple-400', size: 24 },
              { Icon: Sparkles, color: 'text-yellow-400', size: 20 },
            ].map((item, idx) => (
              <motion.div
                key={`icon-${idx}`}
                className={`absolute ${item.color} opacity-20`}
                initial={{
                  x: Math.random() * window.innerWidth,
                  y: Math.random() * window.innerHeight,
                  rotate: Math.random() * 360,
                }}
                animate={{
                  x: [null, Math.random() * window.innerWidth],
                  y: [null, Math.random() * window.innerHeight],
                  rotate: [null, Math.random() * 360 + 180],
                }}
                transition={{
                  duration: Math.random() * 20 + 20,
                  repeat: Infinity,
                  ease: "linear"
                }}
              >
                <item.Icon size={item.size} />
              </motion.div>
            ))}

            {/* Floating Particles */}
            {Array.from({ length: 30 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-maya-cyan rounded-full shadow-[0_0_8px_#00f0ff]"
                initial={{
                  x: Math.random() * window.innerWidth,
                  y: Math.random() * window.innerHeight,
                  opacity: Math.random() * 0.5 + 0.1,
                  scale: Math.random() * 2 + 0.5
                }}
                animate={{
                  y: [null, Math.random() * window.innerHeight - 200],
                  opacity: [null, Math.random() * 0.8 + 0.2, 0],
                  scale: [null, Math.random() * 3]
                }}
                transition={{
                  duration: Math.random() * 5 + 3,
                  repeat: Infinity,
                  ease: "linear",
                  delay: Math.random() * 2
                }}
              />
            ))}
          </div>

          <motion.div 
            animate={{ y: [-10, 10, -10] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="relative z-10 flex flex-col items-center justify-center w-full max-w-4xl px-4 text-center"
          >
            {/* Logo Container */}
            <motion.div
              initial={{ scale: 0.1, filter: 'blur(30px)', opacity: 0 }}
              animate={{ scale: 1, filter: 'blur(0px)', opacity: 1 }}
              transition={{ duration: 2, ease: "easeOut" }}
              className="relative mb-8"
            >
              {/* Outer Glow */}
              <motion.div 
                animate={{ 
                  boxShadow: ["0 0 40px rgba(0, 240, 255, 0.4)", "0 0 100px rgba(168, 85, 247, 0.6)", "0 0 40px rgba(0, 240, 255, 0.4)"] 
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute inset-0 rounded-full"
              />
              {/* Light Streak Sweep Effect */}
              <div className="absolute inset-0 overflow-hidden rounded-full mask-image-radial z-20 pointer-events-none">
                <motion.div 
                  initial={{ x: '-100%', skewX: -20 }}
                  animate={{ x: '200%' }}
                  transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
                  className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent"
                />
              </div>

              <img 
                src="https://i.postimg.cc/CM7ygX2m/GDX-BARND-LOGO.jpg" 
                alt="GDX MAYA NAGRI LOGO" 
                className="w-40 h-40 md:w-56 md:h-56 rounded-full object-cover border-2 border-maya-cyan/50 shadow-[0_0_50px_rgba(0,240,255,0.3)] relative z-10"
              />
            </motion.div>

            {/* Text Elements */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1.5 }}
              className="space-y-4"
            >
              <h2 className="text-sm md:text-lg font-mono tracking-[0.5em] text-white/60 uppercase">Welcome To</h2>
              <h1 className="text-4xl md:text-7xl font-display font-black tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-maya-cyan via-purple-400 to-maya-cyan drop-shadow-[0_0_15px_rgba(0,240,255,0.5)]">
                GDX MAYA NAGRI
              </h1>
              
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.5 }}
                className="flex items-center justify-center py-4"
              >
                <div className="flex flex-wrap justify-center gap-2 md:gap-4 text-xs md:text-sm font-mono tracking-widest text-white/50">
                  <span className="text-maya-cyan hover:text-white transition-colors duration-300">WEB DEVELOPER</span>
                  <span className="opacity-50">|</span>
                  <span className="text-purple-400 hover:text-white transition-colors duration-300">GAME DEVELOPER</span>
                  <span className="opacity-50">|</span>
                  <span className="text-maya-cyan hover:text-white transition-colors duration-300">AI DEVELOPER</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Loading / Enter Button */}
            <div className="mt-12 h-16 flex items-center justify-center">
              {!loadingComplete ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="text-xl font-mono text-maya-cyan/80 drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]">{progress}%</div>
                  <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-maya-cyan to-purple-500 shadow-[0_0_10px_#00f0ff]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(0, 240, 255, 0.6)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleEnter}
                  className="px-12 py-4 rounded-full border border-maya-cyan bg-maya-cyan/10 text-maya-cyan font-bold tracking-[0.3em] text-lg uppercase backdrop-blur-md transition-all duration-300 hover:bg-maya-cyan/20 hover:text-white"
                >
                  ENTER
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
