import React, { useState } from "react";
import {
  User,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import LiveTranscription from "../LiveTranscription/LiveTranscription";
import Translation from "./Translation";
//import AIAssistant from "./AIAssistant";
import SessionInfo from "./SessionInfo";
import IdentityVerification from "./IdentityVerification/IdentityVerification";
import TranscriptionSessionSetup from "../LiveTranscription/TranscriptionSessionSetup"
//import { RecordingStatus } from "../../types/";
//import { useQuestionContext } from '../../hooks/useQuestionContext';
//import MetricsWidget from './AIAssistant/MetricsWidget';
//import QuestionCard from './AIAssistant/QuestionCard';
//import GeneratorControls from './AIAssistant/GeneratorControls'; 
//import { Language } from '../../types/aiQuestionsRT';
//import AttemptNavigation from './AIAssistant/AttemptNavigation';
//import QuestionList from './AIAssistant/QuestionList';
//import { QuestionAttempt } from '../../types/aiQuestionsRT';
import QuestionGenerator from './AIAssistant/QuestionGenerator';



import { TranslationProvider } from '../../context/TranslationContext';

import {
  RecordingStatus,
  sessionType,
  LanguagePreferences,
} from "../../types/";

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

interface IdentityData {
  referencePhoto: File | null;
  cpr: File | null;
  passport: File | null;
  isVerified: boolean;
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
}

const RealTimeView: React.FC<RealTimeViewProps> = ({
  sessionState,
  setSessionState,
  sessionData,
  //identityData,
  //onIdentityDataChange,
  //onVerifyIdentity,
}) => {
  const [activeTab, setActiveTab] = useState<"identity" | "transcription">(
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
      sharedLanguage: "ar-SA",
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
  
  // Get metrics from context
//const { metrics } = useQuestionContext();

//  Mock handler for GeneratorControls testing
 // const handleGenerateQuestions = (questionCount: number, language: Language) => {
   // console.log('Generate clicked:', { questionCount, language });
    // TODO: This will call generateQuestions from context later
  // };
  /*// Create mock attempt with multiple questions
  const mockAttempt: QuestionAttempt = {
    attemptId: 'test-attempt-1',
    questions: [
      {
        id: 'q1',
        text: 'Can you clarify the exact date and time when the incident occurred?',
        category: 'clarification',
        status: 'pending',
        reasoning: 'This question helps establish a precise timeline, which is crucial for verifying alibis and cross-referencing with other testimonies.',
        sourceContext: 'Witness mentioned "last week" but didn\'t specify exact date',
        generatedAt: new Date().toISOString(),
      },
      {
        id: 'q2',
        text: 'Who informed you about this incident?',
        category: 'verification',
        status: 'pending',
        reasoning: 'Need to verify the source of information to assess credibility.',
        sourceContext: 'Witness said "someone told me" without naming the person',
        generatedAt: new Date().toISOString(),
      },
      {
        id: 'q3',
        text: 'Was this communicated in writing or verbally?',
        category: 'timeline',
        status: 'pending',
        reasoning: 'Documentation method matters for evidence chain.',
        sourceContext: 'Communication method was not specified',
        generatedAt: new Date().toISOString(),
      },
      {
        id: 'q4',
        text: 'What motivated you to report this incident now?',
        category: 'motivation',
        status: 'pending',
        reasoning: 'Understanding the timing and motivation provides context.',
        sourceContext: 'Report came weeks after the incident',
        generatedAt: new Date().toISOString(),
      },
      {
        id: 'q5',
        text: 'Were there any witnesses present during the incident?',
        category: 'verification',
        status: 'pending',
        reasoning: 'Corroborating witnesses strengthen the testimony.',
        sourceContext: 'No witnesses mentioned in initial statement',
        generatedAt: new Date().toISOString(),
      },
    ],
    language: 'en',
    timestamp: new Date().toISOString(),
    isConfirmed: false,
  }; 

  // State to track selected questions
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  // Handler to toggle selection
  const handleQuestionSelect = (questionId: string) => {
    setSelectedQuestionIds(prev => 
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)  // Remove if selected
        : [...prev, questionId]                  // Add if not selected
    );
    console.log('Selected:', questionId);
  };



/*
  // Mock question for testing QuestionCard
const mockQuestion = {
  id: 'test-question-1',
  text: 'Can you clarify the exact date and time when the incident occurred?',
  category: 'clarification' as const,
  status: 'pending' as const,
  reasoning: 'This question helps establish a precise timeline, which is crucial for verifying alibis and cross-referencing with other testimonies.',
  sourceContext: 'Witness mentioned "last week" but didn\'t specify exact date',
  generatedAt: new Date().toISOString(),
}; */ 


  return (
    <div className="realtime-view">
      <div className="main-content">
        {sessionState === "off" && activeTab === "identity" && (
          <div className="recording-content">
            <IdentityVerification
              //identityData={identityData}
              //onIdentityDataChange={onIdentityDataChange}
              //onVerifyIdentity={onVerifyIdentity}
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
                {/* WRAP Translation with Provider */}
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