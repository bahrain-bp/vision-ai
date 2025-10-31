import React from 'react';
import { FileText } from 'lucide-react';

const SessionInfo = ({ sessionData }) => {
  return (
    <div className="session-info-card">
      <div className="card-header">
        <FileText className="header-icon" />
        <h3 className="card-title">Session Info</h3>
      </div>

      <div className="info-content">
        <div className="info-item">
          <p className="info-label">Witness:</p>
          <p className="info-value">{sessionData.witness}</p>
        </div>

        <div className="info-item">
          <p className="info-label">Session ID:</p>
          <p className="info-value">{sessionData.sessionId}</p>
        </div>

        <div className="info-item">
          <p className="info-label">Language:</p>
          <p className="info-value">{sessionData.language}</p>
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