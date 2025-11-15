import React from "react";
import { Play } from "lucide-react";
import { LanguageCode } from "@aws-sdk/client-transcribe-streaming";
import { RecordingStatus } from "../../types/";

interface TranscriptionSessionSetupProps {
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  setStartRecording: (value: boolean) => void;
  setSessionState: (state: RecordingStatus) => void;
  setActiveTab: (tab: "identity" | "transcription") => void;
}

const TranscriptionSessionSetup: React.FC<TranscriptionSessionSetupProps> = ({
  selectedLanguage,
  setSelectedLanguage,
  setStartRecording,
  setSessionState,
  setActiveTab,
}) => {
  const handleStartRecording = () => {
    setStartRecording(true);
    setSessionState("on");
    setActiveTab("transcription");
  };

  return (
    <div className="ready-state">
      <div className="ready-content">
        <div className="play-icon-container">
          <Play className="play-icon" />
        </div>
        <h2 className="ready-title">Ready to Start</h2>
        <p className="ready-description">
          Click the button below to begin recording the investigation session.
        </p>
        <button onClick={handleStartRecording} className="start-recording-btn">
          <Play className="btn-icon" />
          <span>Start Recording</span>
        </button>

        <div className="language-selector">
          <label htmlFor="language-select">Select the language you need</label>
          <select
            id="language-select"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
          >
            {Object.entries(LanguageCode).map(([code, name]) => {
              const formattedCode =
                code.split("_")[0].toLowerCase() +
                "-" +
                code.split("_")[1].toUpperCase();

              return (
                <option key={code} value={formattedCode}>
                  {name}
                </option>
              );
            })}
          </select>
        </div>
      </div>
    </div>
  );
};

export default TranscriptionSessionSetup;
