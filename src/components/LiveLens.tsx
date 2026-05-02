import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Maximize2, Minimize2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LiveLensProps {
  onFrame?: (base64Image: string) => void;
  onClose: () => void;
}

export default function LiveLens({ onFrame, onClose }: LiveLensProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLive, setIsLive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSmartVision, setIsSmartVision] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const startCamera = async () => {
    try {
      // Stop existing tracks
      if (videoRef.current && videoRef.current.srcObject) {
         const stream = videoRef.current.srcObject as MediaStream;
         stream.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode, 
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsLive(true);
      }
    } catch (err) {
      setError("Camera access denied.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsLive(false);
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Interval for sending frames to Maya
  useEffect(() => {
    if (!isLive || !onFrame || !isSmartVision) return;
    
    const interval = setInterval(() => {
      if (videoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = 320; // Reduced resolution for faster API processing
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Draw and mirror if front camera
          if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
          onFrame(base64);
        }
      }
    }, 5000); // Analyze every 5 seconds to manage quota and flow

    return () => clearInterval(interval);
  }, [isLive, onFrame, isSmartVision, facingMode]);

  return (
    <motion.div 
      drag={isMinimized}
      dragConstraints={{ left: -300, right: 300, top: -500, bottom: 500 }}
      layout
      className={`fixed z-[150] transition-all duration-500 overflow-hidden ${
        isMinimized 
          ? "bottom-24 right-6 w-48 aspect-video rounded-2xl shadow-2xl border border-red-500/30" 
          : "inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md"
      }`}
    >
      <div className={`relative ${isMinimized ? "w-full h-full" : "max-w-xl w-full aspect-video rounded-3xl border border-white/10 overflow-hidden shadow-2xl bg-black"}`}>
        {!isLive && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw className="animate-spin text-red-500" size={32} />
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <X className="text-red-500 mb-2" size={32} />
            <p className="text-white/60 text-sm">{error}</p>
          </div>
        )}

        <video 
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
        />

        {/* HUD Overlay */}
        <div className="absolute inset-0 pointer-events-none border border-red-500/20">
           <div className="absolute top-4 left-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] tracking-widest text-red-100 uppercase font-bold drop-shadow-md">Live Stream</span>
              </div>
              {isSmartVision && (
                <div className="flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded text-[8px] text-blue-300 uppercase font-bold">
                   Maya Vision Active
                </div>
              )}
           </div>
        </div>

        {/* Controls */}
        <div className="absolute top-4 right-4 flex gap-2 pointer-events-auto">
          <button 
            onClick={() => setIsSmartVision(!isSmartVision)}
            className={`p-1.5 rounded-full border transition-colors ${isSmartVision ? "bg-blue-600/40 border-blue-500 text-white" : "bg-black/40 border-white/10 text-white/30"}`}
            title={isSmartVision ? "Disable AI Vision" : "Enable AI Vision"}
          >
            <Zap size={16} />
          </button>
          <button 
            onClick={toggleCamera}
            className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white/50 hover:text-white transition-colors border border-white/10"
            title="Switch Camera"
          >
            <RefreshCw size={16} className={!isLive ? "animate-spin" : ""} />
          </button>
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white/50 hover:text-white transition-colors border border-white/10"
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white/50 hover:text-white transition-colors border border-white/10"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
