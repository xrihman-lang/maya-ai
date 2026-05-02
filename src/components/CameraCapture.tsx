import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, Zap, CameraOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const startCamera = async () => {
    try {
      setError(null);
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Camera access denied or not available. Please check permissions.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const takePhoto = () => {
    if (!videoRef.current || isCapturing) return;
    
    setIsCapturing(true);
    const video = videoRef.current;
    
    // Create a temporary canvas
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw the video frame to the canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to base64 string for Gemini
      const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      
      // Send the image to the parent (Maya AI)
      onCapture(base64Image);
      
      // Visual feedback and close
      setTimeout(() => {
        stopCamera();
        onClose();
      }, 300);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl"
    >
      <div className="relative max-w-2xl w-full flex flex-col bg-[#050505] rounded-[2rem] overflow-hidden border border-red-500/20 shadow-[0_0_80px_rgba(220,38,38,0.15)]">
        
        {/* Header Area */}
        <div className="p-6 flex items-center justify-between border-b border-white/5">
           <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.8)]" />
              <h2 className="text-sm font-bold tracking-[0.2em] uppercase text-red-500/80">Maya Live Lens</h2>
           </div>
           <button 
             onClick={onClose}
             className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors"
           >
             <X size={20} />
           </button>
        </div>

        <div className="relative aspect-video bg-black overflow-hidden group">
          <AnimatePresence mode="wait">
            {!isCameraOpen && error ? (
              <motion.div 
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                  <CameraOff size={32} className="text-red-500" />
                </div>
                <p className="text-red-200 font-medium mb-2">Camera Access Denied</p>
                <p className="text-white/40 text-xs mb-6 max-w-xs">{error}</p>
                <button 
                  onClick={onClose}
                  className="px-8 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-full transition-all"
                >
                  Close Lens
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="camera"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative w-full h-full"
              >
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }} // Mirror view
                />
                
                {/* Flash overlay */}
                {isCapturing && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white z-[60]"
                  />
                )}

                {/* Grid Overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-20">
                  <div className="absolute top-1/3 w-full h-px bg-white/20" />
                  <div className="absolute top-2/3 w-full h-px bg-white/20" />
                  <div className="absolute left-1/3 h-full w-px bg-white/20" />
                  <div className="absolute left-2/3 h-full w-px bg-white/20" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Area with Capture Button */}
        <div className="p-8 bg-gradient-to-t from-black via-[#050505] to-transparent flex flex-col items-center gap-6">
           {isCameraOpen && (
             <motion.button
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.9 }}
               onClick={takePhoto}
               disabled={isCapturing}
               className="group relative flex items-center gap-3 bg-red-600 hover:bg-red-500 text-white px-10 py-4 rounded-full font-bold uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(220,38,38,0.4)] transition-all"
             >
               <Camera size={20} className={isCapturing ? "animate-spin" : ""} />
               <span>{isCapturing ? "Processing..." : "Capture Photo"}</span>
               
               {/* Pulsing decoration */}
               <span className="absolute inset-0 rounded-full border-2 border-white/20 animate-ping opacity-20" />
             </motion.button>
           )}
           
           <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-medium">
             Maya AI Visual Recognition Engine
           </p>
        </div>
      </div>
    </motion.div>
  );
}
