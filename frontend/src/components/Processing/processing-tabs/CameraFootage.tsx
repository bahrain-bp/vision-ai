import React, { useRef, useState } from "react";
// Custom Hooks
//import { useVideoUpload } from "../../../hooks/useVideoUpload";
//import { useVideoAnalysisOperations } from "../../../hooks/useVideoAnalysisOperations";

import "../../../ProcessingView.css";

// note: currently using local state and logic instead of hooks/context/services to simulate ui/workflow
// Local interfaces for mock data
// add session data
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
  // Local state instead of hooks/context
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      // Create a local URL for the video
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    }
  };

  const startAnalysis = async () => {
    setIsAnalyzing(true);

    // Mock analysis delay
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Mock analysis result
    const mockResult: AnalysisResult = {
      events: [
        {
          id: "1",
          timestamp: 10,
          description: "Person detected entering the frame.",
          confidence: 0.95,
          type: "person",
          bbox: { x: 20, y: 30, width: 15, height: 25 },
        },
        {
          id: "2",
          timestamp: 30,
          description: "Vehicle detected moving across the frame.",
          confidence: 0.89,
          type: "vehicle",
          bbox: { x: 45, y: 20, width: 30, height: 20 },
        },
        {
          id: "3",
          timestamp: 60,
          description: "Suspicious activity detected in the corner.",
          confidence: 0.75,
          type: "activity",
          bbox: { x: 75, y: 15, width: 20, height: 18 },
        },
      ],
      summary:
        "Detected 3 events: 1 person, 1 vehicle, and 1 suspicious activity.",
      duration: 120,
      processedAt: new Date(),
    };

    setAnalysisResult(mockResult);
    setIsAnalyzing(false);
  };

  const selectEvent = (event: Event) => {
    setSelectedEvent(event);
  };

  const handleTimelineClick = (timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Get video duration from the video element or use mock data
  const getVideoDuration = (): number => {
    return videoRef.current?.duration || 0;
  };

  return (
    <div className="camera-footage-wrapper">
      <div className="camera-title">Camera Footage Analysis</div>
      <p className="camera-description">
        *Upload and analyze surveillance footage for evidence extraction
      </p>

      <div className="camera-footage-container">
        {/* Video Upload & Player Section */}
        <div className="tab-section">
          <div className="tab-section-title">Video Upload</div>
          <div className="tab-section-content">
            {!videoUrl ? (
              /* Upload Section */
              <div className="video-upload-area">
                {/* Hidden File Input */}
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="video-upload"
                />

                {/* Label for File Input */}
                <label htmlFor="video-upload" className="upload-label">
                  <div className="upload-content">
                    <div className="upload-icon">📹</div>
                    <div className="upload-text">Upload Video File</div>
                    <div className="upload-subtitle">
                      MP4, AVI, MOV up to 2GB
                    </div>
                  </div>
                </label>

                {/* Upload Button */}
                <button
                  type="button"
                  className="continue-btn"
                  onClick={() =>
                    document.getElementById("video-upload")?.click()
                  }
                >
                  Click to browse or drag and drop
                </button>
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
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>

                {/* Video Controls */}
                <div className="video-controls">
                  <div className="video-info">
                    {videoFile?.name} • {formatTime(getVideoDuration())}
                  </div>
                  <button
                    onClick={startAnalysis}
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
                    {analysisResult.events.map((event: Event) => (
                      <div
                        key={event.id}
                        onClick={() => {
                          selectEvent(event);
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
