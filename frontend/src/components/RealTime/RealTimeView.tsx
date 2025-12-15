import React, { useState, useEffect } from "react";
import { User, ChevronUp, ChevronDown, FileText , Bot } from "lucide-react";
import LiveTranscription from "../LiveTranscription/LiveTranscription";
import Translation from "./Translation";
import SessionInfo from "./SessionInfo";
import IdentityVerification from "./IdentityVerification/IdentityVerification";
import TranscriptionSessionSetup from "../LiveTranscription/TranscriptionSessionSetup";
import QuestionGenerator from "./AIAssistant/QuestionGenerator";
import { TranslationProvider } from "../../context/TranslationContext";
import {
  RecordingStatus,
  SessionType,
  LanguagePreferences,
} from "../../types/";
import SummarizationReport from "./Summarization/SummarizationReport";
import { useLanguage } from "../../context/LanguageContext";
import ManualQuestionInput from "./AIAssistant/ManualQuestionInput";

interface SessionData {
  sessionId: string;
  language: string;
  participant: string; //should remove it after all components use the context in their code
  duration: string;
  status: string;
  investigator?: string;
}

interface TranslationSettings {
  sourceLanguage: string;
  targetLanguage: string;
}

interface RealTimeViewProps {
  sessionState: RecordingStatus;
  setSessionState: (state: RecordingStatus) => void;
  sessionData: SessionData;
  translationSettings: TranslationSettings;
  onTranslationSettingsChange: (
    field: keyof TranslationSettings,
    value: string
  ) => void;
  triggerSummarization: boolean;
}

const RealTimeView: React.FC<RealTimeViewProps> = ({
  sessionState,
  setSessionState,
  sessionData,
  triggerSummarization,
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<
    "identity" | "transcription" | "summarization"
  >("identity");
  const [aiExpanded, setAiExpanded] = useState(false);
  const [isIdentityVerified, setIsIdentityVerified] = useState(false);
  const [startRecording, setStartRecording] = useState(false);
  const [sessionType, setSessionType] = useState<SessionType>("standard");
  const [detectionLanguages, setDetectionLanguages] = useState([]);

  const [languagePreferences, setLanguagePreferences] =
    useState<LanguagePreferences>({
      languageMode: "unified",
      sharedLanguage: "en-US",
      investigatorLanguage: "",
      witnessLanguage: "",
    });

  const handleStartInvestigation = () => {
    console.log("Starting investigation");
    setIsIdentityVerified(true);
    setActiveTab("transcription");
  };

  const handleBackToDashboard = () => {
    console.log("Going back to dashboard");
  };

  useEffect(() => {
    if (triggerSummarization) {
      setActiveTab("summarization");
    }
  }, [triggerSummarization]);

  return (
    <div className="realtime-view">
      <div className="main-content">
        {sessionState === "off" && activeTab === "identity" && (
          <div className="recording-content">
            <IdentityVerification
              onStartInvestigation={handleStartInvestigation}
              onBackToDashboard={handleBackToDashboard}
            />
          </div>
        )}

        {sessionState === "off" && activeTab === "transcription" && (
          <>
            <TranscriptionSessionSetup
              languagePreferences={languagePreferences}
              setLanguagePreferences={setLanguagePreferences}
              detectionLanguages={detectionLanguages}
              setDetectionLanguages={setDetectionLanguages}
              sessionType={sessionType}
              setSessionType={setSessionType}
              setStartRecording={setStartRecording}
              setSessionState={setSessionState}
              setActiveTab={setActiveTab}
            />
          </>
        )}

        {sessionState === "on" && (
          <div className="recording-content">
            {activeTab === "transcription" && (
              <>
                <LiveTranscription
                  startRecordingProp={startRecording}
                  setSessionState={setSessionState}
                  languagePreferences={languagePreferences}
                  detectionLanguages={detectionLanguages}
                  setSessionType={setSessionType}
                  sessionType={sessionType}
                />
                <TranslationProvider
                  investigatorLanguage="en"
                  witnessLanguage="ar"
                >
                  <Translation />
                </TranslationProvider>
              </>
            )}
          </div>
        )}

        {activeTab === "summarization" && (
          <div className="recording-content">
            <SummarizationReport sessionData={sessionData} />
          </div>
        )}
      </div>

      <div className="session-sidebar">
        <div className="sidebar-nav">
          <button
            onClick={() => setActiveTab("identity")}
            className={`sidebar-btn ${
              activeTab === "identity" ? "active" : ""
            } ${isIdentityVerified ? "disabled" : ""}`}
            disabled={isIdentityVerified}
          >
            <User className="btn-icon" />
            <span>{t("identity.title")}</span>
          </button>

          <button
            onClick={() => setActiveTab("transcription")}
            className={`sidebar-btn ${
              activeTab === "transcription" ? "active" : ""
            }${!isIdentityVerified ? "disabled" : ""}`}
            
            disabled={!isIdentityVerified}
          >
            <User className="btn-icon" />
            <span>Transcription & Translation</span>
          </button>

          <button
            onClick={() => setActiveTab("summarization")}
            className={`sidebar-btn ${
              activeTab === "summarization" ? "active" : ""
            }`}
          >
            <FileText className="btn-icon" />
            <span>{t('session.summarization')}</span>
          </button>
        </div>

         <div className="ai-section">
          <button
  onClick={() => setAiExpanded(!aiExpanded)}
  className="ai-toggle-btn"
>
  <div className="flex items-center gap-2"> 
    <Bot className="btn-icon" style={{ width: '20px', height: '20px' }} />
    <span>{t("aiAssistant.title")}</span>
  </div>
  {aiExpanded ? <ChevronUp /> : <ChevronDown />}
</button>
          
          {aiExpanded && (
            <div className="mt-4 space-y-4">
              {/* AI Question Generator */}
              <QuestionGenerator />

              {/* Divider */}
              <div className="border-t border-gray-200 my-4"></div>

              {/* Manual Question Evaluation Tool */}
              <ManualQuestionInput />
            </div>
          )}
        </div>

        <SessionInfo sessionData={sessionData} />
      </div>
    </div>
  );
};

export default RealTimeView;
