import React, { useState } from "react";
import {
  Mic,
  FileAudio,
  Play,
  Loader2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";

interface AudioAnalysisProps {
  language: "en" | "ar";
}

interface TranscriptionResult {
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  transcription?: string;
  originalLanguage?: string;
  error?: string;
}

interface AnalysisResult {
  summary: string;
}

const AudioAnalysis: React.FC<AudioAnalysisProps> = ({ language }) => {
  // Upload state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedS3Key, setUploadedS3Key] = useState<string | null>(null);

  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] =
    useState<TranscriptionResult | null>(null);
  const [, setResultKey] = useState<string | null>(null);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );

  // Banner state
  const [banner, setBanner] = useState<{
    type: "success" | "error" | "warning" | "info";
    message: string;
  } | null>(null);

  // Reset modal state
  const [showResetModal, setShowResetModal] = useState(false);

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

  // Handle audio file upload
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/flac",
      "audio/ogg",
      "audio/mp4",
      "audio/x-m4a",
      "video/mp4",
    ];

    if (
      !validTypes.includes(file.type) &&
      !file.name.match(/\.(mp3|wav|flac|ogg|m4a|mp4)$/i)
    ) {
      showBanner(
        "error",
        language === "ar"
          ? "يرجى تحميل ملف صوتي صالح (MP3, WAV, FLAC, OGG, M4A)."
          : "Please upload a valid audio file (MP3, WAV, FLAC, OGG, M4A)."
      );
      return;
    }

    // Validate file size (500MB max)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      showBanner(
        "error",
        language === "ar"
          ? "ملف الصوت كبير جداً. الحد الأقصى 500 ميجابايت."
          : "Audio file is too large. Maximum size is 500MB."
      );
      return;
    }

    setIsUploading(true);
    showBanner(
      "info",
      language === "ar"
        ? "جاري تحميل الملف الصوتي..."
        : "Uploading audio file...",
      0
    );

    try {
      // Step 1: Get presigned URL
      const uploadUrlResponse = await fetch(
        `${process.env.REACT_APP_API_ENDPOINT}/audio/upload-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "audio/mpeg",
          }),
        }
      );

      if (!uploadUrlResponse.ok) {
        const error = await uploadUrlResponse.json();
        throw new Error(error.error || "Failed to get upload URL");
      }

      const uploadData = await uploadUrlResponse.json();
      console.log("[AudioAnalysis] Presigned URL received:", uploadData);

      // Step 2: Upload to S3
      const s3UploadResponse = await fetch(uploadData.uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "audio/mpeg",
        },
      });

      if (!s3UploadResponse.ok) {
        throw new Error("Failed to upload audio to S3");
      }

      // Step 3: Success
      console.log(
        "[AudioAnalysis] Upload successful, S3 key:",
        uploadData.s3Key
      );
      setAudioFile(file);
      setUploadedS3Key(uploadData.s3Key);
      setAudioUrl(URL.createObjectURL(file));
      setTranscriptionResult(null);
      setAnalysisResult(null);

      showBanner(
        "success",
        language === "ar"
          ? "تم تحميل الملف الصوتي بنجاح! جاهز للنسخ."
          : "Audio file uploaded successfully! Ready for transcription."
      );
    } catch (error: any) {
      console.error("[AudioAnalysis] Upload error:", error);
      showBanner(
        "error",
        language === "ar"
          ? "فشل التحميل. يرجى المحاولة مرة أخرى."
          : "Upload failed. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Start transcription
  const startTranscription = async () => {
    if (!uploadedS3Key) {
      showBanner(
        "error",
        language === "ar"
          ? "يرجى تحميل ملف صوتي أولاً."
          : "Please upload an audio file first."
      );
      return;
    }

    setIsTranscribing(true);
    setTranscriptionResult(null);
    showBanner(
      "info",
      language === "ar"
        ? "جاري بدء النسخ والترجمة..."
        : "Starting transcription and translation...",
      0
    );

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_ENDPOINT}/audio/transcribe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: uploadedS3Key,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start transcription");
      }

      const data = await response.json();
      console.log("[AudioAnalysis] Transcription started:", data);
      setResultKey(data.resultKey);

      pollForTranscriptionResults(data.resultKey);
    } catch (error: any) {
      console.error("[AudioAnalysis] Transcription error:", error);
      setIsTranscribing(false);
      showBanner(
        "error",
        language === "ar"
          ? "فشل بدء النسخ. يرجى المحاولة مرة أخرى."
          : "Failed to start transcription. Please try again."
      );
    }
  };

  // Poll for transcription results
  const pollForTranscriptionResults = async (key: string) => {
    const maxAttempts = 60;
    const pollInterval = 5000;
    let attempts = 0;

    const progressMessages =
      language === "ar"
        ? [
            "جاري نسخ الصوت...",
            "جاري اكتشاف اللغة...",
            "جاري معالجة الكلام...",
            "جاري الترجمة إلى العربية...",
            "على وشك الانتهاء...",
          ]
        : [
            "Transcribing audio...",
            "Detecting language...",
            "Processing speech...",
            "Translating to Arabic...",
            "Almost done...",
          ];

    const poll = async () => {
      attempts++;
      console.log(`[AudioAnalysis] Polling attempt ${attempts}/${maxAttempts}`);

      const messageIndex = Math.min(
        Math.floor(attempts / 3),
        progressMessages.length - 1
      );
      showBanner("info", progressMessages[messageIndex], 0);

      try {
        const response = await fetch(
          `${
            process.env.REACT_APP_API_ENDPOINT
          }/audio/result?key=${encodeURIComponent(key)}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }
        );

        const data = await response.json();
        console.log("[AudioAnalysis] Poll result:", data);

        if (data.status === "PROCESSING") {
          if (attempts < maxAttempts) {
            setTimeout(poll, pollInterval);
          } else {
            setIsTranscribing(false);
            showBanner(
              "warning",
              language === "ar"
                ? "النسخ يستغرق وقتاً أطول من المتوقع. يرجى المحاولة لاحقاً."
                : "Transcription is taking longer than expected. Please try again later."
            );
          }
          return;
        }

        if (data.status === "COMPLETED") {
          setTranscriptionResult(data);
          setIsTranscribing(false);
          showBanner(
            "success",
            language === "ar"
              ? "تم النسخ والترجمة بنجاح!"
              : "Transcription and translation completed!"
          );
          return;
        }

        if (data.status === "FAILED") {
          setIsTranscribing(false);
          showBanner(
            "error",
            language === "ar"
              ? `فشل النسخ: ${data.error || "خطأ غير معروف"}`
              : `Transcription failed: ${data.error || "Unknown error"}`
          );
          return;
        }
      } catch (error: any) {
        console.error("[AudioAnalysis] Polling error:", error);
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        } else {
          setIsTranscribing(false);
          showBanner(
            "error",
            language === "ar"
              ? "حدث خطأ أثناء النسخ. يرجى المحاولة مرة أخرى."
              : "An error occurred during transcription. Please try again."
          );
        }
      }
    };

    poll();
  };

  // Start analysis
  const startAnalysis = async () => {
    if (!transcriptionResult?.transcription) {
      showBanner(
        "error",
        language === "ar"
          ? "يرجى إكمال النسخ أولاً."
          : "Please complete transcription first."
      );
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    showBanner(
      "info",
      language === "ar" ? "جاري تحليل النص..." : "Analyzing transcription...",
      0
    );

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_ENDPOINT}/audio/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcription: transcriptionResult.transcription,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to analyze transcription");
      }

      const data = await response.json();
      console.log("[AudioAnalysis] Analysis result:", data);

      setAnalysisResult(data);
      showBanner(
        "success",
        language === "ar" ? "تم التحليل بنجاح!" : "Analysis completed!"
      );
    } catch (error: any) {
      console.error("[AudioAnalysis] Analysis error:", error);
      showBanner(
        "error",
        language === "ar"
          ? "فشل التحليل. يرجى المحاولة مرة أخرى."
          : "Analysis failed. Please try again."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Reset for new upload
  const resetForNewUpload = () => {
    setAudioFile(null);
    setAudioUrl(null);
    setUploadedS3Key(null);
    setTranscriptionResult(null);
    setAnalysisResult(null);
    setResultKey(null);
    setShowResetModal(false);
    showBanner(
      "info",
      language === "ar"
        ? "النظام جاهز لتحميل ملف صوتي جديد."
        : "Ready for new audio upload."
    );
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="audio-wrapper-main" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Notification Banner */}
      {banner && (
        <div className={`audio-banner audio-banner-${banner.type}`}>
          <span className="audio-banner-icon">
            {banner.type === "success" && <CheckCircle size={18} />}
            {banner.type === "error" && <AlertCircle size={18} />}
            {banner.type === "warning" && <AlertCircle size={18} />}
            {banner.type === "info" && (
              <Loader2 size={18} className="audio-spinning" />
            )}
          </span>
          <span className="audio-banner-message">{banner.message}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {showResetModal && (
        <div className="audio-modal-overlay">
          <div className="audio-modal-content">
            <div className="audio-modal-icon">
              <AlertTriangle size={48} color="#22417b" />
            </div>
            <h3 className="audio-modal-title">
              {language === "ar" ? "هل أنت متأكد؟" : "Are you sure?"}
            </h3>
            <p className="audio-modal-message">
              {language === "ar"
                ? "نتائج النسخ والتحليل الحالية ستفقد."
                : "Your current transcription and analysis results will be lost."}
            </p>
            <div className="audio-modal-actions">
              <button
                className="audio-modal-btn audio-modal-cancel"
                onClick={() => setShowResetModal(false)}
              >
                {language === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                className="audio-modal-btn audio-modal-confirm"
                onClick={resetForNewUpload}
              >
                {language === "ar" ? "متابعة" : "Proceed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Title and Description */}
      <div className="audio-main-title" dir={language === "ar" ? "rtl" : "ltr"}>
        {language === "ar" ? "تحليل الملفات الصوتية" : "Audio File Analysis"}
      </div>
      <p
        className="audio-main-description"
        dir={language === "ar" ? "rtl" : "ltr"}
      >
        {language === "ar"
          ? "*قم بتحميل ملفات صوتية للنسخ والترجمة والتحليل"
          : "*Upload audio files for transcription, translation, and analysis"}
      </p>

      <div className="audio-container">
        {/* Audio Upload Section */}
        <div className="audio-section">
          <div
            className="audio-section-title"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            {language === "ar" ? "تحميل الملف الصوتي" : "Audio Upload"}
          </div>
          <div className="audio-section-content">
            {!audioUrl ? (
              <div className="audio-upload-area">
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a"
                  onChange={handleFileUpload}
                  className="audio-hidden-input"
                  id="audio-upload-input"
                  disabled={isUploading}
                />
                <label
                  htmlFor="audio-upload-input"
                  className="audio-upload-label"
                >
                  <div className="audio-upload-content">
                    <div className="audio-upload-icon">
                      <Mic size={48} />
                    </div>
                    <div className="audio-upload-text">
                      {language === "ar"
                        ? "تحميل ملف صوتي"
                        : "Upload Audio File"}
                    </div>
                    <div className="audio-upload-subtitle">
                      {language === "ar"
                        ? "MP3, WAV, FLAC, OGG, M4A حتى 500 ميجابايت"
                        : "MP3, WAV, FLAC, OGG, M4A up to 500MB"}
                    </div>
                  </div>
                </label>
                <button
                  type="button"
                  className="audio-action-btn"
                  onClick={() =>
                    document.getElementById("audio-upload-input")?.click()
                  }
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <span className="audio-spinner">⟳</span>
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
              <div className="audio-player-wrapper">
                <div className="audio-player-box">
                  <div className="audio-file-display">
                    <FileAudio size={48} color="#22417b" />
                    <div className="audio-file-details">
                      <span className="audio-file-name">{audioFile?.name}</span>
                      <span className="audio-file-size">
                        {audioFile ? formatFileSize(audioFile.size) : ""}
                      </span>
                    </div>
                  </div>
                  <audio
                    src={audioUrl}
                    controls
                    className="audio-player-element"
                  />
                </div>
                <div className="audio-player-controls">
                  <div className="audio-file-info">
                    {audioFile?.name} •{" "}
                    {audioFile ? formatFileSize(audioFile.size) : ""}
                  </div>

                  {!transcriptionResult ? (
                    <button
                      onClick={startTranscription}
                      disabled={isTranscribing}
                      className={`audio-action-btn ${
                        isTranscribing ? "audio-btn-processing" : ""
                      }`}
                    >
                      {isTranscribing ? (
                        <>
                          <span className="audio-spinner">⟳</span>
                          {language === "ar"
                            ? "جاري النسخ..."
                            : "Transcribing..."}
                        </>
                      ) : (
                        <>
                          <Play size={16} />
                          {language === "ar"
                            ? "بدء النسخ والترجمة"
                            : "Start Transcription & Translation"}
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      className="audio-action-btn"
                      onClick={() => setShowResetModal(true)}
                    >
                      {language === "ar"
                        ? "تحميل ملف صوتي آخر"
                        : "Upload Another Audio"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Transcription Results Section */}
        <div className="audio-section">
          <div
            className="audio-section-title"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            {language === "ar"
              ? "نتائج النسخ والترجمة"
              : "Transcription & Translation Results"}
          </div>
          <div className="audio-section-content">
            {transcriptionResult?.transcription ? (
              <div className="audio-results">
                {/* Original Language Info */}
                <div className="audio-results-block">
                  <h3 className="audio-block-header">
                    {language === "ar"
                      ? "معلومات اللغة"
                      : "Language Information"}
                  </h3>
                  <div className="audio-info-card">
                    <p
                      className="audio-info-text"
                      dir={language === "ar" ? "rtl" : "ltr"}
                    >
                      {language === "ar"
                        ? "اللغة الأصلية: "
                        : "Original Language: "}
                      <strong>
                        {transcriptionResult.originalLanguage?.toUpperCase() ||
                          (language === "ar" ? "غير محدد" : "Unknown")}
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Transcription Text */}
                <div className="audio-results-block">
                  <h3 className="audio-block-header">
                    {language === "ar"
                      ? "النص المترجم (العربية)"
                      : "Translated Text (Arabic)"}
                  </h3>
                  <div className="audio-transcription-list">
                    <div className="audio-transcription-card">
                      <div className="audio-transcription-content">
                        <p
                          dir="rtl"
                          style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}
                        >
                          {transcriptionResult.transcription}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Analysis Button */}
                {!analysisResult && (
                  <div className="audio-actions-row">
                    <button
                      onClick={startAnalysis}
                      disabled={isAnalyzing}
                      className={`audio-action-btn ${
                        isAnalyzing ? "audio-btn-processing" : ""
                      }`}
                    >
                      {isAnalyzing ? (
                        <>
                          <span className="audio-spinner">⟳</span>
                          {language === "ar"
                            ? "جاري التحليل..."
                            : "Analyzing..."}
                        </>
                      ) : (
                        <>
                          <Play size={16} />
                          {language === "ar" ? "بدء التحليل" : "Start Analysis"}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="audio-no-results">
                <p dir={language === "ar" ? "rtl" : "ltr"}>
                  {language === "ar"
                    ? "قم بتحميل ملف صوتي وابدأ النسخ لرؤية النتائج"
                    : "Upload an audio file and start transcription to see results"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Analysis Results Section */}
        {analysisResult && (
          <div className="audio-section">
            <div
              className="audio-section-title"
              dir={language === "ar" ? "rtl" : "ltr"}
            >
              {language === "ar" ? "نتائج التحليل" : "Analysis Results"}
            </div>
            <div className="audio-section-content">
              <div className="audio-results">
                <div className="audio-results-block">
                  <h3 className="audio-block-header">
                    {language === "ar" ? "ملخص التحليل" : "Analysis Summary"}
                  </h3>
                  <div className="audio-info-card">
                    <p
                      className="audio-info-text"
                      dir={language === "ar" ? "rtl" : "ltr"}
                      style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}
                    >
                      {analysisResult.summary}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioAnalysis;
