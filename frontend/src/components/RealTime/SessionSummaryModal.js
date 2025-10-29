import React from 'react';
import { X, Download, Share2 } from 'lucide-react';

const SessionSummaryModal = ({ sessionData, onClose }) => {
  return (
    <div className="modal-overlay">
      <div className="summary-modal">
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Session Summary</h2>
          <button
            onClick={onClose}
            className="close-button"
          >
            <X className="icon" />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <div className="session-details-card">
            <h3 className="details-title">Session Details</h3>
            
            <div className="details-grid">
              {/* Left Column */}
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

              {/* Right Column */}
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

          {/* Action Buttons */}
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