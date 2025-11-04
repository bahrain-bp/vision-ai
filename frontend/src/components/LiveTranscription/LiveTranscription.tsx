import React, { useEffect } from "react";
import { FileText, Download, Copy } from "lucide-react";
import { useTranscription } from "../../hooks/useTranscription";
import { RecordingStatus } from "../../types/";

interface LiveTranscriptionProps {
  startRecordingProp: boolean;
  setSessionState: (state: RecordingStatus) => void;
}



const LiveTranscription: React.FC<LiveTranscriptionProps> = ({
  startRecordingProp,
  setSessionState,
}) => {
  const {
    transcript, // All transcript lines
    audioStatus, // Audio detected or not
    recordingStatus,
    startRecording, // Function to start
    stopRecording, // Function to stop
    // addLine, // Function to add line (for AWS Transcribe later)
  } = useTranscription();

  useEffect(() => {
    if (startRecordingProp && recordingStatus === "off") {
      const start = async () => {
        const success = await startRecording(setSessionState);
        if (!success) {
          console.error("Failed to start recording");
        }
      };
      start();
    }
  }, [startRecordingProp, recordingStatus, startRecording, setSessionState]);

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

      <div className="transcript-container">
        {transcript.length === 0 ? (
          <p className="no-transcript">
            No transcript yet. Waiting for speech...
          </p>
        ) : (
          transcript.map((line, index) => (
            <div key={index} className="transcript-line">
              <span className="timestamp">{line.timestamp}</span>{" "}
              <span className="speaker">[{line.speaker}]</span>{" "}
              <span className="text">{line.text}</span>
            </div>
          ))
        )}
      </div>

      <div className="action-buttons">
        <button className="action-btn" onClick={()=>stopRecording(setSessionState) }>
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
