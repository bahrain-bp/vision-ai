import React, { useEffect, useRef } from 'react';
import { useParticipantTranslation } from '../../../hooks/useRealTimeTranslation';
import { Eye, User, Clock } from 'lucide-react';
import PictureInPicture from './PictureInPicture';

const ParticipantWindow: React.FC = () => {
  const participantView = useParticipantTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [participantView]);

  const getSpeakerLabels = (speaker: string): { en: string; ar: string } => {
    const labels: Record<string, { en: string; ar: string }> = {
      'Investigator': { en: 'Investigator', ar: 'المحقق' },
      'Witness': { en: 'Witness', ar: 'الشاهد' },
      'Accused': { en: 'Accused', ar: 'المتهم' },
      'Victim': { en: 'Victim', ar: 'الضحية' }
    };
    return labels[speaker] || { en: speaker, ar: speaker };
  };

  return (
    <div className="participant-container">
      <div className="participant-header">
        <div className="participant-logo">
          <Eye size={32} className="logo-icon" />
          <h1 className="participant-title">VISION AI - Participant View</h1>
        </div>
        
        <div className="participant-subtitle">
          <h2 className="subtitle-title">العرض المخصص للمشارك</h2>
          <p className="participant-notice">
            This window shows only the translated conversation for the participant
          </p>
          <p className="participant-notice" style={{ direction: 'rtl' }}>
            هذه النافذة تعرض المحادثة المترجمة للمشارك فقط
          </p>
        </div>

        {/* PiP Component */}
        <div className="pip-controls">
          <PictureInPicture 
            messages={participantView}
            title="VISION AI - Live Translation"
          />
        </div>
      </div>

      <div className="participant-content">
        <div className="conversation-container">
          {participantView.length === 0 ? (
            <div className="empty-participant">
              <User size={80} className="empty-icon" />
              <h3>No conversation yet</h3>
              <p className="instruction" style={{ direction: 'rtl' }}>
                لا توجد محادثة بعد
              </p>
              <p className="instruction">
                The investigator will start the conversation shortly.
              </p>
              <p className="instruction" style={{ direction: 'rtl' }}>
                سيبدأ المحقق المحادثة قريباً
              </p>
            </div>
          ) : (
            <div className="conversation-messages">
              {participantView.map((message) => {
                const labels = getSpeakerLabels(message.speaker);
                const isInvestigator = message.speaker === 'Investigator';
                
                return (
                  <div
                    key={message.id}
                    className={`message ${message.speaker.toLowerCase()}`}
                  >
                    <div className="message-header">
                      <span className="speaker-badge">
                        {labels.en} / {labels.ar}
                      </span>
                      <span className="timestamp">
                        <Clock size={12} />
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div 
                      className="message-text" 
                      style={{ 
                        direction: isInvestigator ? 'ltr' : 'rtl', 
                        textAlign: isInvestigator ? 'left' : 'right' 
                      }}
                    >
                      {message.text}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="participant-status">
          <div className="status-indicator">
            <div className="live-dot"></div>
            <span>Live Translation Active / الترجمة المباشرة نشطة</span>
          </div>
          <div className="message-count">
            {participantView.length} messages / رسائل
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParticipantWindow;