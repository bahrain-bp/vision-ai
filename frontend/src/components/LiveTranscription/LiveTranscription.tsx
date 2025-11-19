import React, { useEffect, useRef } from "react";
import { FileText, Copy, Loader } from "lucide-react";
import { useTranscription } from "../../hooks/useTranscription";
import { RecordingStatus } from "../../types/";
import PDFExporter from "./PDFExporter";
import { useState } from "react";

interface LiveTranscriptionProps {
  startRecordingProp: boolean;
  setSessionState: (state: RecordingStatus) => void;
  selectedLanguage: string;
}

const LiveTranscription: React.FC<LiveTranscriptionProps> = ({
  startRecordingProp,
  setSessionState,
  selectedLanguage,
}) => {
  const { audioStatus, recordingStatus, startRecording, getFullTranscript } =
    useTranscription();

  const [isStarting, setIsStarting] = useState(false);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (
      startRecordingProp &&
      recordingStatus === "off" &&
      !hasStarted.current
    ) {
      hasStarted.current = true;

      const start = async () => {
        setIsStarting(true);

        try {
          const success = await startRecording(
            setSessionState,
            selectedLanguage
          );

          if (!success) {
            console.error("Failed to start recording");
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
  }, [startRecordingProp, recordingStatus, selectedLanguage]);


if (isStarting) {
  return (
    <div className="flex items-center justify-center w-full min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-gray-600 font-medium">
          Initializing recording session...
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
          <h3 className="card-title">Live Transcription</h3>
        </div>

        <div className="recording-status">
          <span
            className={audioStatus ? "recording-dot" : "no-audio-dot"}
          ></span>
          <span>
            {audioStatus
              ? "Recording / Audio Detected"
              : "Recording / No Audio Input"}
          </span>
        </div>
      </div>
      <textarea
        value={getFullTranscript}
        readOnly
        placeholder="Transcript will appear here..."
        style={{
          width: "100%",
          minHeight: "300px",
          padding: "12px",
          fontFamily: "monospace",
          fontSize: "14px",
          border: "1px solid #ddd",
          borderRadius: "4px",
          resize: "vertical",
          whiteSpace: "pre-wrap",
          overflow: "auto",
        }}
      />

      <div className="action-buttons">
        <PDFExporter
          transcript={getFullTranscript}
          title={"Investigation Transcript"}
          fileName={"Transcript"}
        />
        <button className="action-btn">
          <Copy className="btn-icon" />
          <span>Copy All</span>
        </button>
      </div>
    </div>
  );
};

export default LiveTranscription;
