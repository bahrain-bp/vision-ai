import React, { useRef, useState } from "react";
import { Pencil, Check, X, AlertTriangle } from "lucide-react";
import "../../../ProcessingView.css";
import { SessionData } from "../ProcessingView";
import { exportAnalysisResultsAsPDF } from "../../../services/CamFootageAnalysis/AnalysisPdfExportService";

interface CameraFootageProps {
  sessionData: SessionData;
  language: "en" | "ar";
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
  language,
}) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  console.log(uploadError);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [videoS3Key, setVideoS3Key] = useState<string>("");
  //const [jobId, setJobId] = useState<string>("");
  const [pollingStatus, setPollingStatus] = useState<string>("");
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

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
  const [isExporting, setIsExporting] = useState(false);
  const [banner, setBanner] = useState<{
    type: "success" | "error" | "warning" | "info";
    message: string;
  } | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

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

  // Helper function to show banner
  const showBanner = (
    type: "success" | "error" | "warning" | "info",
    message: string,
    duration: number = 5000
  ) => {
    setBanner({ type, message });
    if (duration > 0) {
      setTimeout(() => setBanner(null), duration);
    }
  };

  // reset function for new uplaod
  const resetForNewUpload = () => {
    setVideoFile(null);
    setVideoUrl(null);
    setAnalysisResult(null);
    setEditedResults(null);
    setExpandedChapter(null);
    setPollingStatus("");
    setVideoS3Key("");
    setVideoDuration(null);
    setShowResetModal(false);
    showBanner(
      "info",
      language === "ar"
        ? "النظام جاهز لتحميل فيديو جديد"
        : "Ready for new video upload."
    );
  };

  // Helper function to automatically export results with expanded chapters
  const exportWithExpandedChapters = async () => {
    setIsExporting(true);
    showBanner(
      "info",
      language === "ar"
        ? "جاري تحضير تصدير ملف PDF..."
        : "Preparing PDF export...",
      0
    );

    // Wait for re-render with all chapters expanded
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      exportAnalysisResultsAsPDF(
        videoFile?.name || "video-analysis",
        _sessionData?.sessionId || "unknown",
        language
      );
      showBanner(
        "success",
        language === "ar"
          ? "تم تصدير ملف PDF بنجاح!"
          : "PDF exported successfully!"
      );
    } catch (error) {
      showBanner(
        "error",
        language === "ar"
          ? "فشل تصدير ملف PDF. يرجى المحاولة مرة أخرى."
          : "Failed to export PDF. Please try again."
      );
    }

    setTimeout(() => {
      setIsExporting(false);
    }, 500);
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
    showBanner(
      "success",
      language === "ar"
        ? "تم حفظ التغييرات بنجاح!"
        : "Changes saved successfully!"
    );
    setEditingField(null);
    setEditValue("");
  };

  // Handle video upload
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "video/mp4",
      "video/avi",
      "video/quicktime",
      "video/x-msvideo",
    ];
    if (!validTypes.includes(file.type)) {
      console.log("[Debug] Invalid file type:", file.type);
      showBanner(
        "error",
        language === "ar"
          ? "يرجى تحميل ملف فيديو (MP4, AVI, أو MOV)."
          : "Please upload a valid video file (MP4, AVI, or MOV)."
      );
      return;
    }

    // Validate file size (2GB max)
    const maxSize = 2 * 1024 * 1024 * 1024;
    if (file.size > maxSize) {
      console.log("[Debug] File too large:", file.size);
      showBanner(
        "error",
        language === "ar"
          ? "ملف الفيديو كبير جداً. الحد الأقصى 2 جيجابايت."
          : "Video file is too large. Maximum size is 2GB."
      );
      return;
    }

    let sessionId = _sessionData?.sessionId || "unknown";

    if (!isValidSessionId(sessionId)) {
      console.error("[Debug] Invalid session ID:", sessionId);
      showBanner(
        "error",
        language === "ar"
          ? "انتهت صلاحية الجلسة. يرجى تحديث الصفحة."
          : "Session expired. Please refresh the page."
      );
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    showBanner(
      "info",
      language === "ar" ? "جاري تحميل الفيديو..." : "Uploading your video...",
      0
    );

    try {
      console.log("[Debug] Getting presigned URL for:", file.name);

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
      console.log("[Debug] Presigned URL received:", uploadData);

      // Step 2: Upload to S3
      console.log("[Debug] Uploading to S3...");
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
      console.log("[Debug] Upload successful, S3 key:", uploadData.s3Key);
      setVideoFile(file);
      setVideoS3Key(uploadData.s3Key);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      showBanner(
        "success",
        language === "ar"
          ? "تم تحميل الفيديو بنجاح! النظام جاهز للتحليل."
          : "Video uploaded successfully! Ready to analyze."
      );
    } catch (error: any) {
      showBanner(
        "error",
        language === "ar"
          ? "فشل التحميل. يرجى التحقق من اتصالك والمحاولة مرة أخرى."
          : "Upload failed. Please check your connection and try again."
      );
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

    // User-friendly progress messages
    const progressMessages =
      language === "ar"
        ? [
            "جاري تحليل محتوى الفيديو...",
            "جاري اكتشاف الأنشطة والأشياء...",
            "جاري التعرف على الأشخاص...",
            "جاري معالجة تفاصيل المشهد...",
            "جاري استخراج اللحظات المهمة...",
            "جاري إنشاء الجدول الزمني...",
            "على وشك الانتهاء...",
            "جاري إنهاء التحليل...",
          ]
        : [
            "Analyzing video content...",
            "Detecting activities and objects...",
            "Identifying people in footage...",
            "Processing scene details...",
            "Extracting key moments...",
            "Generating timeline...",
            "Almost there...",
            "Finalizing analysis...",
          ];

    const getProgressMessage = (completed: number, total: number): string => {
      const progress = completed / total;
      if (progress < 0.15) return progressMessages[0];
      if (progress < 0.3) return progressMessages[1];
      if (progress < 0.45) return progressMessages[2];
      if (progress < 0.6) return progressMessages[3];
      if (progress < 0.75) return progressMessages[4];
      if (progress < 0.85) return progressMessages[5];
      if (progress < 0.95) return progressMessages[6];
      return progressMessages[7];
    };

    const poll = async () => {
      attempts++;

      // Console log for debugging
      console.log(`[Debug] Polling attempt ${attempts}/${maxAttempts}`);

      try {
        const response = await fetch(
          `${process.env.REACT_APP_API_ENDPOINT}/footage/results`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              s3Key,
              expectedSegments,
            }),
          }
        );

        const data = await response.json();

        // Handle 202 - Still processing
        if (response.status === 202) {
          const completed = data.segmentsCompleted || 0;
          const total = data.segmentsExpected || expectedSegments;

          // Console log for debugging
          console.log(
            `[Debug] Progress: ${completed}/${total} segments completed`
          );

          // User-friendly message
          const userMessage = getProgressMessage(completed, total);
          setPollingStatus(userMessage);
          showBanner("info", userMessage, 0);

          if (attempts < maxAttempts) {
            setTimeout(poll, pollInterval);
          } else {
            console.error("[Debug] Analysis timed out after max attempts");
            setIsAnalyzing(false);
            setPollingStatus("");
            showBanner(
              "warning",
              language === "ar"
                ? "التحليل يستغرق وقتاً أطول من المتوقع. يرجى الانتظار أو المحاولة لاحقاً."
                : "Analysis is taking longer than expected. Please wait or try again later."
            );
            setAnalysisResult({
              summary:
                language === "ar"
                  ? "انتهت مهلة التحليل. يرجى المحاولة مرة أخرى."
                  : "Analysis timed out. Please try again.",
              events: [],
              chapters: [],
              processedAt: new Date(),
            });
          }
          return;
        }

        // Handle 200 - Complete
        if (response.status === 200 && data.status === "complete") {
          console.log("[Debug] Analysis complete:", data);
          console.log(`[Debug] ${data.segmentsCompleted} segment(s) processed`);

          setAnalysisResult({
            summary: data.results.summary || "No summary available",
            events: data.results.events || [],
            chapters: data.results.chapters || [],
            metadata: data.results.metadata,
            processedAt: new Date(),
          });
          setIsAnalyzing(false);
          setPollingStatus("");

          // User-friendly success message
          const chaptersCount = data.results.chapters?.length || 0;
          showBanner(
            "success",
            chaptersCount > 0
              ? language === "ar"
                ? `اكتمل التحليل! تم العثور على ${chaptersCount} لحظة مهمة.`
                : `Analysis complete! Found ${chaptersCount} key moment${
                    chaptersCount > 1 ? "s" : ""
                  }.`
              : language === "ar"
              ? "اكتمل التحليل!"
              : "Analysis complete!"
          );
          return;
        }

        throw new Error(`Unexpected status: ${response.status}`);
      } catch (error: any) {
        console.error("[Debug] Polling error:", error);

        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        } else {
          setIsAnalyzing(false);
          setPollingStatus("");
          showBanner(
            "error",
            language === "ar"
              ? "حدث خطأ ما. يرجى المحاولة مرة أخرى."
              : "Something went wrong. Please try again."
          );
          setAnalysisResult({
            summary:
              language === "ar"
                ? "فشل التحليل. يرجى المحاولة مرة أخرى."
                : "Analysis failed. Please try again.",
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
    setPollingStatus(
      language === "ar" ? "جاري تحضير الفيديو..." : "Preparing your video..."
    );
    showBanner(
      "info",
      language === "ar"
        ? "جاري تحضير الفيديو للتحليل..."
        : "Preparing your video for analysis...",
      0
    );

    try {
      const sessionId = _sessionData?.sessionId || "unknown";

      // Console log for debugging
      console.log("[Debug] Starting analysis for:", videoS3Key);
      console.log("[Debug] Video duration:", videoDuration);

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

      // Console log for debugging
      console.log("[Debug] Analysis job started:", result);
      console.log(`[Debug] ${result.segmentsStarted} segment job(s) created`);
      console.log(pollingStatus);

      const expectedSegments =
        result.expected_segments || result.segmentsStarted;

      // User-friendly message
      setPollingStatus(
        language === "ar"
          ? "جاري تحليل محتوى الفيديو..."
          : "Analyzing video content..."
      );
      showBanner(
        "info",
        language === "ar"
          ? "جاري تحليل محتوى الفيديو..."
          : "Analyzing video content...",
        0
      );

      pollForResults(videoS3Key, expectedSegments);
    } catch (error: any) {
      console.error("[Debug] Analysis error:", error);
      setIsAnalyzing(false);
      setPollingStatus("");
      showBanner(
        "error",
        language === "ar"
          ? "فشل بدء التحليل. يرجى المحاولة مرة أخرى."
          : "Failed to start analysis. Please try again."
      );
      setAnalysisResult({
        summary:
          language === "ar"
            ? "فشل بدء التحليل. يرجى المحاولة مرة أخرى."
            : "Analysis failed to start. Please try again.",
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
    <div
      className="camera-footage-wrapper"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      {/* Notification Banner */}
      {banner && (
        <div className={`notification-banner banner-${banner.type}`}>
          <span className="banner-icon">
            {banner.type === "success"}
            {banner.type === "error"}
            {banner.type === "warning"}
            {banner.type === "info"}
          </span>
          <span className="banner-message">{banner.message}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {showResetModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-icon">
              <AlertTriangle size={48} color="#22417b" />
            </div>
            <h3 className="modal-title">
              {language === "ar" ? "هل أنت متأكد؟" : "Are you sure?"}
            </h3>
            <p className="modal-message">
              {language === "ar"
                ? "نتائج التحليل الحالية ستفقد. قم بتصديرها إذا كنت تود الاحتفاظ بها"
                : "Your current analysis results will be lost. Export the report as PDF if you want to keep them."}
            </p>
            <div className="modal-actions">
              <button
                className="modal-btn cancel"
                onClick={() => setShowResetModal(false)}
              >
                {language === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button className="modal-btn confirm" onClick={resetForNewUpload}>
                {language === "ar" ? "متابعة" : "Proceed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Title and Description */}
      <div className="camera-title" dir={language === "ar" ? "rtl" : "ltr"}>
        {language === "ar"
          ? "تحليل فيديوهات المراقبة"
          : "Camera Footage Analysis"}
      </div>
      <p className="camera-description" dir={language === "ar" ? "rtl" : "ltr"}>
        {language === "ar"
          ? "*قم بتحميل وتحليل فيديوهات المراقبة لاستخراج الأدلة"
          : "*Upload and analyze surveillance footage for evidence extraction"}
      </p>

      <div className="camera-footage-container">
        {/* Video Upload Section */}
        <div className="tab-section">
          <div
            className="tab-section-title"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            {language === "ar" ? "تحميل الفيديو" : "Video Upload"}
          </div>
          <div className="tab-section-content">
            {!videoUrl ? (
              <div className="video-upload-area">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="video-upload"
                  disabled={isUploading}
                />
                <label htmlFor="video-upload" className="upload-label">
                  <div className="upload-content">
                    <div className="upload-icon-cam">📹</div>
                    <div className="upload-text">
                      {language === "ar"
                        ? "تحميل ملف فيديو"
                        : "Upload Video File"}
                    </div>
                    <div className="upload-subtitle">
                      {language === "ar"
                        ? "MP4, AVI, MOV حتى 2 جيجابايت"
                        : "MP4, AVI, MOV up to 2GB"}
                    </div>
                  </div>
                </label>
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
                      {language === "ar" ? "جاري التحميل..." : "Uploading..."}
                    </>
                  ) : language === "ar" ? (
                    "انقر للتصفح أو اسحب وأفلت"
                  ) : (
                    "Click to browse or drag and drop"
                  )}
                </button>
              </div>
            ) : (
              <div className="video-player-container">
                <div className="video-wrapper">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    className="video-player"
                    onLoadedMetadata={handleVideoLoaded}
                  >
                    {language === "ar"
                      ? "متصفحك لا يدعم علامة الفيديو."
                      : "Your browser does not support the video tag."}
                  </video>
                </div>
                <div className="video-controls">
                  <div className="video-info">
                    {videoFile?.name} • {formatTime(getVideoDuration())}
                  </div>

                  {!analysisResult ? (
                    <button
                      onClick={startAnalysis}
                      disabled={isAnalyzing || videoDuration === null}
                      className={`continue-btn ${
                        isAnalyzing ? "analyzing" : ""
                      }`}
                    >
                      {isAnalyzing ? (
                        <>
                          <span className="processing-spinner">⟳</span>
                          {language === "ar"
                            ? "جاري التحليل..."
                            : "Analyzing..."}
                        </>
                      ) : language === "ar" ? (
                        "بدء التحليل"
                      ) : (
                        "Start Analysis"
                      )}
                    </button>
                  ) : (
                    <button
                      className="continue-btn"
                      onClick={() => setShowResetModal(true)}
                    >
                      {language === "ar"
                        ? "تحميل فيديو آخر"
                        : "Upload Another Video"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Analysis Results Section */}
        <div className="tab-section">
          <div
            className="tab-section-title"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            {language === "ar" ? "نتائج التحليل" : "Analysis Results"}
          </div>
          <div className="tab-section-content">
            {analysisResult ? (
              <div id="analysis-content">
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
                                    updatedResults.summary[language] =
                                      editValue;
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
                          {language === "ar"
                            ? "فصول الفيديو"
                            : "Video Chapters"}{" "}
                          ({displayResults.chapters.length})
                        </h3>
                        <div className="chapters-list">
                          {displayResults.chapters.map(
                            (chapter: ChapterData) => (
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
                                      {expandedChapter === chapter.id
                                        ? "▼"
                                        : "▶"}
                                    </span>
                                    <div className="chapter-info">
                                      <div className="chapter-title">
                                        {language === "ar"
                                          ? "الفصل"
                                          : "Chapter"}{" "}
                                        {chapter.displayIndex}
                                      </div>
                                      <div className="chapter-time">
                                        {formatTime(chapter.start_seconds)} -{" "}
                                        {formatTime(chapter.end_seconds)} (
                                        {formatTime(chapter.duration_seconds)}{" "}
                                        {language === "ar"
                                          ? "المدة"
                                          : "duration"}
                                        )
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
                                        {language === "ar" ? "المخاطر" : "Risk"}
                                        : {chapter.risk_score}
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
                                          title={
                                            language === "ar" ? "حفظ" : "Save"
                                          }
                                        >
                                          <Check size={16} />
                                          {language === "ar" ? "حفظ" : "Save"}
                                        </button>
                                        <button
                                          className="cancel-btn"
                                          onClick={cancelEditing}
                                          title={
                                            language === "ar"
                                              ? "إلغاء"
                                              : "Cancel"
                                          }
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
                                        dir={language === "ar" ? "rtl" : "ltr"}
                                      >
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
                                          editingField?.chapterId ===
                                            chapter.id &&
                                          editingField?.field === "summary"
                                        }
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Expanded Chapter Details */}
                                {(expandedChapter === chapter.id ||
                                  isExporting) && (
                                  <div className="chapter-details">
                                    {/* Event Detection */}
                                    {chapter.event && (
                                      <div
                                        className="detail-card event-card"
                                        onClick={() => {
                                          if (
                                            chapter.event?.timestamp !==
                                            undefined
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
                                          {editingField?.chapterId ===
                                            chapter.id &&
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
                                                  language === "ar"
                                                    ? "rtl"
                                                    : "ltr"
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
                                                  language === "ar"
                                                    ? "rtl"
                                                    : "ltr"
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
                                                  editingField?.field ===
                                                    "event" &&
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
                                            chapter.person?.first_seen !==
                                            undefined
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
                                          {editingField?.chapterId ===
                                            chapter.id &&
                                          editingField?.field === "person" ? (
                                            <div className="edit-mode">
                                              <textarea
                                                value={editValue}
                                                onChange={(e) =>
                                                  setEditValue(e.target.value)
                                                }
                                                className="edit-textarea"
                                                dir={
                                                  language === "ar"
                                                    ? "rtl"
                                                    : "ltr"
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
                                                  language === "ar"
                                                    ? "rtl"
                                                    : "ltr"
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
                                                  editingField?.field ===
                                                    "person"
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
                                            chapter.object?.first_seen !==
                                            undefined
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
                                          {editingField?.chapterId ===
                                            chapter.id &&
                                          editingField?.field === "object" ? (
                                            <div className="edit-mode">
                                              <textarea
                                                value={editValue}
                                                onChange={(e) =>
                                                  setEditValue(e.target.value)
                                                }
                                                className="edit-textarea"
                                                dir={
                                                  language === "ar"
                                                    ? "rtl"
                                                    : "ltr"
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
                                                  language === "ar"
                                                    ? "rtl"
                                                    : "ltr"
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
                                                  editingField?.field ===
                                                    "object"
                                                }
                                              />
                                            </div>
                                          )}
                                          {chapter.object.risk_relevance && (
                                            <p
                                              className="risk-relevance"
                                              dir={
                                                language === "ar"
                                                  ? "rtl"
                                                  : "ltr"
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
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {/* Export Actions */}
                  <div className="export-actions">
                    <button
                      className="continue-btn"
                      onClick={exportWithExpandedChapters}
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <>
                          <span className="processing-spinner">⟳</span>
                          {language === "ar"
                            ? "جاري التصدير..."
                            : "Exporting..."}
                        </>
                      ) : language === "ar" ? (
                        "تصدير التقرير PDF"
                      ) : (
                        "Export Report as PDF"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="no-results">
                <p dir={language === "ar" ? "rtl" : "ltr"}>
                  {language === "ar"
                    ? "قم بتحميل فيديو لبدء التحليل"
                    : "Upload a video to start analysis"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraFootage;
