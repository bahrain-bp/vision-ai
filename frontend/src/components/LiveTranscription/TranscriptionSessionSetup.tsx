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
import { useLanguage } from "../../context/LanguageContext";

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
  const { t } = useLanguage();

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
        <h2 className="ready-title">{t("setup.readyToStart")}</h2>
        <p className="ready-description">{t("setup.configureSession")}</p>

        <div className="w-full space-y-5 mt-8">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
              <Languages className="w-4 h-4 text-purple-600" />
              {t("setup.languageMode")}
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
                      {t("setup.singleLanguage")}
                    </span>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                      {t("setup.simple")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                    {t("setup.singleLanguageDesc")}
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
                      {t("setup.separateLanguages")}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      {t("setup.advanced")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                    {t("setup.separateLanguagesDesc")}
                  </p>
                </div>
              </label>
            </div>
          </div>

          {languagePreferences.languageMode === "unified" && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                  <Settings className="w-4 h-4 text-blue-600" />
                  {t("setup.sessionLanguage")}
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
                  <option value="auto">🌐 {t("setup.autoDetect")}</option>
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
                    {t("setup.selectLanguages")}
                  </label>
                  <Multiselect
                    options={Object.entries(STREAMING_LANGUAGES).map(
                      ([code, name]) => ({
                        code: code,
                        name: name,
                      })
                    )}
                    displayValue="name"
                    placeholder={t("setup.chooseLanguages")}
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
                    💡 {t("setup.languagePriority")}
                  </p>
                </div>
              )}
            </>
          )}

          {languagePreferences.languageMode === "separate" && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                  <User className="w-4 h-4 text-blue-600" />
                  {t("setup.investigatorLanguage")}
                </label>
                <p className="text-xs text-gray-600 mb-3">
                  {t("setup.investigatorLanguageDesc")}
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
                  <option value="">{t("setup.selectYourLanguage")}</option>
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
                  {t("setup.witnessLanguage")}
                </label>
                <p className="text-xs text-gray-600 mb-3">
                  {t("setup.witnessLanguageDesc")}
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
                  <option value="">{t("setup.selectWitnessLanguage")}</option>
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

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
              <Users className="w-4 h-4 text-blue-600" />
              {t("setup.speakerMode")}
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
                      {t("setup.oneOnOne")}
                    </span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {t("setup.recommended")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                    {t("setup.oneOnOneDesc")}
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
                    <span className="font-semibold text-gray-900">
                      {t("setup.multipleParticipants")}
                    </span>
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {t("setup.inDevelopment")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                    {t("setup.multipleParticipantsDesc")}{" "}
                    <span className="font-medium text-yellow-700">
                      {t("setup.mayProduceInaccurate")}
                    </span>
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>
                {sessionType === "standard"
                  ? t("setup.speakerLabelStandard")
                  : t("setup.speakerLabelMulti")}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleStartRecording}
          className="start-recording-btn mt-8 shadow-lg hover:shadow-xl"
        >
          <Play className="btn-icon" />
          <span>{t("setup.startRecording")}</span>
        </button>
      </div>
    </div>
  );
};

export default TranscriptionSessionSetup;
