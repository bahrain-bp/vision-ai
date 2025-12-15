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
  const scrollPositionRef = useRef<number>(0);

  const isSupported = () => {
    return 'pictureInPictureEnabled' in document && 
           document.pictureInPictureEnabled &&
           videoRef.current?.requestPictureInPicture;
  };

  const getSpeakerLabels = (speaker: string): { en: string; ar: string } => {
    const labels: Record<string, { en: string; ar: string }> = {
      'Investigator': { en: 'Investigator', ar: 'المحقق' },
      'Witness': { en: 'Witness', ar: 'الشاهد' },
      'Accused': { en: 'Accused', ar: 'المتهم' },
      'Victim': { en: 'Victim', ar: 'الضحية' }
    };
    return labels[speaker] || { en: speaker, ar: speaker };
  };

  /* ===============================
     DRAW CANVAS CONTENT - SHOWING ALL MESSAGES WITH SCROLL
  =============================== */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const HEADER_HEIGHT = 100;
    const FOOTER_HEIGHT = 50;
    const CONTENT_START_Y = HEADER_HEIGHT;
    const CONTENT_HEIGHT = canvas.height - HEADER_HEIGHT - FOOTER_HEIGHT;

    const drawFrame = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Header section
      ctx.fillStyle = 'rgba(102, 126, 234, 1)';
      ctx.fillRect(0, 0, canvas.width, HEADER_HEIGHT);

      // Title
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('VISION AI - Participant View', canvas.width / 2, 40);

      // Subtitle
      ctx.font = '20px Arial';
      ctx.fillText('العرض المخصص للمشارك', canvas.width / 2, 75);

      // Content area background (white)
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, HEADER_HEIGHT, canvas.width, CONTENT_HEIGHT);

      // Calculate total height needed for all messages
      let totalContentHeight = 20; // Start padding
      const messageHeights: number[] = [];
      
      messages.forEach((msg) => {
        const messageWidth = canvas.width * 0.75;
        
        // Calculate text height
        ctx.font = '16px Arial';
        const lines = wrapTextMeasure(ctx, msg.text, messageWidth - 30);
        const textHeight = lines.length * 20;
        const messageHeight = 80 + Math.max(0, textHeight - 40); // Base height + extra for long text
        
        messageHeights.push(messageHeight);
        totalContentHeight += messageHeight + 10; // 10px gap
      });

      // Auto-scroll to bottom when new messages arrive
      if (messages.length > 0) {
        const maxScroll = Math.max(0, totalContentHeight - CONTENT_HEIGHT);
        scrollPositionRef.current = maxScroll;
      }

      // Draw messages with scroll offset
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, CONTENT_START_Y, canvas.width, CONTENT_HEIGHT);
      ctx.clip();

      let y = CONTENT_START_Y + 20 - scrollPositionRef.current;

      if (messages.length === 0) {
        // Empty state
        ctx.fillStyle = '#9ca3af';
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for conversation...', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillText('في انتظار المحادثة...', canvas.width / 2, canvas.height / 2 + 10);
      } else {
        messages.forEach((msg, index) => {
          const labels = getSpeakerLabels(msg.speaker);
          const isInvestigator = msg.speaker === 'Investigator';
          
          const messageWidth = canvas.width * 0.75;
          const messageX = isInvestigator ? 30 : canvas.width - messageWidth - 30;
          const messageHeight = messageHeights[index];
          
          // Only draw if visible in viewport
          if (y + messageHeight > CONTENT_START_Y && y < CONTENT_START_Y + CONTENT_HEIGHT) {
            // Background for message
            ctx.fillStyle = isInvestigator ? '#e0e7ff' : '#f0fdf4';
            ctx.fillRect(messageX, y, messageWidth, messageHeight);
            
            // Border
            ctx.strokeStyle = isInvestigator ? '#c7d2fe' : '#bbf7d0';
            ctx.lineWidth = 1;
            ctx.strokeRect(messageX, y, messageWidth, messageHeight);
            
            // Speaker label
            ctx.fillStyle = '#374151';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`${labels.en} / ${labels.ar}`, messageX + 15, y + 20);
            
            // Time
            ctx.fillStyle = '#6b7280';
            ctx.font = '12px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(msg.timestamp.toLocaleTimeString(), messageX + messageWidth - 15, y + 20);
            
            // Message text
            ctx.fillStyle = '#111827';
            ctx.font = '16px Arial';
            ctx.textAlign = isInvestigator ? 'left' : 'right';
            
            const textX = isInvestigator ? messageX + 15 : messageX + messageWidth - 15;
            wrapText(ctx, msg.text, textX, y + 45, messageWidth - 30, 20);
          }
          
          y += messageHeight + 10;
        });
      }

      ctx.restore();

      // Footer
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, canvas.height - FOOTER_HEIGHT, canvas.width, FOOTER_HEIGHT);
      
      // Live indicator
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(30, canvas.height - 25, 6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#10b981';
      ctx.font = '14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('Live Translation Active', 45, canvas.height - 20);
      
      // Message count
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'right';
      ctx.fillText(`${messages.length} messages / رسائل`, canvas.width - 20, canvas.height - 20);
    };

    // Draw immediately
    drawFrame();

    // If PiP is active, start animation interval
    if (isPiPActive) {
      animationIntervalRef.current = setInterval(drawFrame, 1000 / 30); // 30 FPS
    }

    // Cleanup function
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
      {/* Canvas - hidden but rendered */}
      <canvas
        ref={canvasRef}
        width={900}
        height={700}
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
        className={`pip-toggle-btn ${isPiPActive ? 'active' : ''}`}
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

      {/* Active indicator */}
      {isPiPActive && (
        <div className="pip-active-notice">
          <div className="pip-pulse"></div>
          <span>✅ PiP Active! Share this floating window in Teams/Zoom</span>
        </div>
      )}

      {/* Browser support notice */}
      {!isSupported() && (
        <div className="pip-not-supported">
          <p>⚠️ Picture-in-Picture not supported</p>
          <p>Please use Chrome, Edge, or Safari</p>
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
   TEXT WRAP HELPER - Measure only
================================ */
function wrapTextMeasure(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';

  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    const { width } = ctx.measureText(test);

    if (width > maxWidth && i > 0) {
      lines.push(line);
      line = words[i] + ' ';
    } else {
      line = test;
    }
  }
  lines.push(line);
  return lines;
}

/* ===============================
   TEXT WRAP HELPER - Draw
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
  let currentY = y;

  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    const { width } = ctx.measureText(test);

    if (width > maxWidth && i > 0) {
      ctx.fillText(line, x, currentY);
      line = words[i] + ' ';
      currentY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, currentY);
}

export default PictureInPicture;