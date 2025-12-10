import React from 'react';
import { useLanguage } from '../../../context/LanguageContext';

/*
 * LoadingState
 * 
 * Purpose: Display animated loading indicator during summary generation
 * 
 * Features: Spinning loader animation with bilingual status messages
 * 
 * Integration: Shows while AWS Bedrock Nova Lite processes the transcript
 * and generates the AI-powered summary
 */

const LoadingState: React.FC = () => {
  // Bilingual support
  const { t } = useLanguage();

  return (
    <div className="loading-container">
      {/* Animated Spinner */}
      <div className="loading-spinner"></div>
      
      {/* Loading Messages */}
      <p className="loading-title">
        {t('summarization.generatingMessage')}
      </p>
      <p className="loading-subtitle">
        {t('summarization.analyzingMessage')}
      </p>
    </div>
  );
};

export default LoadingState;