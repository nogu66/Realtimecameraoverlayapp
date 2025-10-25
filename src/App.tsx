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

  // Generate image using Weaver AI (Google Gemini 2.5 Flash Image) API
  const handleGenerateImage = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    console.log('🎨 Starting image generation with prompt:', prompt);

    try {
      const apiKey = import.meta.env.VITE_WEAVER_AI_API_KEY;

      if (!apiKey) {
        throw new Error('VITE_WEAVER_AI_API_KEY is not set in environment variables');
      }

      console.log('🔑 API Key found, making request...');

      // Enhance prompt for face overlay with green screen background
      const enhancedPrompt = `A close-up portrait of a ${prompt} face, front-facing view, centered, isolated subject on a bright green chroma key background (#00FF00), vivid green screen, face mask style, suitable for face overlay filter`;

      console.log('✨ Enhanced prompt:', enhancedPrompt);

      const requestBody = {
        prompt: enhancedPrompt,
        aspect_ratio: '1:1',
        output_format: 'png',
        enable_sync_mode: true
      };

      console.log('📤 Request body:', requestBody);

      const response = await fetch('https://api.wavespeed.ai/api/v3/google/gemini-2.5-flash-image/text-to-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ API error response:', errorData);
        throw new Error(`API request failed: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log('✅ API response data:', data);

      // Check if the generation was successful
      if (data.data && data.data.outputs && data.data.outputs.length > 0) {
        const imageUrl = data.data.outputs[0];
        console.log('🖼️ Setting generated image URL:', imageUrl);
        setGeneratedImage(imageUrl);
      } else if (data.data && data.data.status === 'failed') {
        console.error('❌ Server-side generation failed:', data.data);
        throw new Error('Image generation failed on the server');
      } else {
        console.error('❌ Unexpected response structure:', data);
        throw new Error('No image URL in response');
      }
    } catch (error) {
      console.error('💥 Image generation error:', error);
      // フォールバック: デモ用のダミー画像
      alert(`画像生成APIでエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}。ダミー画像を使用します。`);
      setGeneratedImage('/dummy-overlay.jpg');
    } finally {
      setIsGenerating(false);
      console.log('🏁 Image generation process completed');
    }
  };

  // Draw overlay on detected faces
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) {
      console.log('⚠️ Canvas or video not available');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('⚠️ Could not get canvas context');
      return;
    }

    console.log('🖼️ Setting up overlay with generatedImage:', generatedImage);
    console.log('👤 Current face detections:', faceDetections.length);

    // Load generated image once and process green screen
    let processedCanvas: HTMLCanvasElement | null = null;
    if (generatedImage) {
      const overlayImg = new Image();
      overlayImg.crossOrigin = 'anonymous';

      overlayImg.onload = () => {
        console.log('✅ Overlay image loaded successfully:', generatedImage);

        // Create a temporary canvas to process the image
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        if (tempCtx) {
          tempCanvas.width = overlayImg.width;
          tempCanvas.height = overlayImg.height;

          // Draw original image
          tempCtx.drawImage(overlayImg, 0, 0);

          // Get image data
          const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
          const data = imageData.data;

          // Process pixels: make green background transparent
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Detect green color (adjust thresholds as needed)
            // Check if green is dominant and red/blue are low
            if (g > 100 && g > r * 1.5 && g > b * 1.5) {
              // Make pixel transparent
              data[i + 3] = 0;
            }
          }

          // Put processed image data back
          tempCtx.putImageData(imageData, 0, 0);
          processedCanvas = tempCanvas;

          console.log('🎨 Green screen removed successfully');
        }
      };

      overlayImg.onerror = (error) => {
        console.error('❌ Failed to load overlay image:', error);
        console.error('Image URL:', generatedImage);
      };

      overlayImg.src = generatedImage;
      console.log('📥 Starting to load overlay image:', generatedImage);
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

      // Draw processed image on each detected face
      if (processedCanvas && faceDetections.length > 0) {
        faceDetections.forEach((detection: any) => {
          const bbox = detection.boundingBox;
          if (bbox && processedCanvas) {
            // Scale and draw processed image to fit face
            const x = bbox.originX;
            const y = bbox.originY;
            const width = bbox.width;
            const height = bbox.height;

            ctx.drawImage(processedCanvas, x, y, width, height);
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
          className="flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-[#00AEEF]" />
            <h1 className="text-white tracking-wide">AI Camera Filter</h1>
          </div>

          {/* Generated Image Preview */}
          {generatedImage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
              <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-[#00AEEF] bg-black/50 backdrop-blur-sm">
                <img
                  src={generatedImage}
                  alt="Generated overlay"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error('Preview image failed to load');
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#00AEEF] rounded-full animate-pulse" />
            </motion.div>
          )}
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
                placeholder="例: 猫、犬、パンダ、ロボット…"
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
              ? 'AI画像を生成中...'
              : generatedImage
              ? '顔にオーバーレイ中 - カメラに顔を向けてください'
              : '動物や物の名前を入力して顔フィルターを生成'}
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
