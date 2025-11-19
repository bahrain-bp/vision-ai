import React, { useRef, useState } from "react";
import "../../../ProcessingView.css";
import { SessionData } from "../ProcessingView";

interface CameraFootageProps {
  sessionData: SessionData;
}

interface Event {
  id: string;
  timestamp: number;
  start_millis?: number;
  end_millis?: number;
  duration_seconds?: number;
  description: string;
  confidence?: number;
  type: string;
}

interface OCRLine {
  text: string;
  confidence?: number;
  bounding_box?: any;
}

interface OCREntry {
  frame_index?: number;
  timestamp: number;
  timecode_smpte?: string;
  lines: OCRLine[];
}

interface AnalysisResult {
  events: Event[];
  summary: string;
  ocr?: OCREntry[];
  metadata?: {
    duration_seconds: number;
    frame_rate?: number;
    format?: string;
  };
  processedAt?: Date;
}

const CameraFootage: React.FC<CameraFootageProps> = ({
  sessionData: _sessionData,
}) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [videoS3Key, setVideoS3Key] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [pollingStatus, setPollingStatus] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement>(null);

  const isValidSessionId = (sessionId: string): boolean => {
    const pattern = /^session-\d{14}-[a-fA-F0-9]{8}$/;
    return pattern.test(sessionId);
  };

  // Handle video upload
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    let sessionId = _sessionData?.sessionId || "unknown";

    if (!isValidSessionId(sessionId)) {
      console.error("Invalid sessionId format");
      alert(
        `Invalid sessionId format: ${sessionId}. Expected format: session-YYYYMMDDHHMMSS-XXXXXXXX`
      );
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // Step 1: Get presigned URL
      const uploadUrlResponse = await fetch(
        `${process.env.REACT_APP_API_ENDPOINT}/footage/upload-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            fileName: file.name,
          }),
        }
      );

      if (!uploadUrlResponse.ok) {
        const error = await uploadUrlResponse.json();
        throw new Error(error.error || "Failed to get upload URL");
      }

      const uploadData = await uploadUrlResponse.json();
      console.log("Presigned URL received:", uploadData);

      // Step 2: Upload to S3
      const s3UploadResponse = await fetch(uploadData.uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": "video/mp4",
        },
      });

      if (!s3UploadResponse.ok) {
        throw new Error("Failed to upload video to S3");
      }

      // Step 3: Success
      setVideoFile(file);
      setVideoS3Key(uploadData.s3Key);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      console.log("Video uploaded successfully");
    } catch (error: any) {
      console.error("Upload error:", error);
      setUploadError(error.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  // Poll for analysis results
  const pollForResults = async (jobId: string, maxAttempts: number = 30) => {
    let attempts = 0;

    const poll = async () => {
      attempts++;
      setPollingStatus(`Checking results... (${attempts}/${maxAttempts})`);

      try {
        const response = await fetch(
          `${process.env.REACT_APP_API_ENDPOINT}/footage/results?jobId=${jobId}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (response.ok) {
          const result = await response.json();
          console.log("Analysis results received:", result);

          setAnalysisResult({
            summary: result.summary || "No summary available",
            events: result.events || [],
            ocr: result.ocr || [],
            metadata: result.metadata,
            processedAt: new Date(),
          });
          setIsAnalyzing(false);
          setPollingStatus("Analysis complete!");
          return;
        } else if (response.status === 404) {
          // Results not ready yet
          if (attempts < maxAttempts) {
            setTimeout(poll, 10000); // Poll every 10 seconds
          } else {
            throw new Error("Analysis timeout - results not available");
          }
        } else {
          throw new Error("Failed to fetch results");
        }
      } catch (error: any) {
        console.error("Polling error:", error);
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000);
        } else {
          setIsAnalyzing(false);
          setPollingStatus("Failed to get results");
          setAnalysisResult({
            summary: error.message || "Analysis failed",
            events: [],
            processedAt: new Date(),
          });
        }
      }
    };

    poll();
  };

  const startAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setPollingStatus("Starting analysis...");

    try {
      const sessionId = _sessionData?.sessionId || "unknown";

      const response = await fetch(
        `${process.env.REACT_APP_API_ENDPOINT}/footage/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            s3Key: videoS3Key,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Analysis request failed");
      }

      console.log("Analysis job started:", result);
      const extractedJobId =
        result.jobId || result.invocationArn?.split("/").pop();
      setJobId(extractedJobId);
      console.log("Job ID set:", jobId);

      // Start polling for results
      if (extractedJobId) {
        setPollingStatus("Analysis in progress...");
        pollForResults(extractedJobId);
      } else {
        throw new Error("No job ID returned from analysis");
      }
    } catch (error: any) {
      console.error("Analysis error:", error);
      setIsAnalyzing(false);
      setPollingStatus("");
      setAnalysisResult({
        summary: error.message || "Analysis failed",
        events: [],
        processedAt: new Date(),
      });
    }
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

  const getVideoDuration = (): number => {
    return (
      analysisResult?.metadata?.duration_seconds ||
      videoRef.current?.duration ||
      0
    );
  };

  return (
    <div className="camera-footage-wrapper">
      <div className="camera-title">Camera Footage Analysis</div>
      <p className="camera-description">
        *Upload and analyze surveillance footage for evidence extraction
      </p>

      {uploadError && (
        <div
          style={{
            color: "red",
            backgroundColor: "#fee",
            padding: "10px",
            borderRadius: "4px",
            marginBottom: "10px",
          }}
        >
          {uploadError}
        </div>
      )}

      {pollingStatus && isAnalyzing && (
        <div
          style={{
            color: "#0066cc",
            backgroundColor: "#e6f2ff",
            padding: "10px",
            borderRadius: "4px",
            marginBottom: "10px",
          }}
        >
          {pollingStatus}
        </div>
      )}

      <div className="camera-footage-container">
        {/* Video Upload & Player Section */}
        <div className="tab-section">
          <div className="tab-section-title">Video Upload</div>
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
                  disabled={isUploading}
                />
                {/* Label for File Input */}
                <label htmlFor="video-upload" className="upload-label">
                  <div className="upload-content">
                    <div className="upload-icon-cam">📹</div>
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
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <span className="processing-spinner">⟳</span>
                      Uploading...
                    </>
                  ) : (
                    "Click to browse or drag and drop"
                  )}
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
                        {event.confidence && (
                          <div className="event-confidence">
                            Confidence: {Math.round(event.confidence * 100)}%
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

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
