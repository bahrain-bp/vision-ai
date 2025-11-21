import React from "react";
import { Play, Users, Info, Zap, Settings } from "lucide-react";
import { RecordingStatus, sessionType } from "../../types/";
import { STREAMING_LANGUAGES } from "./StreamLanguages";

interface TranscriptionSessionSetupProps {
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  sessionType: sessionType;
  setSessionType: (type: "standard" | "multi") => void;
  setStartRecording: (value: boolean) => void;
  setSessionState: (state: RecordingStatus) => void;
  setActiveTab: (tab: "identity" | "transcription") => void;
}

const TranscriptionSessionSetup: React.FC<TranscriptionSessionSetupProps> = ({
  selectedLanguage,
  setSelectedLanguage,
  sessionType,
  setSessionType,
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
    <div className="ready-state w-ful">
      <div className="ready-content w-4/5">
        <div className="play-icon-container">
          <Play className="play-icon" />
        </div>
        <h2 className="ready-title">Ready to Start</h2>
        <p className="ready-description">
          Configure your session settings before starting the recording.
        </p>

        {/* Settings Container */}
        <div className="w-full space-y-5 mt-8">
          {/* Language Selection Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
              <Settings className="w-4 h-4 text-blue-600" />
              Session Language
            </label>
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg 
               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
               text-gray-900 font-medium cursor-pointer hover:bg-gray-100 transition-all"
            >
              <option value="auto">🌐 Auto Detect Multiple Languages</option>
              {Object.entries(STREAMING_LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Session Type Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
              <Users className="w-4 h-4 text-blue-600" />
              Number of Participants
            </label>

            <div className="space-y-3">
              {/* Standard - One-on-One */}
              <label
                className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer 
                 transition-all hover:shadow-md group"
                style={{
                  borderColor:
                    sessionType === "standard" ? "#3b82f6" : "#e5e7eb",
                  backgroundColor:
                    sessionType === "standard" ? "#eff6ff" : "#ffffff",
                }}
              >
                <input
                  type="radio"
                  name="session-type"
                  value="standard"
                  checked={sessionType === "standard"}
                  onChange={() => setSessionType("standard")}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      One-on-One Interview
                    </span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Recommended
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                    Standard interview with two speakers (investigator + one
                    participant). Provides the highest accuracy.
                  </p>
                </div>
              </label>

              {/* Multi-Party - Multiple Participants */}
              <label
                className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer 
                 transition-all hover:shadow-md group"
                style={{
                  borderColor: sessionType === "multi" ? "#3b82f6" : "#e5e7eb",
                  backgroundColor:
                    sessionType === "multi" ? "#eff6ff" : "#ffffff",
                }}
              >
                <input
                  type="radio"
                  name="session-type"
                  value="multi"
                  checked={sessionType === "multi"}
                  onChange={() => setSessionType("multi")}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1.5">
                    Multiple Participants
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    For group interviews or when multiple people are present
                    (witnesses, lawyers, translators, etc.). AWS will
                    auto-detect up to 10 speakers.
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>
                {sessionType === "standard"
                  ? 'Speakers will be labeled as "Investigator" and "Witness"'
                  : 'Speakers will be labeled as "Investigator", "Speaker 0", "Speaker 1", etc.'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleStartRecording}
          className="start-recording-btn mt-8 shadow-lg hover:shadow-xl"
        >
          <Play className="btn-icon" />
          <span>Start Recording</span>
        </button>
      </div>
    </div>
  );
};

export default TranscriptionSessionSetup;
