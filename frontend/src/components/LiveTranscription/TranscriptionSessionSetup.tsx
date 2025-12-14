import React from "react";
import {
  Play,
  Users,
  Info,
  Zap,
  Settings,
  Globe,
  User,
  Languages,
  AlertTriangle,
} from "lucide-react";
import {
  RecordingStatus,
  SessionType,
  LanguagePreferences,
} from "../../types/";
import { STREAMING_LANGUAGES } from "./StreamLanguages";
import Multiselect from "multiselect-react-dropdown";

interface TranscriptionSessionSetupProps {
  languagePreferences: LanguagePreferences;
  setLanguagePreferences: (prefs: LanguagePreferences) => void;
  detectionLanguages: string[];
  setDetectionLanguages: (lang: []) => void;
  sessionType: SessionType;
  setSessionType: (type: "standard" | "multi") => void;
  setStartRecording: (value: boolean) => void;
  setSessionState: (state: RecordingStatus) => void;
  setActiveTab: (tab: "identity" | "transcription") => void;
}

const TranscriptionSessionSetup: React.FC<TranscriptionSessionSetupProps> = ({
  languagePreferences,
  setLanguagePreferences,
  setDetectionLanguages,
  sessionType,
  setSessionType,
  setStartRecording,
  setSessionState,
  setActiveTab,
}) => {
  const handleLanguageSelect = (selectedList: any) => {
    setDetectionLanguages(selectedList.map((lang: any) => lang.code));
  };

  const handleLanguageRemove = (selectedList: any) => {
    setDetectionLanguages(selectedList.map((lang: any) => lang.code));
  };

  const handleStartRecording = () => {
    setStartRecording(true);
    setSessionState("on");
    setActiveTab("transcription");
  };

  return (
    <div className="ready-state w-full">
      <div className="ready-content w-4/5">
        <div className="play-icon-container">
          <Play className="play-icon" />
        </div>
        <h2 className="ready-title">Ready to Start</h2>
        <p className="ready-description">
          Configure your session settings before starting the recording.
        </p>

        <div className="w-full space-y-5 mt-8">
          {/* Language Mode Selection */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
              <Languages className="w-4 h-4 text-purple-600" />
              Language Configuration Mode
            </label>

            <div className="space-y-3">
              <label
                className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md"
                style={{
                  borderColor:
                    languagePreferences.languageMode === "unified"
                      ? "#a855f7"
                      : "#e5e7eb",
                  backgroundColor:
                    languagePreferences.languageMode === "unified"
                      ? "#faf5ff"
                      : "#ffffff",
                }}
              >
                <input
                  type="radio"
                  name="language-mode"
                  checked={languagePreferences.languageMode === "unified"}
                  onChange={() =>
                    setLanguagePreferences({
                      ...languagePreferences,
                      languageMode: "unified",
                    })
                  }
                  className="mt-1 w-4 h-4 text-purple-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      Single Language for Entire Session
                    </span>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                      Simple
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                    Everyone speaks the same language. Best for standard
                    investigations.
                  </p>
                </div>
              </label>

              <label
                className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md"
                style={{
                  borderColor:
                    languagePreferences.languageMode === "separate"
                      ? "#a855f7"
                      : "#e5e7eb",
                  backgroundColor:
                    languagePreferences.languageMode === "separate"
                      ? "#faf5ff"
                      : "#ffffff",
                }}
              >
                <input
                  type="radio"
                  name="language-mode"
                  checked={languagePreferences.languageMode === "separate"}
                  onChange={() =>
                    setLanguagePreferences({
                      ...languagePreferences,
                      languageMode: "separate",
                    })
                  }
                  className="mt-1 w-4 h-4 text-purple-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      Separate Languages (Multilingual)
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      Advanced
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                    Investigator and witnesses speak different languages with
                    translation.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Unified Mode */}
          {languagePreferences.languageMode === "unified" && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                  <Settings className="w-4 h-4 text-blue-600" />
                  Session Language
                </label>
                <select
                  id="language-select"
                  value={languagePreferences.sharedLanguage}
                  onChange={(e) =>
                    setLanguagePreferences({
                      ...languagePreferences,
                      sharedLanguage: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   text-gray-900 font-medium cursor-pointer hover:bg-gray-100 transition-all"
                >
                  <option value="auto">
                    🌐 Auto Detect Multiple Languages
                  </option>
                  {Object.entries(STREAMING_LANGUAGES).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              {languagePreferences.sharedLanguage === "auto" && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Languages to Detect
                  </label>
                  <Multiselect
                    options={Object.entries(STREAMING_LANGUAGES).map(
                      ([code, name]) => ({
                        code: code,
                        name: name,
                      })
                    )}
                    displayValue="name"
                    placeholder="Choose languages..."
                    showCheckbox={true}
                    onSelect={handleLanguageSelect}
                    onRemove={handleLanguageRemove}
                    selectionLimit={5}
                    avoidHighlightFirstOption={true}
                    style={{
                      chips: {
                        background: "#3b82f6",
                        fontSize: "14px",
                      },
                      searchBox: {
                        border: "1px solid #d1d5db",
                        borderRadius: "0.5rem",
                        padding: "8px",
                        minHeight: "42px",
                      },
                      option: {
                        color: "#374151",
                        padding: "8px 12px",
                      },
                      optionContainer: {
                        border: "1px solid #d1d5db",
                        borderRadius: "0.5rem",
                        marginTop: "4px",
                        maxHeight: "300px",
                      },
                    }}
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    💡 Languages are prioritized in order of selection - first
                    selected language gets highest priority
                  </p>
                </div>
              )}
            </>
          )}

          {/* Separate Mode */}
          {languagePreferences.languageMode === "separate" && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                  <User className="w-4 h-4 text-blue-600" />
                  Investigator Language
                </label>
                <p className="text-xs text-gray-600 mb-3">
                  Select your language for the investigation
                </p>
                <select
                  id="investigator-language-select"
                  value={languagePreferences.investigatorLanguage}
                  onChange={(e) =>
                    setLanguagePreferences({
                      ...languagePreferences,
                      investigatorLanguage: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   text-gray-900 font-medium cursor-pointer hover:bg-gray-100 transition-all"
                >
                  <option value="">Select your language...</option>
                  {Object.entries(STREAMING_LANGUAGES).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                  <Globe className="w-4 h-4 text-green-600" />
                  Witness Language
                </label>
                <p className="text-xs text-gray-600 mb-3">
                  Select the witness language
                </p>
                <select
                  id="witness-language-select"
                  value={languagePreferences.witnessLanguage}
                  onChange={(e) =>
                    setLanguagePreferences({
                      ...languagePreferences,
                      witnessLanguage: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg 
                   focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                   text-gray-900 font-medium cursor-pointer hover:bg-gray-100 transition-all"
                >
                  <option value="">Select witness language...</option>
                  {Object.entries(STREAMING_LANGUAGES)
                    .filter(
                      ([code]) =>
                        code !== languagePreferences.investigatorLanguage
                    )
                    .map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}

          {/* Session Type Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
              <Users className="w-4 h-4 text-blue-600" />
              Speaker Detection Mode
            </label>

            <div className="space-y-3">
              <label
                className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md group"
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

              <label
                className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md group"
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
                  <div className="flex items-center gap-2">
                    {" "}
                    {/* Add this wrapper with items-center */}
                    <span className="font-semibold text-gray-900">
                      Multiple Participants
                    </span>
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />{" "}
                      {/* You'll need to import this */}
                      In Development
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                    For group interviews or when multiple people are present.
                    <span className="font-medium text-yellow-700">
                      May produce inaccurate results.
                    </span>
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>
                {sessionType === "standard"
                  ? 'Speakers will be labeled as "Investigator" and "Witness" for example.'
                  : 'Speakers will be labeled as "Investigator", "Speaker 0", "Speaker 1", etc. for example.'}
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