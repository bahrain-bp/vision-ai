import React, { useState } from "react";
import { ArrowLeft, Clock } from "lucide-react";
import RealTimeView from "../RealTime/RealTimeView";
import ProcessingView from "../Processing/ProcessingView";
import SessionSummaryModal from "../RealTime/SessionSummaryModal";
import { User,RecordingStatus } from "../../types/";
import { useTranscription } from "../../hooks/useTranscription";

 
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
 
interface SessionData {
  sessionId: string;
  investigator: string;
  language: string;
  duration: string;
  witness: string;
  status: string;
  witnessData?: WitnessData;
  identityData?: IdentityData;
  translationSettings?: TranslationSettings;
}
 
interface SessionPageProps {
  user: User;
  onSignOut: () => void;
  sessionData?: SessionData;
  onEndSession?: () => void;
}
 
type MainTab = "real-time" | "processing";
 
const SessionPage: React.FC<SessionPageProps> = ({
  //user,
  onSignOut,
  sessionData,
  onEndSession
}) => {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>("real-time");
  const [sessionState, setSessionState] = useState<RecordingStatus>("off");
  const [showSummaryModal, setShowSummaryModal] = useState<boolean>(false);
    const { stopRecording } = useTranscription();
 const [setupData, setSetupData] = useState<SetupData>({
   witnessData: {
     fullName: sessionData?.witnessData?.fullName || "",
     idNumber: sessionData?.witnessData?.idNumber || "",
   },
   identityData: {
     referencePhoto: sessionData?.identityData?.referencePhoto || null,
     cpr: sessionData?.identityData?.cpr || null,
     passport: sessionData?.identityData?.passport || null,
     isVerified: sessionData?.identityData?.isVerified || false,
   },
   translationSettings: {
     sourceLanguage: sessionData?.translationSettings?.sourceLanguage || "ar",
     targetLanguage: sessionData?.translationSettings?.targetLanguage || "en",
   },
 });
 
  const currentSessionData: SessionData = sessionData || {
    sessionId: "#2024-INV-0042",
    investigator: "M. AlZebari",
    language: "Arabic",
    duration: "00:00",
    witness: "Not set",
    status: "Active",
  };
 
  if (setupData.witnessData.fullName) {
    currentSessionData.witness = setupData.witnessData.fullName;
  }
 
  const handleEndSession = () => {
    stopRecording(setSessionState);
    //setShowSummaryModal(true);
  };
 
  const handleCloseSummary = () => {
    setShowSummaryModal(false);
    setSessionState("off");
    if (onEndSession) {
      onEndSession();
    }
  };
 
  const handleBackToHome = () => {
    if (onEndSession) {
      onEndSession();
    } else {
      onSignOut();
    }
  };
 
  const updateWitnessData = (field: keyof WitnessData, value: string) => {
    setSetupData((prev) => ({
      ...prev,
      witnessData: {
        ...prev.witnessData,
        [field]: value,
      },
    }));
  };
 
  const updateIdentityData = (field: keyof IdentityData, value: any) => {
    setSetupData((prev) => ({
      ...prev,
      identityData: {
        ...prev.identityData,
        [field]: value,
      },
    }));
  };
 
  const updateTranslationSettings = (field: keyof TranslationSettings, value: string) => {
    setSetupData((prev) => ({
      ...prev,
      translationSettings: {
        ...prev.translationSettings,
        [field]: value,
      },
    }));
  };
 
  const handleVerifyIdentity = () => {
    if (!setupData.witnessData.fullName) {
      alert("Please enter witness full name.");
      return;
    }
 
    if (!setupData.identityData.referencePhoto) {
      alert("Please upload a reference photo.");
      return;
    }
 
    updateIdentityData("isVerified", true);
    alert("Identity verification completed successfully!");
  };
 
  return (
    <div className="session-page-container">
      <nav className="session-nav">
        <div className="nav-content">
          <div className="nav-items">
            <button onClick={handleBackToHome} className="back-button">
              <ArrowLeft className="icon" />
              <span>Back to Home</span>
            </button>
 
            <div className="nav-center">
              <h1 className="app-logo-text">VISION-RT</h1>
              <div className="session-info-header">
                <span className="session-label">Session</span>
                <span className="session-id">
                  {currentSessionData.sessionId}
                </span>
                {sessionState === "on" && (
                  <span className="live-indicator">
                    <span className="live-dot"></span>
                    <span>LIVE</span>
                  </span>
                )}
              </div>
              <p className="investigator-info">
                Investigator: {currentSessionData.investigator}
              </p>
            </div>
 
            <div className="nav-controls">
              <div className="language-controls">
                <span className="language-label">Language:</span>
                <button className="lang-btn active">EN</button>
                <button className="lang-btn">AR</button>
              </div>
              <div className="time-display">
                <Clock className="icon" />
                <span>{currentSessionData.duration}</span>
              </div>
              {sessionState === "on" && (
                <button onClick={handleEndSession} className="end-session-btn">
                  End Session
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>
 
      <div className="main-tabs-container">
        <div className="main-tabs">
          <button
            onClick={() => setActiveMainTab("real-time")}
            className={`main-tab ${
              activeMainTab === "real-time" ? "active" : ""
            }`}
          >
            Real-time
          </button>
          <button
            onClick={() => setActiveMainTab("processing")}
            className={`main-tab ${
              activeMainTab === "processing" ? "active" : ""
            }`}
          >
            Processing
          </button>
        </div>
      </div>
 
      <div className="session-main-content">
        {activeMainTab === "real-time" ? (
          <RealTimeView
            sessionState={sessionState}
            setSessionState={setSessionState}
            sessionData={currentSessionData}
            setupData={setupData}
            onWitnessDataChange={updateWitnessData}
            onIdentityDataChange={updateIdentityData}
            onTranslationSettingsChange={updateTranslationSettings}
            onVerifyIdentity={handleVerifyIdentity}
          />
        ) : (
          <ProcessingView sessionData={currentSessionData} />
        )}
      </div>
 
      {showSummaryModal && (
        <SessionSummaryModal
          sessionData={currentSessionData}
          onClose={handleCloseSummary}
        />
      )}
    </div>
  );
};
 
export default SessionPage;