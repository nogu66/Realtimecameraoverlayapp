import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Sparkles, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { ImageWithFallback } from './components/figma/ImageWithFallback';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [faceDetections, setFaceDetections] = useState<any[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceDetectorRef = useRef<FaceDetector | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize MediaPipe Face Detector
  useEffect(() => {
    const initFaceDetector = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO'
        });
        faceDetectorRef.current = detector;
      } catch (error) {
        console.error('Failed to initialize face detector:', error);
      }
    };

    initFaceDetector();
  }, []);

  // Initialize camera
  useEffect(() => {
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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Face detection loop
  const detectFaces = useCallback(async () => {
    if (!faceDetectorRef.current || !videoRef.current || !isCameraReady || useFallback) {
      animationFrameRef.current = requestAnimationFrame(detectFaces);
      return;
    }

    const video = videoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      try {
        const detections = faceDetectorRef.current.detectForVideo(video, performance.now());
        setFaceDetections(detections.detections || []);
      } catch (error) {
        console.error('Face detection error:', error);
      }
    }

    animationFrameRef.current = requestAnimationFrame(detectFaces);
  }, [isCameraReady, useFallback]);

  useEffect(() => {
    if (isCameraReady && faceDetectorRef.current) {
      detectFaces();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCameraReady, detectFaces]);

  // Generate image using nanobanana API
  const handleGenerateImage = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    try {
      // デモモード: ローカルのダミー画像を使用
      // 本番環境では以下のコメントを解除してnanobanana APIを使用してください

      // nanobanana API呼び出し
      // const response = await fetch('https://api.nanobanana.com/v1/generate', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': 'Bearer YOUR_API_KEY'
      //   },
      //   body: JSON.stringify({
      //     prompt: prompt,
      //     width: 512,
      //     height: 512
      //   })
      // });
      //
      // if (!response.ok) {
      //   throw new Error('Failed to generate image');
      // }
      //
      // const data = await response.json();
      // setGeneratedImage(data.image_url || data.url);

      // デモ用: ローカル画像を使用
      await new Promise(resolve => setTimeout(resolve, 1500)); // 生成をシミュレート
      setGeneratedImage('/dummy-overlay.jpg');
    } catch (error) {
      console.error('Image generation error:', error);
      // フォールバック: デモ用のダミー画像
      alert('画像生成APIに接続できませんでした。ダミー画像を使用します。');
      setGeneratedImage('/dummy-overlay.jpg');
    } finally {
      setIsGenerating(false);
    }
  };

  // Draw overlay on detected faces
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load generated image once
    let overlayImg: HTMLImageElement | null = null;
    if (generatedImage) {
      overlayImg = new Image();
      overlayImg.crossOrigin = 'anonymous';
      overlayImg.src = generatedImage;
    }

    // Animation loop for drawing overlays
    const drawLoop = () => {
      // Match canvas size to video
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || video.offsetWidth;
        canvas.height = video.videoHeight || video.offsetHeight;
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw image on each detected face
      if (overlayImg && overlayImg.complete && faceDetections.length > 0) {
        faceDetections.forEach((detection: any) => {
          const bbox = detection.boundingBox;
          if (bbox) {
            // Scale and draw image to fit face
            const x = bbox.originX;
            const y = bbox.originY;
            const width = bbox.width;
            const height = bbox.height;

            ctx.drawImage(overlayImg, x, y, width, height);
          }
        });
      }

      requestAnimationFrame(drawLoop);
    };

    const animId = requestAnimationFrame(drawLoop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [faceDetections, generatedImage]);

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

      {/* Overlay canvas for face detection */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ objectFit: 'cover' }}
      />

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
          {/* Text Input with Generate Button */}
          <div className="w-full max-w-md relative flex gap-3">
            <div className="relative flex-1">
              <Input
                value={prompt}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrompt(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleGenerateImage()}
                placeholder="プロンプトを入力…"
                className="w-full bg-white/10 backdrop-blur-lg border-white/20 text-white placeholder:text-white/50 rounded-full px-6 py-6 focus:border-[#00AEEF] focus:ring-[#00AEEF]/50 transition-all"
              />
            </div>
            <Button
              onClick={handleGenerateImage}
              disabled={!prompt.trim() || isGenerating}
              className="rounded-full bg-[#00AEEF] hover:bg-[#00AEEF]/80 text-white px-6 py-6 h-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Wand2 className="w-5 h-5" />
                </motion.div>
              ) : (
                <Wand2 className="w-5 h-5" />
              )}
            </Button>
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
            animate={{ opacity: 1 }}
            className="text-white/70 text-center text-sm px-4"
          >
            {isGenerating
              ? '画像生成中...'
              : generatedImage
              ? '顔を検出してオーバーレイ中...'
              : 'プロンプトを入力してボタンを押すと画像生成'}
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
