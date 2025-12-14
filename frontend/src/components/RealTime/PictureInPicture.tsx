import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import './PictureInPicture.css';

interface PictureInPictureProps {
  messages: Array<{
    id: string;
    speaker: string;
    text: string;
    timestamp: Date;
  }>;
  title?: string;
}

const PictureInPicture: React.FC<PictureInPictureProps> = ({
  messages,
  title = 'VISION AI - Live Translation',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupported = () => {
    return 'pictureInPictureEnabled' in document && 
           document.pictureInPictureEnabled &&
           videoRef.current?.requestPictureInPicture;
  };

  /* ===============================
     DRAW CANVAS CONTENT
  =============================== */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawFrame = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Header
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(title, canvas.width / 2, 40);

      // Divider line
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.moveTo(40, 60);
      ctx.lineTo(canvas.width - 40, 60);
      ctx.stroke();

      // Draw latest messages
      let y = 100;
      const latest = messages.slice(-3);

      if (!latest.length) {
        ctx.font = '20px Arial';
        ctx.fillText('Waiting for conversation…', canvas.width / 2, canvas.height / 2);
      } else {
        ctx.textAlign = 'left';
        latest.forEach(msg => {
          ctx.font = 'bold 18px Arial';
          ctx.fillText(`${msg.speaker}:`, 30, y);
          y += 30;

          ctx.font = '16px Arial';
          wrapText(ctx, msg.text, 30, y, canvas.width - 60, 24);
          y += (msg.text.length > 40 ? 70 : 40);
        });
      }
    };

    // Draw immediately
    drawFrame();

    // If PiP is active, start animation interval
    if (isPiPActive) {
      animationIntervalRef.current = setInterval(drawFrame, 1000 / 30); // 30 FPS
    }

    // Cleanup function - always return one
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
    };
  }, [isPiPActive, messages, title]);

  /* ===============================
     TOGGLE PiP
  =============================== */
  const togglePiP = async () => {
    try {
      // Check support
      if (!isSupported()) {
        throw new Error('Picture-in-Picture is not supported in this browser');
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (!video || !canvas) {
        throw new Error('Video or canvas element not found');
      }

      // If PiP is already active, exit it
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
        
        // Stop the stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        return;
      }

      // Create new stream from canvas
      const stream = canvas.captureStream(30);
      streamRef.current = stream;
      
      // Set up video element
      video.srcObject = stream;
      video.muted = true;
      
      // Important: Play the video before requesting PiP
      await video.play();
      
      // Request PiP
      await video.requestPictureInPicture();
      
      // Set active state
      setIsPiPActive(true);
      setError(null);
      
    } catch (err: any) {
      console.error('PiP failed:', err);
      setError(err.message || 'Failed to activate Picture-in-Picture');
      setIsPiPActive(false);
    }
  };

  /* ===============================
     CLEANUP ON UNMOUNT
  =============================== */
  useEffect(() => {
    return () => {
      // Clean up stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Clean up interval
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
      
      // Exit PiP if active
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="pip-container">
      {/* Canvas - visible but off-screen */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          visibility: 'hidden'
        }}
      />

      {/* Video element - required for PiP */}
      <video
        ref={videoRef}
        muted
        playsInline
        style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none'
        }}
      />

      {/* Control button */}
      <button 
        onClick={togglePiP} 
        className="pip-toggle-btn"
        disabled={!isSupported()}
      >
        {isPiPActive ? (
          <>
            <Minimize2 size={18} />
            <span>Exit PiP Mode</span>
          </>
        ) : (
          <>
            <Maximize2 size={18} />
            <span>Share Translation (PiP)</span>
          </>
        )}
      </button>

      {/* Browser support notice */}
      {!isSupported() && (
        <div className="pip-warning">
          Picture-in-Picture is not supported in your browser.
          Please use Chrome, Edge, or Opera.
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="pip-error">
          <small>{error}</small>
        </div>
      )}
    </div>
  );
};

/* ===============================
   TEXT WRAP HELPER
================================ */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ');
  let line = '';

  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    const { width } = ctx.measureText(test);

    if (width > maxWidth && i > 0) {
      ctx.fillText(line, x, y);
      line = words[i] + ' ';
      y += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
}

export default PictureInPicture;