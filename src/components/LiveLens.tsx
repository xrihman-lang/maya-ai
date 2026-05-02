import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LiveLensProps {
  onFrame?: (base64Image: string) => void;
  onClose: () => void;
}

export default function LiveLens({ onFrame, onClose }: LiveLensProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLive, setIsLive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user', 
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
  }, []);

  // Interval for sending frames if needed
  useEffect(() => {
    if (!isLive || !onFrame) return;
    
    const interval = setInterval(() => {
      if (videoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0);
          const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
          onFrame(base64);
        }
      }
    }, 2000); // Send every 2 seconds

    return () => clearInterval(interval);
  }, [isLive, onFrame]);

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
          className="w-full h-full object-cover mirror"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* HUD Overlay */}
        <div className="absolute inset-0 pointer-events-none border border-red-500/20">
           <div className="absolute top-4 left-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] tracking-widest text-red-100 uppercase font-bold drop-shadow-md">Live Stream</span>
           </div>
        </div>

        {/* Controls */}
        <div className="absolute top-4 right-4 flex gap-2 pointer-events-auto">
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white/50 hover:text-white transition-colors"
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white/50 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
