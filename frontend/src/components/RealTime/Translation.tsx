import React, { useEffect, useRef } from 'react';
import { useRealTimeTranslation } from '../../hooks/useRealTimeTranslation';
import { Globe, Trash2, Eye } from 'lucide-react';
import TranslationSettings from './TranslationSettings';
import PDFExporter from './TranslationPDFExporter'; 

const RealTimeTranslation: React.FC = () => {
  const {
    translations,
    clearConversation,
    isTranslating,
    error,
    investigatorLanguage,
    witnessLanguage,
    setInvestigatorLanguage,
    setWitnessLanguage
  } = useRealTimeTranslation();

  // Auto-scroll refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const translationContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new translations arrive
  useEffect(() => {
    if (translationContainerRef.current) {
      const container = translationContainerRef.current;
      // Directly set the scroll position to the bottom of the container
      container.scrollTop = container.scrollHeight;
    }
  }, [translations]);

  // Generate transcript text for PDF export 
  const generateTranscriptText = () => {
    if (translations.length === 0) return '';
    
    return translations.map(trans => 
      `[${trans.timestamp.toLocaleTimeString()}] ${trans.speaker}: ${trans.investigatorDisplay}`
    ).join('\n\n');
  };

  const openWitnessWindow = () => {
    window.open('/witness', 'witness-window', 'width=800,height=600');
  };

  const translationSettings = {
    sourceLanguage: investigatorLanguage,
    targetLanguage: witnessLanguage
  };

  const handleTranslationSettingsChange = (field: 'sourceLanguage' | 'targetLanguage', value: string) => {
    if (field === 'sourceLanguage') {
      setInvestigatorLanguage(value);
    } else {
      setWitnessLanguage(value);
    }
  };

  return (
    <div className="translation-card">
      <div className="card-header">
        <div className="header-left">
          <Globe className="header-icon" />
          <h3 className="card-title">Real-Time Translation</h3>
        </div>
      </div>

      <TranslationSettings 
        translationSettings={translationSettings}
        onTranslationSettingsChange={handleTranslationSettingsChange}
      />

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="translation-controls">
        <button
          onClick={clearConversation}
          disabled={translations.length === 0}
          className="control-btn secondary"
          title="Clear Conversation"
        >
          <Trash2 size={16} />
          <span>Clear All</span>
        </button>

        <button
          onClick={openWitnessWindow}
          className="control-btn witness-btn"
          title="Open Witness Window"
        >
          <Eye size={16} />
          <span>Witness View</span>
        </button>

        <div className="conversation-status">
          {isTranslating ? (
            <span className="status-active">
              Translating...
            </span>
          ) : translations.length > 0 ? (
            <span className="status-active">
              Live • {translations.length} messages
            </span>
          ) : (
            <span className="status-waiting">
              Waiting for transcription...
            </span>
          )}
        </div>
      </div>

      <div 
        className="translation-container"
        ref={translationContainerRef}
      >
        {translations.length === 0 ? (
          <div className="empty-state">
            <Globe size={48} className="empty-icon" />
            <p>Translation will start automatically when speech is detected</p>
            <p className="demo-note">Real-time translation from live transcription</p>
            <p className="demo-note">Click "Witness View" to open translation for witness</p>
          </div>
        ) : (
          <div className="translation-messages">
            {translations.map((translation) => (
              <div key={translation.id} className="translation-line">
                <div className="line-content">
                  <span className="timestamp">
                    {translation.timestamp.toLocaleTimeString()}
                  </span>
                  <span className="speaker">[{translation.speaker}]:</span>
                  <span className="text">
                    {translation.investigatorDisplay}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="action-buttons">
        <PDFExporter
          transcript={generateTranscriptText()}
          title={"Investigation Transcript - Translation"}
          fileName={"translation-transcript"}
          sessionDate={new Date().toLocaleDateString()}
        />
      </div>

      {translations.length > 0 && (
        <div className="translation-stats">
          <div className="stat-item">
            <span className="stat-label">Total:</span>
            <span className="stat-value">{translations.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Investigator:</span>
            <span className="stat-value">
              {translations.filter(t => t.speaker === 'Investigator').length}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Witness:</span>
            <span className="stat-value">
              {translations.filter(t => t.speaker === 'Witness').length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimeTranslation;