import React from 'react';
import { FileText, Globe, CheckCircle, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';

/*
 * CustomizationPanel
 * 
 * Purpose: Provides controls for customizing summary generation
 * 
 * Features: Transcript status indicator, language selector (EN/AR),
 * summary length options, and generate button with loading state
 * 
 * Integration: Displays real-time transcript status from Transcription context,
 * triggers summary generation with user-selected parameters
 */

interface CustomizationPanelProps {
  realTranscript: string;
  selectedLanguage: 'en' | 'ar';
  summaryLength: 'short' | 'medium' | 'long' | 'extra-long';
  loading: boolean;
  onLanguageChange: (language: 'en' | 'ar') => void;
  onLengthChange: (length: 'short' | 'medium' | 'long' | 'extra-long') => void;
  onGenerate: () => void;
}

const CustomizationPanel: React.FC<CustomizationPanelProps> = ({
  realTranscript,
  selectedLanguage,
  summaryLength,
  loading,
  onLanguageChange,
  onLengthChange,
  onGenerate
}) => {
  // Bilingual support
  const { t } = useLanguage();

  return (
    <div className="customization-section">
      <h3 className="customization-title">
        {t('summarization.customization')}
      </h3>

      {/* Transcript Status Indicator */}
      {realTranscript && realTranscript.trim().length > 0 ? (
        <div className="transcript-indicator success">
          <CheckCircle size={16} />
          <span>
            {t('summarization.usingLiveTranscript')} ({realTranscript.length} {t('summarization.characters')})
          </span>
        </div>
      ) : (
        <div className="transcript-indicator warning">
          <AlertCircle size={16} />
          <span>{t('summarization.noLiveTranscript')}</span>
        </div>
      )}

      {/* Controls Grid */}
      <div className="controls-grid">
        
        {/* Language Selection */}
        <div className="form-group">
          <label className="form-label">
            <Globe className="form-label-icon" />
            {t('summarization.summaryLanguage')}
          </label>
          <select 
            value={selectedLanguage}
            onChange={(e) => onLanguageChange(e.target.value as 'en' | 'ar')}
            className="form-select"
          >
            <option value="en">{t('summarization.english')}</option>
            <option value="ar">{t('summarization.arabic')}</option>
          </select>
        </div>

        {/* Summary Length Selection */}
        <div className="form-group">
          <label className="form-label">
            {t('summarization.summaryLength')}
          </label>
          <select 
            value={summaryLength}
            onChange={(e) => onLengthChange(e.target.value as 'short' | 'medium' | 'long' | 'extra-long')}
            className="form-select"
          >
            <option value="short">{t('summarization.short')}</option>
            <option value="medium">{t('summarization.medium')}</option>
            <option value="long">{t('summarization.long')}</option>
            <option value="extra-long">{t('summarization.extraLong')}</option>
          </select>
        </div>
      </div>

      {/* Generate Button */}
      <button 
        className="generate-button"
        onClick={onGenerate}
        disabled={loading}
      >
        <FileText size={20} />
        <span>
          {loading ? t('summarization.generating') : t('summarization.generateButton')}
        </span>
      </button>
    </div>
  );
};

export default CustomizationPanel;