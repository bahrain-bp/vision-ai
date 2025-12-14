import React, { useEffect, useRef } from "react";
import { FileText, Loader } from "lucide-react";
import { useTranscription } from "../../hooks/useTranscription";
import {
  RecordingStatus,
  TranscriptionStatus,
  SessionType,
  LanguagePreferences,
} from "../../types/";
import PDFExporter from "../RealTime/TranslationPDFExporter";
import ErrorDisplay from "./ErrorDisplay";
import { useState } from "react";
import { useCaseContext } from "../../hooks/useCaseContext";
import { useLanguage } from "../../context/LanguageContext";

interface LiveTranscriptionProps {
  startRecordingProp: boolean;
  setSessionState: (state: RecordingStatus) => void;
  languagePreferences: LanguagePreferences;
  detectionLanguages?: string[];
  setSessionType: (sesType: SessionType) => void;
  sessionType: SessionType;
}

const LiveTranscription: React.FC<LiveTranscriptionProps> = ({
  startRecordingProp,
  setSessionState,
  languagePreferences,
  detectionLanguages,
  sessionType,
}) => {
  const { t } = useLanguage();
  const { audioStatus, recordingStatus, startRecording, getFullTranscript } =
    useTranscription();

  const { currentCase, currentSession } = useCaseContext();

  const [error, setError] = useState<TranscriptionStatus | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const hasStarted = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (
      startRecordingProp &&
      recordingStatus === "off" &&
      !hasStarted.current
    ) {
      hasStarted.current = true;

      const start = async () => {
        setIsStarting(true);
        setError(null);
        try {
          const detectionLangString =
            detectionLanguages && detectionLanguages.length > 0
              ? detectionLanguages.join(",")
              : undefined;
          const result: TranscriptionStatus = await startRecording(
            setSessionState,
            languagePreferences,
            sessionType,
            detectionLangString
          );

          if (!result.success) {
            console.error("Failed to start recording: ", result.error);
            console.error("Error: ", result.error?.rawError);
            setError(result);
            hasStarted.current = false;
          }
        } catch (error) {
          console.error("Error starting recording:", error);
          hasStarted.current = false;
        } finally {
          setIsStarting(false);
        }
      };

      start();
    }
  }, [startRecordingProp, recordingStatus, languagePreferences]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [getFullTranscript]);

  if (error) {
    return (
      <ErrorDisplay
        displayMessage={error.error?.message ?? "Failed to start recording"}
        rawMessage={error.error?.rawError}
        displayTitle={error.error?.type}
        onClose={() => {
          setError(null);
          hasStarted.current = false;
        }}
      />
    );
  }

  if (isStarting) {
    return (
      <div className="flex items-center justify-center w-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-gray-600 font-medium">
            {t("transcription.initializing")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="transcription-card">
      <div className="card-header">
        <div className="header-left">
          <FileText className="header-icon" />
          <h3 className="card-title">{t("transcription.title")}</h3>
        </div>

        <div className="recording-status">
          <span
            className={audioStatus ? "recording-dot" : "no-audio-dot"}
          ></span>
          <span>
            {audioStatus
              ? t("transcription.recordingAudioDetected")
              : t("transcription.recordingNoAudio")}
          </span>
        </div>
      </div>
      <textarea
        value={getFullTranscript}
        readOnly
        ref={textareaRef}
        placeholder={t("transcription.placeholder")}
        style={{
          width: "100%",
          minHeight: "300px",
          padding: "16px",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          fontSize: "14px",
          lineHeight: "1.8",
          border: "1px solid #e5e7eb",
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
          resize: "vertical",
          whiteSpace: "pre-wrap",
          overflow: "auto",
          color: "#1f2937",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
        }}
      />

      <div className="action-buttons">
        <PDFExporter
          transcript={getFullTranscript}
          title={"Investigation Transcript"}
          fileName={
            "transcript-" +
            currentCase?.caseId +
            "-" +
            currentSession?.sessionId
          }
          sessionDate={new Date().toLocaleDateString()}
        />
      </div>
    </div>
  );
};

export default LiveTranscription;
