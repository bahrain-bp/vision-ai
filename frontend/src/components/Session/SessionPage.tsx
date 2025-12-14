import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Clock,
  Pause,
  Play,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import RealTimeView from "../RealTime/RealTimeView";
import ProcessingView from "../Processing/ProcessingView";

import { User, RecordingStatus } from "../../types/";
import { useTranscription } from "../../hooks/useTranscription";
import { useCaseContext } from "../../hooks/useCaseContext";
import { useRealTimeTranslation } from "../../hooks/useRealTimeTranslation";
import { useLanguage } from "../../context/LanguageContext";
import { getTimeString } from "../common/Timer/Timer";
import { TranslationProvider } from "../../context/TranslationContext";
import { CameraFootageProvider } from "../../context/CameraFootageContext";

import { AudioAnalysisProvider } from "../../context/AudioAnalysisContext";
import LanguageToggle from "../common/LanguageToggle";

interface TranslationSettings {
  sourceLanguage: string;
  targetLanguage: string;
}

interface SetupData {
  translationSettings: TranslationSettings;
}

interface SessionData {
  sessionId: string;
  investigator: string;
  participant: string;
  language: string;
  duration: string;
  status: string;
  translationSettings?: TranslationSettings;
}

interface SessionPageProps {
  user: User;
  onSignOut: () => void;
  sessionData?: SessionData;
  onEndSession?: () => void;
}

type MainTab = "real-time" | "processing";

// OUTER COMPONENT - Only provides the context
const SessionPage: React.FC<SessionPageProps> = ({
  user,
  onSignOut,
  sessionData,
  onEndSession,
}) => {
  return (
    <TranslationProvider investigatorLanguage="en" witnessLanguage="ar">
      <SessionPageContent
        user={user}
        onSignOut={onSignOut}
        sessionData={sessionData}
        onEndSession={onEndSession}
      />
    </TranslationProvider>
  );
};

// INNER COMPONENT - Has all the logic and uses the hook
const SessionPageContent: React.FC<SessionPageProps> = ({
  user,
  onSignOut,
  sessionData,
  onEndSession,
}) => {
  const { t } = useLanguage();
  const {
    currentCase,
    currentSession,
    createSession,
    updateSessionStatus,
    setCurrentSession,
    setCurrentPersonName,
    setCurrentPersonType,
  } = useCaseContext();

  const [activeMainTab, setActiveMainTab] = useState<MainTab>("real-time");
  const [sessionState, setSessionState] = useState<RecordingStatus>("off");

  const { stopRecording, toggleRecordingPause, toggleReset } =
    useTranscription();
  
  const { saveTranslationsToS3 } = useRealTimeTranslation();
  const { language: contextLanguage } = useLanguage();

  const [language, setLanguage] = useState<"en" | "ar">(contextLanguage);

  const [triggerSummarization, setTriggerSummarization] =
    useState<boolean>(false);

  const [isPaused, setIsPaused] = useState(false);
  const [timerMs, setTimerMs] = useState(0);
  const [timerString, setTimerString] = useState("00:00:00");

  const [setupData, setSetupData] = useState<SetupData>({
    translationSettings: {
      sourceLanguage: sessionData?.translationSettings?.sourceLanguage || "ar",
      targetLanguage: sessionData?.translationSettings?.targetLanguage || "en",
    },
  });

  const getInvestigatorName = () => {
    if (user?.username) return user.username;
    return "Unknown Investigator";
  };

  useEffect(() => {
    let intervalId: any;

    if (sessionState === "on" && !isPaused) {
      intervalId = setInterval(() => {
        setTimerMs((prev) => prev + 10);
      }, 10);
    }

    return () => clearInterval(intervalId);
  }, [sessionState, isPaused]);

  useEffect(() => {
    const formatted = getTimeString(timerMs);
    setTimerString(formatted);
  }, [timerMs]);

  const currentSessionData: SessionData = currentSession
    ? {
        sessionId: currentSession.sessionId,
        investigator: currentSession.investigator || getInvestigatorName(),
        language: language === "en" ? "English" : "Arabic",
        duration: timerString,
        participant: "",
        status: currentSession.status,
      }
    : {
        sessionId: "No session",
        investigator: getInvestigatorName(),
        language: language === "en" ? "English" : "Arabic",
        duration: timerString,
        participant: "",
        status: "Active",
      };
  
  const handleEndSession = async () => {
    stopRecording(setSessionState);

    await saveTranslationsToS3();

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

    // Trigger switch to summarization tab
    setTriggerSummarization(true);
  };
  

  const handleBackToHome = () => {
    sessionCreationAttempted.current = false;
    setCurrentSession(null);
    setCurrentPersonName(null);
    setCurrentPersonType(null);
    if (onEndSession) {
      onEndSession();
    } else {
      onSignOut();
    }
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
          await createSession(currentCase.caseId, investigator);
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
              {language === "ar" ? (
                <ArrowRight className="icon" />
              ) : (
                <ArrowLeft className="icon" />
              )}
              <span>
                {language === "ar"
                  ? "العودة إلى الصفحة الرئيسية"
                  : "Back to Home"}
              </span>
            </button>

            <div className="nav-center">
              <h1 className="app-logo-text">VISION-AI</h1>
              <div className="session-info-header">
                <span className="session-label">{t("session.session")}</span>
                <span className="session-id">
                  {currentSessionData.sessionId}
                </span>
                {sessionState === "on" && (
                  <span className="live-indicator">
                    <span className="live-dot"></span>
                    <span>{t("session.live")}</span>
                  </span>
                )}
              </div>
              <p className="investigator-info">
                {language === "ar" ? "المحقق" : "Investigator"}:{" "}
                {currentSessionData.investigator}
              </p>
              {currentCase && (
                <p className="case-info">
                  {t("session.case")}: {currentCase.caseTitle} (
                  {currentCase.caseId})
                </p>
              )}
            </div>

            <div className="nav-controls">
              <div className="language-controls">
                <LanguageToggle
                  onLanguageChange={(lang) => setLanguage(lang)}
                />
              </div>
              <div className="time-display">
                <Clock className="icon" />
                <span>{currentSessionData.duration}</span>
              </div>
              {sessionState === "on" && (
                <>
                  <button
                    onClick={() => {
                      const newPausedState = !isPaused;
                      setIsPaused(newPausedState);
                      toggleRecordingPause(newPausedState);
                    }}
                    className="pause-btn"
                    style={{
                      padding: "10px 20px",
                      backgroundColor: isPaused ? "#3b82f6" : "#f59e0b",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      marginRight: "12px",
                      fontWeight: "500",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {isPaused ? <Play size={16} /> : <Pause size={16} />}
                    {isPaused ? t("session.resume") : t("session.pause")}
                  </button>

                  <button
                    onClick={() => toggleReset()}
                    className="reset-btn"
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "#6366f1",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      marginRight: "12px",
                      fontWeight: "500",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <RotateCcw size={16} />
                    {t("session.reset")}
                  </button>

                  <button
                    onClick={handleEndSession}
                    className="end-session-btn"
                  >
                    {t("session.endSession")}
                  </button>
                </>
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
            {t("session.realTime")}
          </button>
          <button
            onClick={() => setActiveMainTab("processing")}
            className={`main-tab ${
              activeMainTab === "processing" ? "active" : ""
            }`}
          >
            {t("session.processing")}
          </button>
        </div>
      </div>

      <div className="session-main-content">
        {activeMainTab === "real-time" ? (
          <RealTimeView
            sessionState={sessionState}
            setSessionState={setSessionState}
            sessionData={currentSessionData}
            translationSettings={setupData.translationSettings}
            onTranslationSettingsChange={updateTranslationSettings}
            triggerSummarization={triggerSummarization}
          />
        ) : (
          <AudioAnalysisProvider>
            <CameraFootageProvider>
              <ProcessingView
                sessionData={currentSessionData}
                language={language}
              />
            </CameraFootageProvider>
          </AudioAnalysisProvider>
        )}
      </div>
    </div>
  );
};

export default SessionPage;
