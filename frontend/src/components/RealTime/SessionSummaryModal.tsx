import React from "react";
import { X, Download, Share2 } from "lucide-react";

interface SessionData {
  sessionId: string;
  witness: string;
  language: string;
  duration: string;
  status: string;
}

interface SessionSummaryModalProps {
  sessionData: SessionData;
  onClose: () => void;
}

const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({
  sessionData,
  onClose,
}) => {
  return (
    <div className="modal-overlay">
      <div className="summary-modal">
        <div className="modal-header">
          <h2 className="modal-title">Session Summary</h2>
          <button onClick={onClose} className="close-button">
            <X className="icon" />
          </button>
        </div>

        <div className="modal-body">
          <div className="session-details-card">
            <h3 className="details-title">Session Details</h3>

            <div className="details-grid">
              <div className="details-column">
                <div className="detail-item">
                  <p className="detail-label">Session ID:</p>
                  <p className="detail-value">{sessionData.sessionId}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Duration:</p>
                  <p className="detail-value">15 minutes 23 seconds</p>
                </div>
              </div>

              <div className="details-column">
                <div className="detail-item">
                  <p className="detail-label">Witness:</p>
                  <p className="detail-value">Ahmad Khalil</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Status:</p>
                  <p className="status-completed">Completed</p>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button className="action-btn primary">
              <Download className="btn-icon" />
              <span>Download PDF</span>
            </button>
            <button className="action-btn secondary">
              <Share2 className="btn-icon" />
              <span>Share Report</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionSummaryModal;
