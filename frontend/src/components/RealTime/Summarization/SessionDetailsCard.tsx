import React from 'react';
import { CheckCircle } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';

/*
 * SessionDetailsCard
 * 
 * Purpose: Display core session information in a clean card format
 * 
 * Shows: Session ID, Duration, Person Type, and Status
 * 
 * Integration: Receives person type from Identity Verification context,
 * displays status with color-coded badge for quick visual reference
 */

interface SessionDetailsCardProps {
  sessionId: string;
  duration: string;
  personType: string;
  status: string;
}

const SessionDetailsCard: React.FC<SessionDetailsCardProps> = ({
  sessionId,
  duration,
  personType,
  status
}) => {
  // Bilingual support
  const { t } = useLanguage();

  return (
    <div className="session-details-card">
      <h3 className="details-title">
        {t('summarization.sessionDetails')}
      </h3>

      {/* 2x2 Grid Layout */}
      <div className="details-grid">
        
        {/* Session ID */}
        <div className="detail-item">
          <p className="detail-label">
            {t('summarization.sessionId')}:
          </p>
          <p className="detail-value">
            {sessionId}
          </p>
        </div>

        {/* Duration */}
        <div className="detail-item">
          <p className="detail-label">
            {t('summarization.duration')}:
          </p>
          <p className="detail-value">
            {duration}
          </p>
        </div>

        {/* Person Type from Identity Verification */}
        <div className="detail-item">
          <p className="detail-label">
            {t('summarization.personType')}:
          </p>
          <p className="detail-value">
            {personType}
          </p>
        </div>

        {/* Status with color indicator */}
        <div className="detail-item">
          <p className="detail-label">
            {t('summarization.status')}:
          </p>
          <p className={`status-badge ${status === 'Completed' ? 'completed' : 'active'}`}>
            <CheckCircle size={18} />
            {status}
          </p>
        </div>
        
      </div>
    </div>
  );
};

export default SessionDetailsCard;