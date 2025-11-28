import React from "react";
import { FileText } from "lucide-react";
import { useCaseContext } from "../../hooks/useCaseContext";
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
  const { currentPersonName } = useCaseContext();

  const participantName =
    currentPersonName || sessionData.participant || "Not verified yet";
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
              <span className="stat-label">Words:</span>
              <span className="stat-value">247</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Translations:</span>
              <span className="stat-value">12</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Avg Confidence:</span>
              <span className="stat-value confidence-high">98%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionInfo;
