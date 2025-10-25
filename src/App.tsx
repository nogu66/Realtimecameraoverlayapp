import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Sparkles, Wand2, Download } from 'lucide-react';
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
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDetectorReady, setIsDetectorReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceDetectorRef = useRef<FaceDetector | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastDetectionTimeRef = useRef<number>(0);
  const faceDetectionsRef = useRef<any[]>([]);

  // Initialize MediaPipe Face Detector
  useEffect(() => {
    const initFaceDetector = async () => {
      try {
        console.log('🔧 [Init] Starting MediaPipe Face Detector initialization...');
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
        setIsDetectorReady(true);
        console.log('✅ [Init] Face Detector initialized successfully');
      } catch (error) {
        console.error('❌ [Init] Failed to initialize face detector:', error);
        setIsDetectorReady(false);
      }
    };

    initFaceDetector();
  }, []);

  // Initialize camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        console.log('📹 [Init] Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 1280, height: 720 }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraReady(true);
          setUseFallback(false);
          console.log('✅ [Init] Camera ready');
        }
      } catch (err) {
        console.error('❌ [Init] Camera access error:', err);
        // Use fallback mode with placeholder image
        setUseFallback(true);
        setIsCameraReady(true);
        console.log('⚠️ [Init] Using fallback mode');
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

  // Face detection loop - throttled to 33ms (30fps) for smooth tracking
  const detectFaces = useCallback(async () => {
    const DETECTION_INTERVAL = 33; // ~30fps for smooth face tracking

    const runDetection = () => {
      if (!faceDetectorRef.current || !videoRef.current || !isCameraReady || useFallback) {
        animationFrameRef.current = requestAnimationFrame(runDetection);
        return;
      }

      const now = performance.now();
      const timeSinceLastDetection = now - lastDetectionTimeRef.current;

      // Only run detection every 100ms
      if (timeSinceLastDetection >= DETECTION_INTERVAL) {
        const video = videoRef.current;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          try {
            const detections = faceDetectorRef.current.detectForVideo(video, now);
            const faceCount = detections.detections?.length || 0;

            // Debug: Log face detection results every 2 seconds
            if (Math.floor(now / 2000) !== Math.floor(lastDetectionTimeRef.current / 2000)) {
              console.log('👁️ [Face Detection @30fps]', faceCount, 'face(s) detected');
              if (faceCount > 0) {
                detections.detections.forEach((det: any, idx: number) => {
                  const bbox = det.boundingBox;
                  if (bbox) {
                    console.log(`  Face ${idx}: x=${Math.round(bbox.originX)}, y=${Math.round(bbox.originY)}, w=${Math.round(bbox.width)}, h=${Math.round(bbox.height)}`);
                  }
                });
              }
            }

            faceDetectionsRef.current = detections.detections || [];
            lastDetectionTimeRef.current = now;
          } catch (error) {
            console.error('❌ Face detection error:', error);
          }
        } else {
          // Debug: Log when video is not ready
          if (Math.floor(now / 5000) !== Math.floor(lastDetectionTimeRef.current / 5000)) {
            console.log('⏸️ [Face Detection] Video not ready, readyState:', video.readyState);
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(runDetection);
    };

    runDetection();
  }, [isCameraReady, useFallback]);

  useEffect(() => {
    console.log('🔍 [Init] Face detection loop check:', {
      isCameraReady,
      hasFaceDetector: !!faceDetectorRef.current,
      useFallback,
      isDetectorReady
    });

    if (isCameraReady && isDetectorReady && faceDetectorRef.current) {
      console.log('🚀 [Init] Starting face detection loop');
      detectFaces();
    } else {
      console.log('⏸️ [Init] Face detection loop NOT started:', {
        isCameraReady,
        hasFaceDetector: !!faceDetectorRef.current,
        isDetectorReady
      });
    }
    return () => {
      if (animationFrameRef.current) {
        console.log('🛑 [Init] Cancelling face detection loop');
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCameraReady, isDetectorReady, detectFaces]);

  // Generate 3 images using Weaver AI (Google Gemini 2.5 Flash Image) API
  const handleGenerateImage = async (customPrompt?: string) => {
    const actualPrompt = customPrompt || prompt;
    if (!actualPrompt.trim()) return;

    setIsGenerating(true);
    setGeneratedImages([]); // Clear previous images
    setSelectedImageIndex(0);
    console.log('🎨 Starting 3 image generations with prompt:', actualPrompt);

    try {
      const apiKey = import.meta.env.VITE_WEAVER_AI_API_KEY;

      if (!apiKey) {
        throw new Error('VITE_WEAVER_AI_API_KEY is not set in environment variables');
      }

      console.log('🔑 API Key found, making 3 parallel requests...');

      // Enhance prompt for face overlay with green screen background
      const enhancedPrompt = `A close-up portrait of a ${actualPrompt} face, front-facing view, centered, isolated subject on a bright green chroma key background (#00FF00), vivid green screen, face mask style, suitable for face overlay filter`;

      console.log('✨ Enhanced prompt:', enhancedPrompt);

      const requestBody = {
        prompt: enhancedPrompt,
        aspect_ratio: '1:1',
        output_format: 'png',
        enable_sync_mode: true
      };

      // Generate 3 images in parallel
      const generateSingleImage = async (index: number) => {
        console.log(`📤 Request ${index + 1}/3:`, requestBody);

        const response = await fetch('https://api.wavespeed.ai/api/v3/google/gemini-2.5-flash-image/text-to-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody)
        });

        console.log(`📥 Response ${index + 1}/3 status:`, response.status, response.statusText);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`❌ API error response ${index + 1}/3:`, errorData);
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`✅ API response ${index + 1}/3 data:`, data);

        // Check if the generation was successful
        if (data.data && data.data.outputs && data.data.outputs.length > 0) {
          const imageUrl = data.data.outputs[0];
          console.log(`🖼️ Image ${index + 1}/3 URL:`, imageUrl);
          return imageUrl;
        } else if (data.data && data.data.status === 'failed') {
          console.error(`❌ Server-side generation ${index + 1}/3 failed:`, data.data);
          throw new Error('Image generation failed on the server');
        } else {
          console.error(`❌ Unexpected response structure ${index + 1}/3:`, data);
          throw new Error('No image URL in response');
        }
      };

      // Generate 3 images in parallel
      const imageUrls = await Promise.all([
        generateSingleImage(0),
        generateSingleImage(1),
        generateSingleImage(2)
      ]);

      console.log('✅ All 3 images generated successfully:', imageUrls);
      setGeneratedImages(imageUrls);
      setSelectedImageIndex(0); // Select first image by default
    } catch (error) {
      console.error('💥 Image generation error:', error);
      // フォールバック: デモ用のダミー画像
      alert(`画像生成APIでエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}。ダミー画像を使用します。`);
      setGeneratedImages(['/dummy-overlay.jpg', '/dummy-overlay.jpg', '/dummy-overlay.jpg']);
      setSelectedImageIndex(0);
    } finally {
      setIsGenerating(false);
      console.log('🏁 Image generation process completed');
    }
  };

  // Process generated image (green screen removal) - only when image changes
  useEffect(() => {
    const selectedImage = generatedImages[selectedImageIndex];

    if (!selectedImage) {
      processedCanvasRef.current = null;
      console.log('🗑️ [Image Processing] No generated image, clearing processed canvas');
      return;
    }

    console.log('🖼️ [Image Processing] Loading overlay image:', selectedImage);

    const overlayImg = new Image();
    overlayImg.crossOrigin = 'anonymous';

    overlayImg.onload = () => {
      console.log('✅ [Image Processing] Image loaded, starting green screen removal...');

      // Create a temporary canvas to process the image
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');

      if (tempCtx) {
        tempCanvas.width = overlayImg.width;
        tempCanvas.height = overlayImg.height;

        console.log(`📐 [Image Processing] Original image size: ${overlayImg.width}x${overlayImg.height}`);

        // Draw original image
        tempCtx.drawImage(overlayImg, 0, 0);

        // Get image data
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;
        const totalPixels = data.length / 4;

        // Process pixels: make green background transparent
        let greenPixelsRemoved = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Detect green color (adjust thresholds as needed)
          // Check if green is dominant and red/blue are low
          if (g > 100 && g > r * 1.5 && g > b * 1.5) {
            // Make pixel transparent
            data[i + 3] = 0;
            greenPixelsRemoved++;
          }
        }

        // Put processed image data back
        tempCtx.putImageData(imageData, 0, 0);
        processedCanvasRef.current = tempCanvas;

        const removalPercentage = ((greenPixelsRemoved / totalPixels) * 100).toFixed(1);
        console.log(`🎨 [Image Processing] Green screen removed: ${greenPixelsRemoved.toLocaleString()}/${totalPixels.toLocaleString()} pixels (${removalPercentage}%)`);
        console.log('✅ [Image Processing] Processed canvas ready for overlay');
      } else {
        console.error('❌ [Image Processing] Failed to get canvas context');
      }
    };

    overlayImg.onerror = (error) => {
      console.error('❌ [Image Processing] Failed to load overlay image:', error);
      console.error('Image URL:', selectedImage);
    };

    overlayImg.src = selectedImage;
  }, [generatedImages, selectedImageIndex]);

  // Draw overlay on detected faces - separate effect for drawing loop
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

    console.log('🎬 Starting drawing loop');

    // Animation loop for drawing overlays
    let frameCount = 0;
    let lastLogTime = 0;
    const drawLoop = () => {
      // Match canvas size to video
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || video.offsetWidth;
        canvas.height = video.videoHeight || video.offsetHeight;
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw processed image on each detected face
      const processedCanvas = processedCanvasRef.current;
      const currentDetections = faceDetectionsRef.current;
      const now = performance.now();

      // Debug log every 2 seconds
      const shouldLog = (now - lastLogTime) > 2000;

      if (shouldLog) {
        const hasProcessedCanvas = !!processedCanvas;
        const detectionCount = currentDetections.length;
        console.log('🖼️ [Overlay Drawing]', {
          hasProcessedCanvas,
          processedCanvasSize: hasProcessedCanvas ? `${processedCanvas.width}x${processedCanvas.height}` : 'N/A',
          detectionCount,
          canvasSize: `${canvas.width}x${canvas.height}`
        });
        lastLogTime = now;
      }

      // // Draw debug rectangles for face detection (useful while tuning overlay alignment)
      // if (currentDetections.length > 0) {
      //   ctx.strokeStyle = '#00ff00'; // Green for detected faces
      //   ctx.lineWidth = 2;
      //
      //   currentDetections.forEach((detection: any) => {
      //     const bbox = detection.boundingBox;
      //     if (bbox) {
      //       // Draw detection bounding box
      //       ctx.strokeRect(bbox.originX, bbox.originY, bbox.width, bbox.height);
      //
      //       // Draw scaled overlay area
      //       const scaleFactor = 2.0;
      //       const scaledWidth = bbox.width * scaleFactor;
      //       const scaledHeight = bbox.height * scaleFactor;
      //       const x = bbox.originX - (scaledWidth - bbox.width) / 2;
      //       const y = bbox.originY - (scaledHeight - bbox.height) / 2;
      //
      //       ctx.strokeStyle = '#ff00ff'; // Magenta for overlay area
      //       ctx.strokeRect(x, y, scaledWidth, scaledHeight);
      //     }
      //   });
      // }

      if (processedCanvas && currentDetections.length > 0) {
        let drawCount = 0;

        currentDetections.forEach((detection: any) => {
          const bbox = detection.boundingBox;
          if (bbox) {
            // Scale factor to ensure face is completely covered
            const scaleFactor = 2.0;

            const scaledWidth = bbox.width * scaleFactor;
            const scaledHeight = bbox.height * scaleFactor;

            // Center the scaled image on the face
            const x = bbox.originX - (scaledWidth - bbox.width) / 2;
            const y = bbox.originY - (scaledHeight - bbox.height) / 2;

            ctx.drawImage(processedCanvas, x, y, scaledWidth, scaledHeight);
            drawCount++;
          }
        });

        if (shouldLog && drawCount > 0) {
          console.log(`✅ [Overlay Drawing] Drew ${drawCount} overlay(s) successfully`);
        }
      } else {
        // Debug: Why is overlay not being drawn?
        if (shouldLog) {
          if (!processedCanvas) {
            console.log('⚠️ [Overlay Drawing] No processed canvas available');
          } else if (currentDetections.length === 0) {
            console.log('⚠️ [Overlay Drawing] No face detections available');
          }
        }
      }

      frameCount++;
      requestAnimationFrame(drawLoop);
    };

    const animId = requestAnimationFrame(drawLoop);

    return () => {
      console.log('🛑 Stopping drawing loop');
      cancelAnimationFrame(animId);
    };
  }, []); // Empty dependency array - only run once on mount

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

  // Download currently selected generated image
  const handleDownloadImage = async () => {
    const selectedImage = generatedImages[selectedImageIndex];
    if (!selectedImage) return;

    try {
      const response = await fetch(selectedImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `overlay-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      console.log('✅ Image downloaded successfully');
    } catch (error) {
      console.error('❌ Failed to download image:', error);
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

          {/* Generated Image Preview with Download */}
          {generatedImages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2"
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-[#00AEEF] bg-black/50 backdrop-blur-sm">
                  <img
                    src={generatedImages[selectedImageIndex]}
                    alt="Generated overlay"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error('Preview image failed to load');
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#00AEEF] rounded-full animate-pulse" />
              </div>
              <Button
                onClick={handleDownloadImage}
                size="sm"
                className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white h-8 w-8 p-0"
                title="Download image to public/image/"
              >
                <Download className="w-4 h-4" />
              </Button>
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
          {/* Generated Image Thumbnails */}
          {generatedImages.length > 0 && (
            <div className="w-full max-w-md flex justify-center gap-3">
              {generatedImages.map((imageUrl, index) => (
                <motion.button
                  key={index}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedImageIndex(index)}
                  disabled={isGenerating}
                  className={`flex-1 aspect-square rounded-2xl backdrop-blur-lg border-3 transition-all overflow-hidden ${
                    selectedImageIndex === index
                      ? 'border-[#00AEEF] ring-2 ring-[#00AEEF]/50'
                      : 'border-white/20 hover:border-white/40'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <img
                    src={imageUrl}
                    alt={`Generated overlay ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error(`Thumbnail ${index + 1} failed to load`);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </motion.button>
              ))}
            </div>
          )}

          {/* Text Input with Generate Button */}
          <div className="w-full max-w-md relative flex gap-3">
            <div className="relative flex-1">
              <Input
                value={prompt}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrompt(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    handleGenerateImage();
                  }
                }}

                placeholder="ex: cat, dog, panda, robot..."
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
          {/* <motion.button
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
          </motion.button> */}

          {/* Helper Text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-white/70 text-center text-sm px-4"
          >
            {isGenerating
              ? 'generating 3 AI images...'
              : generatedImages.length > 0
              ? `${generatedImages.length} face overlays generated - tap to switch`
              : 'enter prompt to generate 3 face overlays'}
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
