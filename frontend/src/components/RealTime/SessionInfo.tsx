import React from "react";
import { FileText } from "lucide-react";
import { useCaseContext } from "../../hooks/useCaseContext";
import { useTranscription } from "../../hooks/useTranscription";
interface SessionData {
  sessionId: string;
  participant: string;
  duration: string;
  status: string;
  investigator?: string;
}
 
interface SessionInfoProps {
  sessionData: SessionData;
}
 
const SessionInfo: React.FC<SessionInfoProps> = ({ sessionData }) => {
  const { currentPersonName, currentPersonType } = useCaseContext();
  const { transcriptStats } = useTranscription();
  const getConfidenceClass = (confidence: number) => {
    if (confidence >= 95) return "confidence-excellent";
    if (confidence >= 85) return "confidence-high";
    if (confidence >= 75) return "confidence-good";
    if (confidence >= 65) return "confidence-medium";
    if (confidence >= 55) return "confidence-fair";
    if (confidence >= 45) return "confidence-low";
    if (confidence >= 35) return "confidence-poor";
    return "confidence-critical";
  };
 
  const participantName =
    currentPersonName || sessionData.participant || "Not verified yet";
  const participantType = currentPersonType || "Not set";
  return (
    <div className="session-info-card">
      <div className="card-header">
        <FileText className="header-icon" />
        <h3 className="card-title">Session Info</h3>
      </div>
 
      <div className="info-content">
        <div className="info-item">
          <p className="info-label">Participant Name:</p>
          <p className="info-value">{participantName}</p>
        </div>
 
        <div className="info-item">
          <p className="info-label">Participant Type:</p>
          <p className="info-value">{participantType}</p>
        </div>
 
        <div className="info-item">
          <p className="info-label">Session ID:</p>
          <p className="info-value">{sessionData.sessionId}</p>
        </div>
 
        <div className="info-item">
          <p className="info-label">Duration:</p>
          <p className="info-value">{sessionData.duration}</p>
        </div>
 
        <div className="info-divider"></div>
 
        <div className="stats-section">
          <p className="stats-label">Statistics:</p>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Total Words:</span>
              <span className="stat-value">
                {transcriptStats.totalWordCount}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Investigator Words:</span>
              <span className="stat-value">
                {transcriptStats.investigatorWordCount ?? 0}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Witness Words:</span>
              <span className="stat-value">
                {transcriptStats.witnessWordCount ?? 0}
              </span>
            </div>
            {/*
                <div className="stat-item">
                  <span className="stat-label">Translations:</span>
                  <span className="stat-value">12</span>
                </div>
              */}
 
            <div className="stat-item">
              <span className="stat-label">Average Witness Confidence:</span>
              <span
                className={`stat-value ${getConfidenceClass(
                  transcriptStats.avgWitnessConfidenceLevel * 100
                )}`}
              >
                {(transcriptStats.avgWitnessConfidenceLevel * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
 
export default SessionInfo;