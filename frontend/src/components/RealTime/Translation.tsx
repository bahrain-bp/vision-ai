import React, { useEffect, useRef } from 'react';
import { useRealTimeTranslation } from '../../hooks/useRealTimeTranslation';
import { Globe, Eye } from 'lucide-react'; 
import TranslationSettings from './TranslationSettings';
import PDFExporter from './TranslationPDFExporter';
import { useLanguage } from '../../context/LanguageContext';

const RealTimeTranslation: React.FC = () => {
  const {
    translations,
    isTranslating,
    error,
    investigatorLanguage,
    witnessLanguage,
    setInvestigatorLanguage,
    setWitnessLanguage
  } = useRealTimeTranslation();

  const { t } = useLanguage();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const translationContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (translationContainerRef.current) {
      const container = translationContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [translations]);

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
          <h3 className="card-title">{t("session.realTime")}</h3>
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
          onClick={openWitnessWindow}
          className="control-btn witness-btn"
          title={t("session.witnessView")}
        >
          <Eye size={16} />
          <span>{t("session.witnessView")}</span>
        </button>

        <div className="conversation-status">
          {isTranslating ? (
            <span className="status-active">
              {t("session.processing")}
            </span>
          ) : translations.length > 0 ? (
            <span className="status-active">
              {t("session.live")} • {translations.length} {t("session.messages")}
            </span>
          ) : (
            <span className="status-waiting">
              {t("translation.waiting")}
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
            <p>{t("translation.waitingForSpeech")}</p>
            <p className="demo-note">{t("translation.demoNote")}</p>
            <p className="demo-note">{t("translation.witnessInstruction")}</p>
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
          title={t("translation.pdfTitle")}
          fileName={"translation-transcript"}
          sessionDate={new Date().toLocaleDateString()}
        />
      </div>

      {translations.length > 0 && (
        <div className="translation-stats">
          <div className="stat-item">
            <span className="stat-label">{t("sessionInfo.statistics")}:</span>
            <span className="stat-value">{translations.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t("session.investigator")}:</span>
            <span className="stat-value">
              {translations.filter(t => t.speaker === 'Investigator').length}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t("identity.witness")}:</span>
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