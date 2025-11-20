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

        <div className="language-selector mt-6 w-full max-w-md">
          <label
            htmlFor="language-select"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Select Language
          </label>
          <select
            id="language-select"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm 
             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
             text-gray-900 cursor-pointer hover:border-gray-400 transition-colors"
          >
            <option value="auto">Auto Detect</option>

            {Object.entries(LanguageCode).map(([code, name]) => {
              const formattedCode =
                code.split("_")[0].toLowerCase() +
                "-" +
                code.split("_")[1].toUpperCase();

              // Use browser's built-in Intl API for language names
              const displayName =
                new Intl.DisplayNames(["en"], { type: "language" }).of(
                  formattedCode.split("-")[0]
                ) || name;

              const region = formattedCode.split("-")[1];

              return (
                <option key={code} value={formattedCode}>
                  {displayName} ({region})
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
