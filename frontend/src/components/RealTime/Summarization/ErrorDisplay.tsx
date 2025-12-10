import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';

/*
 * ErrorDisplay
 * 
 * Purpose: Display error messages when summary generation fails
 * 
 * Features: Prominent error styling with icon and detailed message
 * 
 * Integration: Shows API errors, connection failures, or AWS Bedrock
 * service errors with shake animation for visibility
 */

interface ErrorDisplayProps {
  error: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error }) => {
  // Bilingual support
  const { t } = useLanguage();

  return (
    <div className="error-container">
      <AlertCircle className="error-icon" />
      <div>
        <strong>{t('summarization.error')}:</strong> {error}
      </div>
    </div>
  );
};

export default ErrorDisplay;