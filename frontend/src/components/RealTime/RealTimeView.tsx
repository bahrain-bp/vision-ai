import React, { useState, useEffect } from "react";
import {
  User,
  ChevronUp,
  ChevronDown,
  FileText,
} from "lucide-react";
import LiveTranscription from "../LiveTranscription/LiveTranscription";
import Translation from "./Translation";
import SessionInfo from "./SessionInfo";
import IdentityVerification from "./IdentityVerification/IdentityVerification";
import TranscriptionSessionSetup from "../LiveTranscription/TranscriptionSessionSetup"
import QuestionGenerator from './AIAssistant/QuestionGenerator';
import { TranslationProvider } from '../../context/TranslationContext';
import { RecordingStatus, sessionType, LanguagePreferences } from "../../types/";
import SummarizationReport from "./SummarizationReport";

interface SessionData {
  sessionId: string;
  participant: string;
  language: string;
  duration: string;
  status: string;
  investigator?: string;
}

interface IdentityData {
  referencePhoto: File | null;
  cpr: File | null;
  passport: File | null;
  isVerified: boolean;
}

interface InvestigationData {
  witness: string;
  idNumber: string;
  identityData: IdentityData;
  investigator: string;
  duration: string;
  status: string;
}

interface WitnessData {
  fullName: string;
  idNumber: string;
}

interface TranslationSettings {
  sourceLanguage: string;
  targetLanguage: string;
}

interface SetupData {
  witnessData: WitnessData;
  identityData: IdentityData;
  translationSettings: TranslationSettings;
}

interface RealTimeViewProps {
  sessionState: RecordingStatus;
  setSessionState: (state: RecordingStatus) => void;
  sessionData: SessionData;
  setupData: SetupData;
  onWitnessDataChange: (field: keyof WitnessData, value: string) => void;
  onIdentityDataChange: (field: keyof IdentityData, value: any) => void;
  onTranslationSettingsChange: (
    field: keyof TranslationSettings,
    value: string
  ) => void;
  onVerifyIdentity: () => void;
  triggerSummarization: boolean;
}

const RealTimeView: React.FC<RealTimeViewProps> = ({
  sessionState,
  setSessionState,
  sessionData,
  triggerSummarization,
}) => {
  const [activeTab, setActiveTab] = useState<"identity" | "transcription" | "summarization">(
    "identity"
  );
  const [aiExpanded, setAiExpanded] = useState(false);
  const [isIdentityVerified, setIsIdentityVerified] = useState(false);
  const [startRecording, setStartRecording] = useState(false);
  const [sessionType, setSessionType] = useState<sessionType>("standard");
  const [detectionLanguages, setDetectionLanguages] = useState([]);

  const [languagePreferences, setLanguagePreferences] =
    useState<LanguagePreferences>({
      languageMode: "unified",
      sharedLanguage: "en-US",
      investigatorLanguage: "",
      witnessLanguage: "",
    });

  const handleStartInvestigation = (investigationData: InvestigationData) => {
    console.log("Starting investigation with data:", investigationData);
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
            <span>Identity Verification</span>
          </button>

          <button
            onClick={() => setActiveTab("transcription")}
            className={`sidebar-btn ${
              activeTab === "transcription" ? "active" : ""
            }`}
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
            <span>Summarization</span>
          </button>
        </div>

        <div className="ai-section">
          <button
            onClick={() => setAiExpanded(!aiExpanded)}
            className="ai-toggle-btn"
          >
            AI Assistant
            {aiExpanded ? <ChevronUp /> : <ChevronDown />}
          </button>

          {aiExpanded && (
            <div className="mt-4">
              <QuestionGenerator />
            </div>
          )}
        </div>

        <SessionInfo sessionData={sessionData} />
      </div>
    </div>
  );
};

export default RealTimeView;