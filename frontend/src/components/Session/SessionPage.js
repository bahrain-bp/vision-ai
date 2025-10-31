import React, { useState } from "react";
import { ArrowLeft, Clock } from "lucide-react";
import RealTimeView from "../RealTime/RealTimeView";
import ProcessingView from "../Processing/ProcessingView";
import SessionSummaryModal from "../RealTime/SessionSummaryModal";

const SessionPage = ({ user, onSignOut, sessionData, onEndSession }) => {
  const [activeMainTab, setActiveMainTab] = useState("real-time");
  const [sessionState, setSessionState] = useState("ready");
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [setupData, setSetupData] = useState({
    witnessData: {
      fullName: sessionData?.witnessData?.fullName || "",
      idNumber: sessionData?.witnessData?.idNumber || "",
    },
    identityData: {
      referencePhoto: sessionData?.identityData?.referencePhoto || null,
      isVerified: sessionData?.identityData?.isVerified || false,
    },
    translationSettings: {
      sourceLanguage: sessionData?.translationSettings?.sourceLanguage || "ar",
      targetLanguage: sessionData?.translationSettings?.targetLanguage || "en",
    },
  });

  const currentSessionData = sessionData || {
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
    setSessionState("completed");
    setShowSummaryModal(true);
  };

  const handleCloseSummary = () => {
    setShowSummaryModal(false);
    setSessionState("ready");
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

  const updateWitnessData = (field, value) => {
    setSetupData((prev) => ({
      ...prev,
      witnessData: {
        ...prev.witnessData,
        [field]: value,
      },
    }));
  };

  const updateIdentityData = (field, value) => {
    setSetupData((prev) => ({
      ...prev,
      identityData: {
        ...prev.identityData,
        [field]: value,
      },
    }));
  };

  const updateTranslationSettings = (field, value) => {
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
                {sessionState === "recording" && (
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
              {sessionState === "recording" && (
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
