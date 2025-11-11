import React, { useEffect } from "react";
import { FileText, Download, Copy } from "lucide-react";
import { useTranscription } from "../../hooks/useTranscription";
import { RecordingStatus,TranscriptionResult } from "../../types/";
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
  const { audioStatus, recordingStatus, startRecording, stopRecording } =
    useTranscription();

  const [liveTranscript, setLiveTranscript] =
    useState<TranscriptionResult | null>(null);
  const [fullTranscript, setFullTranscript] = useState<string>("");

  useEffect(() => {
    if (startRecordingProp && recordingStatus === "off") {
      const start = async () => {
        const success = await startRecording(
          setSessionState,
          (text: TranscriptionResult) => {
            setLiveTranscript(text);
          },
          selectedLanguage
        );
        if (!success) {
          console.error("Failed to start recording");
        }
      };
      start();
    }
  }, [startRecordingProp, recordingStatus, startRecording, setSessionState]);
  useEffect(() => {
    if (liveTranscript?.formattedTranscript) {
      setFullTranscript((prev) => prev + liveTranscript.formattedTranscript);
    }
  }, [liveTranscript]);
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
        value={fullTranscript}
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
        }}
      />

      <div className="action-buttons">
        <button
          className="action-btn"
          onClick={() => stopRecording(setSessionState)}
        >
          <Download className="btn-icon" />
          <span>Download</span>
        </button>
        <button className="action-btn">
          <Copy className="btn-icon" />
          <span>Copy All</span>
        </button>
      </div>
    </div>
  );
};

export default LiveTranscription;
