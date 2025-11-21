import React, { useState } from "react";
import { Play, Users, Info, Zap, Settings } from "lucide-react";
import { RecordingStatus } from "../../types/";
import { STREAMING_LANGUAGES } from "./StreamLanguages";

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
  const [speakerMode, setSpeakerMode] = useState<"auto" | "manual">("manual");
  const [numberOfSpeakers, setNumberOfSpeakers] = useState(2);

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

          {/* Speaker Detection Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
              <Users className="w-4 h-4 text-blue-600" />
              Speaker Detection
            </label>

            <div className="space-y-3">
              {/* Manual Mode - Now First and Recommended */}
              <label
                className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer 
                 transition-all hover:shadow-md group"
                style={{
                  borderColor: speakerMode === "manual" ? "#3b82f6" : "#e5e7eb",
                  backgroundColor:
                    speakerMode === "manual" ? "#eff6ff" : "#ffffff",
                }}
              >
                <input
                  type="radio"
                  name="speaker-mode"
                  value="manual"
                  checked={speakerMode === "manual"}
                  onChange={() => setSpeakerMode("manual")}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      Specify Number of Speakers
                    </span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Recommended
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                    Tell AWS how many speakers to expect for better accuracy.
                  </p>

                  {/* Number Input - only shows when manual selected */}
                  {speakerMode === "manual" && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700 min-w-fit">
                          Number of Speakers:
                        </label>
                        <input
                          type="number"
                          min="2"
                          max="10"
                          value={numberOfSpeakers}
                          onChange={(e) =>
                            setNumberOfSpeakers(parseInt(e.target.value) || 2)
                          }
                          className="flex-1 px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           text-center font-semibold text-lg"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      {/* Accuracy Hint */}
                      <div className="flex items-start gap-2 bg-white rounded-lg p-3 border border-gray-200">
                        <Info
                          className="w-4 h-4 flex-shrink-0 mt-0.5"
                          style={{
                            color:
                              numberOfSpeakers === 2
                                ? "#10b981"
                                : numberOfSpeakers <= 5
                                ? "#3b82f6"
                                : "#f59e0b",
                          }}
                        />
                        <p
                          className="text-xs leading-relaxed"
                          style={{
                            color:
                              numberOfSpeakers === 2
                                ? "#10b981"
                                : numberOfSpeakers <= 5
                                ? "#3b82f6"
                                : "#f59e0b",
                          }}
                        >
                          {numberOfSpeakers === 2 ? (
                            <span className="font-semibold">
                              ✓ Optimal accuracy with 2 speakers
                            </span>
                          ) : numberOfSpeakers <= 5 ? (
                            <span className="font-medium">
                              Good accuracy with {numberOfSpeakers} speakers
                            </span>
                          ) : (
                            <span className="font-medium">
                              Accuracy may decrease with {numberOfSpeakers}{" "}
                              speakers
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </label>

              {/* Auto Mode - Now Second */}
              <label
                className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer 
                 transition-all hover:shadow-md group"
                style={{
                  borderColor: speakerMode === "auto" ? "#3b82f6" : "#e5e7eb",
                  backgroundColor:
                    speakerMode === "auto" ? "#eff6ff" : "#ffffff",
                }}
              >
                <input
                  type="radio"
                  name="speaker-mode"
                  value="auto"
                  checked={speakerMode === "auto"}
                  onChange={() => setSpeakerMode("auto")}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1.5">
                    Auto-Detect
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    AWS automatically identifies all speakers. Use when the
                    number is unknown.
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>
                Speakers will be labeled as "Speaker 0", "Speaker 1", etc. in
                the transcript
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
