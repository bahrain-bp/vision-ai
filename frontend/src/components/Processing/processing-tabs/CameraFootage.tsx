import React, { useState, useRef } from "react";
import "../../../ProcessingView.css";

interface Event {
  id: string;
  timestamp: number;
  description: string;
  confidence: number;
  type: "person" | "vehicle" | "object" | "activity";
  bbox?: { x: number; y: number; width: number; height: number };
}

interface AnalysisResult {
  events: Event[];
  summary: string;
  duration: number;
  processedAt: Date;
}

const CameraFootage: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    }
  };

  const handleTimelineClick = (timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      setCurrentTime(timestamp);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="camera-footage-wrapper">
      <div className="camera-title">Camera Footage Analysis</div>
      <p className="camera-description">
        Upload and analyze surveillance footage for evidence extraction
      </p>

      <div className="camera-footage-container">
        {/* Video Upload & Player Section */}
        <div className="tab-section">
          <div className="tab-section-title">Video Upload & Analysis</div>
          <div className="tab-section-content">
            {!videoUrl ? (
              /* Upload Section */
              <div className="video-upload-area">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="video-upload"
                />
                <label htmlFor="video-upload" className="upload-label">
                  <div className="upload-content">
                    <div className="upload-icon">📹</div>
                    <div className="upload-text">Upload Video File</div>
                    <div className="upload-subtitle">
                      MP4, AVI, MOV up to 2GB
                    </div>
                    <div className="upload-instruction">
                      Click to browse or drag and drop
                    </div>
                  </div>
                </label>
              </div>
            ) : (
              /* Video Player Section */
              <div className="video-player-container">
                <div className="video-wrapper">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    className="video-player"
                    onTimeUpdate={(e) =>
                      setCurrentTime((e.target as HTMLVideoElement).currentTime)
                    }
                  >
                    Your browser does not support the video tag.
                  </video>

                  {/* Video Overlay for Bounding Boxes */}
                  {selectedEvent?.bbox && (
                    <div
                      className="video-overlay"
                      style={{
                        left: `${selectedEvent.bbox.x}%`,
                        top: `${selectedEvent.bbox.y}%`,
                        width: `${selectedEvent.bbox.width}%`,
                        height: `${selectedEvent.bbox.height}%`,
                      }}
                    />
                  )}
                </div>

                {/* Video Controls */}
                <div className="video-controls">
                  <div className="video-info">
                    {videoFile?.name} • {formatTime(currentTime)}
                  </div>
                  <button
                    onClick={() => setIsAnalyzing(true)}
                    disabled={isAnalyzing}
                    className={`continue-btn ${isAnalyzing ? "analyzing" : ""}`}
                  >
                    {isAnalyzing ? (
                      <>
                        <span className="processing-spinner">⟳</span>
                        Analyzing...
                      </>
                    ) : (
                      "Start Analysis"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Analysis Results Section */}
        <div className="tab-section">
          <div className="tab-section-title">Analysis Results</div>
          <div className="tab-section-content">
            {analysisResult ? (
              <div className="analysis-results">
                {/* Summary */}
                <div className="analysis-summary">
                  <h4 className="summary-title">Summary</h4>
                  <p className="summary-text">{analysisResult.summary}</p>
                </div>

                {/* Events Timeline */}
                <div className="events-timeline">
                  <h4 className="events-title">
                    Detected Events ({analysisResult.events.length})
                  </h4>
                  <div className="events-list">
                    {analysisResult.events.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => {
                          setSelectedEvent(event);
                          handleTimelineClick(event.timestamp);
                        }}
                        className={`event-item ${
                          selectedEvent?.id === event.id ? "selected" : ""
                        }`}
                      >
                        <div className="event-header">
                          <span className={`event-type ${event.type}`}>
                            {event.type}
                          </span>
                          <span className="event-time">
                            {formatTime(event.timestamp)}
                          </span>
                        </div>
                        <p className="event-description">{event.description}</p>
                        <div className="event-confidence">
                          Confidence: {Math.round(event.confidence * 100)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Export Actions */}
                <div className="export-actions">
                  <button className="continue-btn">Export Report</button>
                  <button className="continue-btn secondary">
                    Download Evidence Package
                  </button>
                </div>
              </div>
            ) : (
              <div className="no-results">
                <div className="no-results-icon"></div>
                <p>Upload a video to start analysis</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraFootage;
