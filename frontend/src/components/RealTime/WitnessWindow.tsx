import React, { useEffect, useRef } from 'react';
import { useWitnessTranslation } from '../../hooks/useRealTimeTranslation';
import { Eye, User, Clock } from 'lucide-react';

const WitnessWindow: React.FC = () => {
  const witnessView = useWitnessTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [witnessView]);

  return (
    <div className="witness-container">
      <div className="witness-header">
        <div className="witness-logo">
          <Eye size={32} className="logo-icon" />
          <h1 className="witness-title">VISION AI - Witness View</h1>
        </div>
        <div className="witness-subtitle">
          <h2 className="arabic-title">العرض المخصص للشاهد</h2>
          <p className="witness-notice">
            This window shows only the translated conversation for the witness
          </p>
          <p className="arabic-notice">هذا النافذة تعرض المحادثة المترجمة للشاهد فقط</p>
        </div>
      </div>

      <div className="witness-content">
        <div className="conversation-container">
          {witnessView.length === 0 ? (
            <div className="empty-witness">
              <User size={80} className="empty-icon" />
              <h3>No conversation yet</h3>
              <p className="arabic-text">لا توجد محادثة بعد</p>
              <p className="instruction">
                The investigator will start the conversation shortly.
                <br />
                <span className="arabic-text">سيبدأ المحقق المحادثة قريباً</span>
              </p>
            </div>
          ) : (
            <div className="conversation-messages">
              {witnessView.map((message) => (
                <div
                  key={message.id}
                  className={`message ${message.speaker.toLowerCase()}`}
                >
                  <div className="message-header">
                    <span className="speaker-badge">
                      {message.speaker === 'Investigator' ? 'المحقق' : 'الشاهد'}
                    </span>
                    <span className="timestamp">
                      <Clock size={12} />
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <div className="message-text witness-text">
                    {message.text}
                  </div>
                </div>
              ))}
              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Live Status */}
        <div className="witness-status">
          <div className="status-indicator">
            <div className="live-dot"></div>
            <span>Live Translation Active</span>
          </div>
          <div className="message-count">
            {witnessView.length} messages
          </div>
        </div>
      </div>
    </div>
  );
};

export default WitnessWindow;