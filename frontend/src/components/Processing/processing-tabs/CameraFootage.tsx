import React, { useRef, useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import "../../../ProcessingView.css";
import { SessionData } from "../ProcessingView";

interface CameraFootageProps {
  sessionData: SessionData;
}

interface TranslatedText {
  en: string;
  ar: string;
}

interface TranslatedFields {
  en: {
    description: string;
    type?: string;
    confidence?: string;
  };
  ar: {
    description: string;
    type?: string;
    confidence?: string;
  };
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
  risk_score?: number;
}

interface ChapterData {
  id: string;
  displayIndex: number;
  segmentIndex: number;
  timestamp: number;
  start_seconds: number;
  end_seconds: number;
  duration_seconds: number;
  summary: string;
  translations?: TranslatedText;
  risk_score?: number;
  confidence?: number;
  type: string;
  event?: {
    id: string;
    description: string;
    type: string;
    confidence: number;
    timestamp?: number;
    start_millis?: number;
    end_millis?: number;
    translations?: TranslatedFields;
  };
  person?: {
    id: string;
    description: string;
    confidence: number;
    first_seen?: number;
    last_seen?: number;
    translations?: TranslatedFields;
  };
  object?: {
    id: string;
    description: string;
    suspicious: boolean;
    risk_relevance: string;
    confidence: number;
    first_seen?: number;
    last_seen?: number;
    translations?: TranslatedFields;
  };
}

interface AnalysisResult {
  events: Event[];
  summary: string | TranslatedText;
  chapters?: ChapterData[];
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
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [videoS3Key, setVideoS3Key] = useState<string>("");
  //const [jobId, setJobId] = useState<string>("");
  const [pollingStatus, setPollingStatus] = useState<string>("");
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [language, setLanguage] = useState<"en" | "ar">("en"); // Add language state

  const [editingField, setEditingField] = useState<{
    chapterId: string;
    field: "summary" | "event" | "person" | "object";
    subfield?: "description" | "type";
  } | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // Store edited results
  const [editedResults, setEditedResults] = useState<AnalysisResult | null>(
    null
  );

  // Use edited results if available, otherwise use original
  const displayResults = editedResults || analysisResult;

  const videoRef = useRef<HTMLVideoElement>(null);

  // Edit button component
  const EditButton: React.FC<{
    onClick: () => void;
    isEditing: boolean;
  }> = ({ onClick, isEditing }) => (
    <button
      className={`edit-btn ${isEditing ? "disabled" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={isEditing}
      title={language === "ar" ? "تعديل" : "Edit"}
    >
      <Pencil size={20} />
    </button>
  );

  const isValidSessionId = (sessionId: string): boolean => {
    const pattern = /^session-\d{14}-[a-fA-F0-9]{8}$/;
    return pattern.test(sessionId);
  };

  // Helper function to get summary text based on language
  const getSummaryText = (summary: string | TranslatedText): string => {
    console.log("Current language:", language);

    if (typeof summary === "string") {
      return summary;
    }

    const result =
      summary[language as keyof TranslatedText] || summary.en || "";
    return result;
  };

  // Helper function to get chapter summary based on language
  const getChapterSummary = (chapter: ChapterData): string => {
    if (chapter.translations && chapter.translations[language]) {
      return chapter.translations[language];
    }
    return chapter.summary;
  };

  // Helper function to get event fields based on language
  const getEventText = (
    event: ChapterData["event"],
    field: "description" | "type" | "confidence"
  ): string => {
    if (!event) return "";

    if (event.translations?.[language]?.[field]) {
      return event.translations[language][field] || "";
    }

    // Fallback to original fields
    if (field === "description") return event.description || "";
    if (field === "type") return event.type || "";
    if (field === "confidence")
      return event.confidence ? `${event.confidence}% confidence` : "";
    return "";
  };

  // Helper function to get person fields based on language
  const getPersonText = (
    person: ChapterData["person"],
    field: "description" | "confidence"
  ): string => {
    if (!person) return "";

    if (person.translations?.[language]?.[field]) {
      return person.translations[language][field] || "";
    }

    if (field === "description") return person.description || "";
    if (field === "confidence")
      return person.confidence ? `${person.confidence}% confidence` : "";
    return "";
  };

  // Helper function to get object fields based on language
  const getObjectText = (
    object: ChapterData["object"],
    field: "description" | "confidence"
  ): string => {
    if (!object) return "";

    if (object.translations?.[language]?.[field]) {
      return object.translations[language][field] || "";
    }

    if (field === "description") return object.description || "";
    if (field === "confidence")
      return object.confidence ? `${object.confidence}% confidence` : "";
    return "";
  };

  // Helper functions for bda results editing
  const startEditing = (
    chapterId: string,
    field: "summary" | "event" | "person" | "object",
    currentValue: string,
    subfield?: "description" | "type"
  ) => {
    setEditingField({ chapterId, field, subfield });
    setEditValue(currentValue);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingField(null);
    setEditValue("");
  };

  // Save edited value
  const saveEdit = () => {
    if (!editingField || !displayResults) return;

    // Create a deep copy of the results
    const updatedResults = JSON.parse(JSON.stringify(displayResults));

    // Find the chapter to update
    const chapterIndex = updatedResults.chapters?.findIndex(
      (ch: ChapterData) => ch.id === editingField.chapterId
    );

    if (chapterIndex === -1 || chapterIndex === undefined) return;

    const chapter = updatedResults.chapters[chapterIndex];

    // Update the appropriate field
    if (editingField.field === "summary") {
      chapter.summary = editValue;
      // Update translations
      if (chapter.translations) {
        chapter.translations[language] = editValue;
      }
    } else if (editingField.field === "event" && chapter.event) {
      if (editingField.subfield === "description") {
        chapter.event.description = editValue;
        if (chapter.event.translations) {
          chapter.event.translations[language].description = editValue;
        }
      } else if (editingField.subfield === "type") {
        chapter.event.type = editValue;
        if (chapter.event.translations) {
          chapter.event.translations[language].type = editValue;
        }
      }
    } else if (editingField.field === "person" && chapter.person) {
      chapter.person.description = editValue;
      if (chapter.person.translations) {
        chapter.person.translations[language].description = editValue;
      }
    } else if (editingField.field === "object" && chapter.object) {
      chapter.object.description = editValue;
      if (chapter.object.translations) {
        chapter.object.translations[language].description = editValue;
      }
    }

    setEditedResults(updatedResults);
    setEditingField(null);
    setEditValue("");
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

  // Extract and store video duration from frontend video element
  const handleVideoLoaded = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const duration = e.currentTarget.duration;
    console.log("Loaded metadata → duration:", duration);

    if (!isNaN(duration) && duration > 0) {
      setVideoDuration(duration);
    } else {
      console.warn("Video duration not ready yet");
    }
  };

  // Poll for analysis results - UPDATED to use s3Key
  const pollForResults = async (s3Key: string, expectedSegments: number) => {
    const maxAttempts = 120; // 20 minutes max
    const pollInterval = 10000; // 10 seconds
    let attempts = 0;

    const poll = async () => {
      attempts++;
      setPollingStatus(`Checking results... (${attempts}/${maxAttempts})`);

      try {
        const response = await fetch(
          `${process.env.REACT_APP_API_ENDPOINT}/footage/results`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              s3Key,
              expectedSegments, // Pass expected segments
            }),
          }
        );

        const data = await response.json();

        // Handle 202 - Still processing
        if (response.status === 202) {
          setPollingStatus(
            `Analysis in progress: ${data.segmentsCompleted || 0}/${
              data.segmentsExpected || expectedSegments
            } segments completed...`
          );
          if (attempts < maxAttempts) {
            setTimeout(poll, pollInterval);
          } else {
            setIsAnalyzing(false);
            setPollingStatus("Analysis timed out");
            setAnalysisResult({
              summary: "Analysis timed out after 20 minutes",
              events: [],
              chapters: [],
              processedAt: new Date(),
            });
          }
          return;
        }

        // Handle 200 - Complete
        if (response.status === 200 && data.status === "complete") {
          console.log("Analysis complete:", data);
          setAnalysisResult({
            summary: data.results.summary || "No summary available",
            events: data.results.events || [],
            chapters: data.results.chapters || [],
            metadata: data.results.metadata,
            processedAt: new Date(),
          });
          setIsAnalyzing(false);
          setPollingStatus(
            `Analysis complete! (${data.segmentsCompleted} segment(s) processed)`
          );
          return;
        }

        // Handle other status codes
        throw new Error(`Unexpected status: ${response.status}`);
      } catch (error: any) {
        console.error("Polling error:", error);
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        } else {
          setIsAnalyzing(false);
          setPollingStatus("Analysis failed or timed out");
          setAnalysisResult({
            summary: error.message || "Analysis failed",
            events: [],
            chapters: [],
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
            segmentLengthSeconds: 300,
            videoDurationSeconds: videoDuration ?? 0,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Analysis request failed");
      }

      console.log("Analysis job started:", result);
      console.log(`${result.segmentsStarted} segment job(s) created`);

      // Use expected_segments from backend response
      const expectedSegments =
        result.expected_segments || result.segmentsStarted;
      console.log("Using expectedSegments:", expectedSegments);
      setPollingStatus(
        `Analysis in progress (${expectedSegments} segment(s))...`
      );
      pollForResults(videoS3Key, expectedSegments);
    } catch (error: any) {
      console.error("Analysis error:", error);
      setIsAnalyzing(false);
      setPollingStatus("");
      setAnalysisResult({
        summary: error.message || "Analysis failed",
        events: [],
        chapters: [],
        processedAt: new Date(),
      });
    }
  };

  const handleTimelineClick = (timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
    }
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapter(expandedChapter === chapterId ? null : chapterId);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getVideoDuration = (): number => {
    return videoDuration || analysisResult?.metadata?.duration_seconds || 0;
  };

  const getRiskScoreColor = (score?: number): string => {
    if (!score) return "#666";
    if (score >= 80) return "#dc3545"; // High risk - red
    if (score >= 50) return "#ffc107"; // Medium risk - yellow
    return "#28a745"; // Low risk - green
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
                    onLoadedMetadata={handleVideoLoaded}
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
                    disabled={isAnalyzing || videoDuration === null}
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
                {/* Video Summary Section */}
                {displayResults?.chapters &&
                displayResults.chapters.length > 1 &&
                displayResults.chapters.some(
                  (chapter) => chapter.segmentIndex
                ) ? (
                  <div className="video-summary-section">
                    <h3 className="section-header">
                      {language === "ar" ? "ملخص الفيديو" : "Video Summary"}
                    </h3>
                    <div className="summary-card">
                      <p
                        className="summary-text"
                        dir={language === "ar" ? "rtl" : "ltr"}
                      >
                        {language === "ar"
                          ? "تم تقسيم هذا الفيديو إلى أجزاء. يتم عرض الملخصات لكل فصل أدناه."
                          : "This video has been segmented. Summaries are displayed for each chapter below."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="video-summary-section">
                    <h3 className="section-header">
                      {language === "ar" ? "ملخص الفيديو" : "Video Summary"}
                    </h3>
                    <div className="summary-card">
                      {editingField?.chapterId === "global-summary" &&
                      editingField?.field === "summary" ? (
                        <div className="edit-mode">
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="edit-textarea"
                            dir={language === "ar" ? "rtl" : "ltr"}
                            rows={4}
                            autoFocus
                          />
                          <div className="edit-actions">
                            <button
                              className="save-btn"
                              onClick={() => {
                                if (!editingField || !displayResults) return;
                                const updatedResults = JSON.parse(
                                  JSON.stringify(displayResults)
                                );

                                // Update both the summary and its translations
                                if (
                                  typeof updatedResults.summary === "string"
                                ) {
                                  updatedResults.summary = {
                                    en:
                                      language === "en"
                                        ? editValue
                                        : updatedResults.summary,
                                    ar:
                                      language === "ar"
                                        ? editValue
                                        : updatedResults.summary,
                                  };
                                } else {
                                  updatedResults.summary[language] = editValue;
                                }

                                setEditedResults(updatedResults);
                                setEditingField(null);
                                setEditValue("");
                              }}
                              title={language === "ar" ? "حفظ" : "Save"}
                            >
                              <Check size={16} />
                              {language === "ar" ? "حفظ" : "Save"}
                            </button>
                            <button
                              className="cancel-btn"
                              onClick={cancelEditing}
                              title={language === "ar" ? "إلغاء" : "Cancel"}
                            >
                              <X size={16} />
                              {language === "ar" ? "إلغاء" : "Cancel"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="view-mode">
                          <p
                            className="summary-text"
                            dir={language === "ar" ? "rtl" : "ltr"}
                          >
                            {getSummaryText(displayResults?.summary || "")}
                          </p>
                          <EditButton
                            onClick={() =>
                              startEditing(
                                "global-summary",
                                "summary",
                                getSummaryText(displayResults?.summary || "")
                              )
                            }
                            isEditing={
                              editingField?.chapterId === "global-summary" &&
                              editingField?.field === "summary"
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Video Chapters Section */}
                {displayResults?.chapters &&
                  displayResults.chapters.length > 0 && (
                    <div className="chapters-section">
                      <h3 className="section-header">
                        {language === "ar" ? "فصول الفيديو" : "Video Chapters"}{" "}
                        ({displayResults.chapters.length})
                      </h3>
                      <div className="chapters-list">
                        {displayResults.chapters.map((chapter: ChapterData) => (
                          <div key={chapter.id} className="chapter-card">
                            {/* Chapter Header - Clickable */}
                            <div
                              className="chapter-header"
                              onClick={() => {
                                toggleChapter(chapter.id);
                                handleTimelineClick(chapter.start_seconds);
                              }}
                            >
                              <div className="chapter-header-left">
                                <span className="chapter-icon">
                                  {expandedChapter === chapter.id ? "▼" : "▶"}
                                </span>
                                <div className="chapter-info">
                                  <div className="chapter-title">
                                    {language === "ar" ? "الفصل" : "Chapter"}{" "}
                                    {chapter.displayIndex}
                                  </div>
                                  <div className="chapter-time">
                                    {formatTime(chapter.start_seconds)} -{" "}
                                    {formatTime(chapter.end_seconds)} (
                                    {formatTime(chapter.duration_seconds)}{" "}
                                    {language === "ar" ? "المدة" : "duration"})
                                  </div>
                                </div>
                              </div>
                              <div className="chapter-header-right">
                                {chapter.risk_score !== undefined && (
                                  <span
                                    className="risk-badge"
                                    style={{
                                      backgroundColor: getRiskScoreColor(
                                        chapter.risk_score
                                      ),
                                    }}
                                  >
                                    {language === "ar" ? "المخاطر" : "Risk"}:{" "}
                                    {chapter.risk_score}
                                  </span>
                                )}
                                {chapter.confidence !== undefined && (
                                  <span className="confidence-badge">
                                    {language === "ar"
                                      ? `الثقة: ${Math.round(
                                          chapter.confidence
                                        )}%`
                                      : `${Math.round(
                                          chapter.confidence
                                        )}% confidence`}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Chapter Summary */}
                            <div className="chapter-summary">
                              {editingField?.chapterId === chapter.id &&
                              editingField?.field === "summary" ? (
                                <div className="edit-mode">
                                  <textarea
                                    value={editValue}
                                    onChange={(e) =>
                                      setEditValue(e.target.value)
                                    }
                                    className="edit-textarea"
                                    dir={language === "ar" ? "rtl" : "ltr"}
                                    rows={4}
                                    autoFocus
                                  />
                                  <div className="edit-actions">
                                    <button
                                      className="save-btn"
                                      onClick={saveEdit}
                                      title={language === "ar" ? "حفظ" : "Save"}
                                    >
                                      <Check size={16} />
                                      {language === "ar" ? "حفظ" : "Save"}
                                    </button>
                                    <button
                                      className="cancel-btn"
                                      onClick={cancelEditing}
                                      title={
                                        language === "ar" ? "إلغاء" : "Cancel"
                                      }
                                    >
                                      <X size={16} />
                                      {language === "ar" ? "إلغاء" : "Cancel"}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="view-mode">
                                  <p dir={language === "ar" ? "rtl" : "ltr"}>
                                    {getChapterSummary(chapter)}
                                  </p>
                                  <EditButton
                                    onClick={() =>
                                      startEditing(
                                        chapter.id,
                                        "summary",
                                        getChapterSummary(chapter)
                                      )
                                    }
                                    isEditing={
                                      editingField?.chapterId === chapter.id &&
                                      editingField?.field === "summary"
                                    }
                                  />
                                </div>
                              )}
                            </div>

                            {/* Expanded Chapter Details */}
                            {expandedChapter === chapter.id && (
                              <div className="chapter-details">
                                {/* Event Detection */}
                                {chapter.event && (
                                  <div
                                    className="detail-card event-card"
                                    onClick={() => {
                                      if (
                                        chapter.event?.timestamp !== undefined
                                      ) {
                                        handleTimelineClick(
                                          chapter.event.timestamp
                                        );
                                      } else if (
                                        chapter.event?.start_millis !==
                                        undefined
                                      ) {
                                        handleTimelineClick(
                                          chapter.event.start_millis / 1000
                                        );
                                      }
                                    }}
                                  >
                                    <div className="detail-header">
                                      <span className="detail-title">
                                        {language === "ar"
                                          ? "تم اكتشاف حدث"
                                          : "Activity Detected"}
                                      </span>
                                      <div className="detail-header-badges">
                                        {chapter.event.type && (
                                          <span className="event-type-badge">
                                            {getEventText(
                                              chapter.event,
                                              "type"
                                            )}
                                          </span>
                                        )}
                                        {chapter.event.confidence && (
                                          <span className="confidence-badge">
                                            {getEventText(
                                              chapter.event,
                                              "confidence"
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="detail-content">
                                      {editingField?.chapterId === chapter.id &&
                                      editingField?.field === "event" &&
                                      editingField?.subfield ===
                                        "description" ? (
                                        <div className="edit-mode">
                                          <textarea
                                            value={editValue}
                                            onChange={(e) =>
                                              setEditValue(e.target.value)
                                            }
                                            className="edit-textarea"
                                            dir={
                                              language === "ar" ? "rtl" : "ltr"
                                            }
                                            rows={3}
                                            autoFocus
                                          />
                                          <div className="edit-actions">
                                            <button
                                              className="save-btn"
                                              onClick={saveEdit}
                                            >
                                              <Check size={16} />
                                              {language === "ar"
                                                ? "حفظ"
                                                : "Save"}
                                            </button>
                                            <button
                                              className="cancel-btn"
                                              onClick={cancelEditing}
                                            >
                                              <X size={16} />
                                              {language === "ar"
                                                ? "إلغاء"
                                                : "Cancel"}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="view-mode">
                                          <p
                                            className="detail-description"
                                            dir={
                                              language === "ar" ? "rtl" : "ltr"
                                            }
                                          >
                                            {getEventText(
                                              chapter.event,
                                              "description"
                                            )}
                                          </p>
                                          <EditButton
                                            onClick={() =>
                                              startEditing(
                                                chapter.id,
                                                "event",
                                                getEventText(
                                                  chapter.event!,
                                                  "description"
                                                ),
                                                "description"
                                              )
                                            }
                                            isEditing={
                                              editingField?.chapterId ===
                                                chapter.id &&
                                              editingField?.field === "event" &&
                                              editingField?.subfield ===
                                                "description"
                                            }
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Person Detection */}
                                {chapter.person && (
                                  <div
                                    className="detail-card person-card"
                                    onClick={() => {
                                      if (
                                        chapter.person?.first_seen !== undefined
                                      ) {
                                        handleTimelineClick(
                                          chapter.person.first_seen
                                        );
                                      }
                                    }}
                                  >
                                    <div className="detail-header">
                                      <span className="detail-title">
                                        {language === "ar"
                                          ? "تم اكتشاف أشخاص"
                                          : "Person Identified"}
                                      </span>
                                      {chapter.person.confidence && (
                                        <span className="confidence-badge">
                                          {getPersonText(
                                            chapter.person,
                                            "confidence"
                                          )}
                                        </span>
                                      )}
                                    </div>
                                    <div className="detail-content">
                                      {editingField?.chapterId === chapter.id &&
                                      editingField?.field === "person" ? (
                                        <div className="edit-mode">
                                          <textarea
                                            value={editValue}
                                            onChange={(e) =>
                                              setEditValue(e.target.value)
                                            }
                                            className="edit-textarea"
                                            dir={
                                              language === "ar" ? "rtl" : "ltr"
                                            }
                                            rows={3}
                                            autoFocus
                                          />
                                          <div className="edit-actions">
                                            <button
                                              className="save-btn"
                                              onClick={saveEdit}
                                            >
                                              <Check size={16} />
                                              {language === "ar"
                                                ? "حفظ"
                                                : "Save"}
                                            </button>
                                            <button
                                              className="cancel-btn"
                                              onClick={cancelEditing}
                                            >
                                              <X size={16} />
                                              {language === "ar"
                                                ? "إلغاء"
                                                : "Cancel"}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="view-mode">
                                          <p
                                            className="detail-description"
                                            dir={
                                              language === "ar" ? "rtl" : "ltr"
                                            }
                                          >
                                            {getPersonText(
                                              chapter.person,
                                              "description"
                                            )}
                                          </p>
                                          <EditButton
                                            onClick={() =>
                                              startEditing(
                                                chapter.id,
                                                "person",
                                                getPersonText(
                                                  chapter.person!,
                                                  "description"
                                                )
                                              )
                                            }
                                            isEditing={
                                              editingField?.chapterId ===
                                                chapter.id &&
                                              editingField?.field === "person"
                                            }
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Object Detection */}
                                {chapter.object && (
                                  <div
                                    className={`detail-card object-card ${
                                      chapter.object.suspicious
                                        ? "suspicious"
                                        : ""
                                    }`}
                                    onClick={() => {
                                      if (
                                        chapter.object?.first_seen !== undefined
                                      ) {
                                        handleTimelineClick(
                                          chapter.object.first_seen
                                        );
                                      }
                                    }}
                                  >
                                    <div className="detail-header">
                                      <span className="detail-title">
                                        {language === "ar"
                                          ? "تم اكتشاف شيء"
                                          : "Object Detected"}
                                      </span>
                                      <div className="detail-header-badges">
                                        {chapter.object.suspicious && (
                                          <span className="suspicious-badge">
                                            {language === "ar"
                                              ? "مشبوه"
                                              : "Suspicious"}
                                          </span>
                                        )}
                                        {chapter.object.confidence && (
                                          <span className="confidence-badge">
                                            {getObjectText(
                                              chapter.object,
                                              "confidence"
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="detail-content">
                                      {editingField?.chapterId === chapter.id &&
                                      editingField?.field === "object" ? (
                                        <div className="edit-mode">
                                          <textarea
                                            value={editValue}
                                            onChange={(e) =>
                                              setEditValue(e.target.value)
                                            }
                                            className="edit-textarea"
                                            dir={
                                              language === "ar" ? "rtl" : "ltr"
                                            }
                                            rows={3}
                                            autoFocus
                                          />
                                          <div className="edit-actions">
                                            <button
                                              className="save-btn"
                                              onClick={saveEdit}
                                            >
                                              <Check size={16} />
                                              {language === "ar"
                                                ? "حفظ"
                                                : "Save"}
                                            </button>
                                            <button
                                              className="cancel-btn"
                                              onClick={cancelEditing}
                                            >
                                              <X size={16} />
                                              {language === "ar"
                                                ? "إلغاء"
                                                : "Cancel"}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="view-mode">
                                          <p
                                            className="detail-description"
                                            dir={
                                              language === "ar" ? "rtl" : "ltr"
                                            }
                                          >
                                            {getObjectText(
                                              chapter.object,
                                              "description"
                                            )}
                                          </p>
                                          <EditButton
                                            onClick={() =>
                                              startEditing(
                                                chapter.id,
                                                "object",
                                                getObjectText(
                                                  chapter.object!,
                                                  "description"
                                                )
                                              )
                                            }
                                            isEditing={
                                              editingField?.chapterId ===
                                                chapter.id &&
                                              editingField?.field === "object"
                                            }
                                          />
                                        </div>
                                      )}
                                      {chapter.object.risk_relevance && (
                                        <p
                                          className="risk-relevance"
                                          dir={
                                            language === "ar" ? "rtl" : "ltr"
                                          }
                                        >
                                          <strong>
                                            {language === "ar"
                                              ? "تقييم المخاطر:"
                                              : "Risk Assessment:"}
                                          </strong>{" "}
                                          {chapter.object.risk_relevance}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Language Toggle */}
                <div className="language-toggle">
                  <span className="language-toggle-label">
                    {language === "ar" ? "اللغة:" : "Language:"}
                  </span>
                  <button
                    className={`language-btn ${
                      language === "en" ? "active" : ""
                    }`}
                    onClick={() => setLanguage("en")}
                  >
                    English
                  </button>
                  <button
                    className={`language-btn ${
                      language === "ar" ? "active" : ""
                    }`}
                    onClick={() => setLanguage("ar")}
                  >
                    العربية
                  </button>
                </div>

                <div className="export-actions">
                  <button className="continue-btn">
                    {language === "ar"
                      ? "تصدير التقرير PDF"
                      : "Export Report ad PDF"}
                  </button>
                  <button className="continue-btn secondary">
                    {language === "ar"
                      ? "تحميل حزمة الأدلة"
                      : "Download Evidence Package"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="no-results">
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
