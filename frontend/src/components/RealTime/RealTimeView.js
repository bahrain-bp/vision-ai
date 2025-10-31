import React, { useState } from "react";
import {
  Play,
  FileText,
  User,
  MessageSquare,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import LiveTranscription from "./LiveTranscription";
import Translation from "./Translation";
import AIAssistant from "./AIAssistant";
import SessionInfo from "./SessionInfo";
import IdentityVerification from "./IdentityVerification/IdentityVerification";

const RealTimeView = ({
  sessionState,
  setSessionState,
  sessionData,
  identityData,
  onIdentityDataChange,
  onVerifyIdentity,
}) => {
  const [activeTab, setActiveTab] = useState("identity");
  const [aiExpanded, setAiExpanded] = useState(false);
  const [isIdentityVerified, setIsIdentityVerified] = useState(false);

  const handleStartRecording = () => {
    setSessionState("recording");
    setActiveTab("transcription");
  };

  // Add handler for starting investigation
  const handleStartInvestigation = (investigationData) => {
    console.log("Starting investigation with data:", investigationData);
    // Mark identity as verified and switch to transcription tab
    setIsIdentityVerified(true);
    setActiveTab("transcription");
  };

  // Add handler for going back to dashboard
  const handleBackToDashboard = () => {
    console.log("Going back to dashboard");
    // Add your navigation logic here
  };

  return (
    <div className="realtime-view">
      <div className="main-content">
        {sessionState === "ready" && activeTab === "identity" && (
          <div className="recording-content">
            <IdentityVerification
              identityData={identityData}
              onIdentityDataChange={onIdentityDataChange}
              onVerifyIdentity={onVerifyIdentity}
              onStartInvestigation={handleStartInvestigation}
              onBackToDashboard={handleBackToDashboard}
            />
          </div>
        )}

        {sessionState === "ready" && activeTab === "transcription" && (
          <div className="ready-state">
            <div className="ready-content">
              <div className="play-icon-container">
                <Play className="play-icon" />
              </div>
              <h2 className="ready-title">Ready to Start</h2>
              <p className="ready-description">
                Click the button below to begin recording the investigation
                session.
              </p>
              <button
                onClick={handleStartRecording}
                className="start-recording-btn"
              >
                <Play className="btn-icon" />
                <span>Start Recording</span>
              </button>
            </div>
          </div>
        )}

        {sessionState === "recording" && (
          <div className="recording-content">
            {activeTab === "transcription" && (
              <>
                <LiveTranscription />
                <Translation />
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
            } ${sessionState === "ready" ? "disabled" : ""}`}
            disabled={sessionState === "ready"}
          >
            <FileText className="btn-icon" />
            <span>Transcription & Translation</span>
          </button>
        </div>

        <div className="ai-assistant-section">
          <button
            onClick={() => setAiExpanded(!aiExpanded)}
            className="ai-toggle-btn"
          >
            <div className="ai-toggle-header">
              <MessageSquare className="btn-icon" />
              <span>AI Assistant</span>
            </div>
            {aiExpanded ? (
              <ChevronUp className="chevron-icon" />
            ) : (
              <ChevronDown className="chevron-icon" />
            )}
          </button>
          {aiExpanded && <AIAssistant sessionState={sessionState} />}
        </div>

        <SessionInfo sessionData={sessionData} />
      </div>
    </div>
  );
};

export default RealTimeView;
