import { useState, useRef, useEffect } from 'react';
import { Camera, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { ImageWithFallback } from './components/figma/ImageWithFallback';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [overlayEffect, setOverlayEffect] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Initialize camera
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 1280, height: 720 }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraReady(true);
          setUseFallback(false);
        }
      } catch (err) {
        console.error('Camera access error:', err);
        // Use fallback mode with placeholder image
        setUseFallback(true);
        setIsCameraReady(true);
      }
    };

    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    // Simulate AI overlay effect based on prompt
    if (prompt.toLowerCase().includes('スパイダーマン') || prompt.toLowerCase().includes('spider')) {
      setOverlayEffect('spiderman');
    } else if (prompt.toLowerCase().includes('ネコ') || prompt.toLowerCase().includes('猫') || prompt.toLowerCase().includes('cat')) {
      setOverlayEffect('cat');
    } else if (prompt.toLowerCase().includes('ロボット') || prompt.toLowerCase().includes('robot')) {
      setOverlayEffect('robot');
    } else if (prompt.toLowerCase().includes('宇宙') || prompt.toLowerCase().includes('space')) {
      setOverlayEffect('space');
    } else if (prompt) {
      setOverlayEffect('generic');
    } else {
      setOverlayEffect('');
    }
  }, [prompt]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/png');
        setCapturedImage(imageData);
        
        // Reset after 2 seconds
        setTimeout(() => setCapturedImage(null), 2000);
      }
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Camera Video Background or Fallback Image */}
      {useFallback ? (
        <div className="absolute inset-0 w-full h-full">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1559674850-47859f577fba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZXJzb24lMjBwb3J0cmFpdCUyMHNlbGZpZXxlbnwxfHx8fDE3NjEzMDU5MjB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt="Camera Preview"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* AI Overlay Effects */}
      <AnimatePresence>
        {overlayEffect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 pointer-events-none"
          >
            {overlayEffect === 'spiderman' && (
              <div className="absolute inset-0 bg-gradient-to-b from-red-600/30 via-transparent to-blue-900/30">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 35px, rgba(255,255,255,0.1) 35px, rgba(255,255,255,0.1) 36px), repeating-linear-gradient(90deg, transparent, transparent 35px, rgba(255,255,255,0.1) 35px, rgba(255,255,255,0.1) 36px)'
                }} />
              </div>
            )}
            {overlayEffect === 'cat' && (
              <div className="absolute inset-0">
                <div className="absolute top-20 left-1/2 -translate-x-1/2 flex gap-20">
                  <motion.div
                    animate={{ rotate: [-5, 5, -5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-0 h-0 border-l-[40px] border-l-transparent border-r-[40px] border-r-transparent border-b-[80px] border-b-pink-400/70"
                    style={{ filter: 'drop-shadow(0 0 10px rgba(236, 72, 153, 0.5))' }}
                  />
                  <motion.div
                    animate={{ rotate: [5, -5, 5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-0 h-0 border-l-[40px] border-l-transparent border-r-[40px] border-r-transparent border-b-[80px] border-b-pink-400/70"
                    style={{ filter: 'drop-shadow(0 0 10px rgba(236, 72, 153, 0.5))' }}
                  />
                </div>
              </div>
            )}
            {overlayEffect === 'robot' && (
              <div className="absolute inset-0 bg-cyan-500/20">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)',
                  backgroundSize: '20px 20px'
                }} />
                <motion.div
                  animate={{ scaleX: [0, 1, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute top-1/3 left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.8)]"
                />
              </div>
            )}
            {overlayEffect === 'space' && (
              <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-blue-900/40 to-black/40">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ 
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0.5],
                      x: Math.random() * window.innerWidth,
                      y: Math.random() * window.innerHeight
                    }}
                    transition={{
                      duration: 2 + Math.random() * 2,
                      repeat: Infinity,
                      delay: Math.random() * 2
                    }}
                    className="absolute w-2 h-2 bg-white rounded-full"
                    style={{ filter: 'blur(1px)' }}
                  />
                ))}
              </div>
            )}
            {overlayEffect === 'generic' && (
              <motion.div
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-gradient-to-br from-[#00AEEF]/30 via-transparent to-purple-500/30"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Capture Flash Effect */}
      <AnimatePresence>
        {capturedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 bg-white pointer-events-none z-50"
          />
        )}
      </AnimatePresence>

      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <Sparkles className="w-7 h-7 text-[#00AEEF]" />
          <h1 className="text-white tracking-wide">AI Camera Filter</h1>
        </motion.div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 via-black/60 to-transparent px-6 pb-8 pt-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col items-center gap-6"
        >
          {/* Text Input */}
          <div className="w-full max-w-md relative">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="プロンプトを入力…"
              className="w-full bg-white/10 backdrop-blur-lg border-white/20 text-white placeholder:text-white/50 rounded-full px-6 py-6 focus:border-[#00AEEF] focus:ring-[#00AEEF]/50 transition-all"
            />
            {prompt && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                <Sparkles className="w-5 h-5 text-[#00AEEF]" />
              </motion.div>
            )}
          </div>

          {/* Capture Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleCapture}
            disabled={!isCameraReady}
            className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-lg border-4 border-white shadow-lg flex items-center justify-center hover:bg-white/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-2 rounded-full bg-[#00AEEF]"
            />
            <Camera className="w-8 h-8 text-white relative z-10" />
          </motion.button>

          {/* Helper Text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: prompt ? 1 : 0.5 }}
            className="text-white/70 text-center text-sm px-4"
          >
            {prompt ? 'AIがリアルタイムで変換中...' : 'プロンプトを入力してフィルターを適用'}
          </motion.p>
        </motion.div>
      </div>

      {/* Camera Loading State */}
      {!isCameraReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Camera className="w-12 h-12 text-[#00AEEF]" />
          </motion.div>
        </div>
      )}
    </div>
  );
}
