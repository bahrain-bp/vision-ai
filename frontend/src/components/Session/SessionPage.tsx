import React, { useState, useEffect } from "react";
import { ArrowLeft, Clock } from "lucide-react";
import RealTimeView from "../RealTime/RealTimeView";
import ProcessingView from "../Processing/ProcessingView";
import SessionSummaryModal from "../RealTime/SessionSummaryModal";
import { User, RecordingStatus } from "../../types/";
import { useTranscription } from "../../hooks/useTranscription";
import { useCaseContext } from "../../hooks/useCaseContext";

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
  user,
  onSignOut,
  sessionData,
  onEndSession,
}) => {
  const {
    currentCase,
    currentSession,
    createSession,
    updateSessionStatus,
    setCurrentSession,
  } = useCaseContext();
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

  const getInvestigatorName = () => {
    if (user?.username) return user.username;
    return "Unknown Investigator";
  };

  const currentSessionData: SessionData = currentSession
    ? {
        sessionId: currentSession.sessionId,
        investigator: currentSession.investigator || getInvestigatorName(),
        language: "Arabic",
        duration: currentSession.duration,
        witness: setupData.witnessData.fullName || "Not set",
        status: currentSession.status,
      }
    : {
        sessionId: "#2025-INV-0042",
        investigator: getInvestigatorName(),
        language: "Arabic",
        duration: "00:00",
        witness: "Not set",
        status: "Active",
      };

  useEffect(() => {
    if (setupData.witnessData.fullName) {
      currentSessionData.witness = setupData.witnessData.fullName;
    }
  }, [setupData.witnessData.fullName]);

  const handleEndSession = async () => {
    stopRecording(setSessionState);


    if (currentSession && currentCase) {
      try {
        await updateSessionStatus(
          currentCase.caseId,
          currentSession.sessionId,
          "completed"
        );
      } catch (error) {
        console.error("Failed to update session status:", error);
      }
    }


    setShowSummaryModal(true);
  };

  const handleCloseSummary = () => {
    setShowSummaryModal(false);
    setSessionState("off");
    if (onEndSession) {
      onEndSession();
    }
  };

  const handleBackToHome = () => {
    sessionCreationAttempted.current = false;
    setCurrentSession(null);
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

  const updateTranslationSettings = (
    field: keyof TranslationSettings,
    value: string
  ) => {
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

  const sessionCreationAttempted = React.useRef(false);

  useEffect(() => {
    const initializeSession = async () => {
      if (sessionCreationAttempted.current) {
        return;
      }

      if (currentCase && !currentSession) {
        try {
          sessionCreationAttempted.current = true;
          const investigator = getInvestigatorName();
          await createSession(currentCase.caseId, investigator, "witness");
        } catch (error) {
          console.error("Failed to create session:", error);
          sessionCreationAttempted.current = false;
        }
      }
    };

    initializeSession();
  }, [currentCase, currentSession, createSession, user]);

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
              <h1 className="app-logo-text">VISION-AI</h1>
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
              {currentCase && (
                <p className="case-info">
                  Case: {currentCase.caseTitle} ({currentCase.caseId})
                </p>
              )}
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
