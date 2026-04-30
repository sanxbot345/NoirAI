import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CameraOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageData: string) => void;
}

export default function CameraOverlay({ isOpen, onClose, onCapture }: CameraOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isShutterActive, setIsShutterActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      let newStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode },
          audio: false
        });
      } catch (fallbackErr) {
        console.warn("Kesalahan menghadap kamera tertentu, mencoba pengaturan default...", fallbackErr);
        // Fallback: This is often needed on desktops/laptops which don't support facingMode constraints well
        newStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }
      
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Tidak dapat mengakses kamera: " + (err as Error).message);
      onClose();
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const playShutterSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/707/707-preview.mp3');
    audio.play().catch(e => console.error("Sound play failed", e));
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Since we want NO MIRRORING, and by default 'user' facing mode IS mirrored by video element scaleX(-1) often,
        // we make sure the context is drawn correctly.
        // Actually, CSS scaleX(-1) only affects preview. Drawing to canvas is usually natural.
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        setIsShutterActive(true);
        playShutterSound();
        
        setTimeout(() => {
          setIsShutterActive(false);
          onCapture(dataUrl);
          onClose();
        }, 200);
      }
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Camera Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'none' }}
      />

      {/* Focus Brackets */}
      <div className="relative w-64 h-64 border border-white/20 pointer-events-none z-10">
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white" />
        <motion.div 
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-1 h-1 bg-white rounded-full shadow-[0_0_8px_white]" />
        </motion.div>
      </div>

      {/* Shutter Flash Animation */}
      <AnimatePresence>
        {isShutterActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white z-[100] pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Interface Overlay */}
      <div className="absolute inset-0 flex flex-col justify-between p-8 z-20 bg-gradient-to-b from-black/40 via-transparent to-black/60">
        <div className="flex justify-between items-start">
          <button 
            onClick={onClose}
            className="p-4 frosted-glass rounded-full text-white hover:bg-white/20 transition-all active:scale-90"
          >
            <X size={24} />
          </button>
          
          <div className="frosted-glass py-2 px-4 rounded-full border border-white/20">
            <h1 className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/80">Rec Mode</h1>
          </div>

          <button 
            onClick={toggleCamera}
            className="p-4 frosted-glass rounded-full text-white hover:bg-white/20 transition-all active:scale-90"
          >
            <RefreshCw size={24} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-6 pb-12">
          <div className="text-[10px] text-white/60 uppercase tracking-[0.4em] font-medium">
            Photo
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={capturePhoto}
            className="w-24 h-24 rounded-full bg-white border-[8px] border-white/20 flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all"
          >
            <div className="w-full h-full rounded-full border-2 border-black flex items-center justify-center">
              <Camera className="text-black" size={32} />
            </div>
          </motion.button>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </motion.div>
  );
}

