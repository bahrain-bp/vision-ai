import React from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import './TranslationErrorDisplay.css';

interface TranslationErrorDisplayProps {
  error: string | null;
  onDismiss?: () => void;
  onRetry?: () => void;
}

const TranslationErrorDisplay: React.FC<TranslationErrorDisplayProps> = ({
  error,
  onDismiss,
  onRetry
}) => {
  if (!error) return null;

  return (
    <div className="translation-error-container">
      <div className="translation-error-box">
        <div className="error-icon-wrapper">
          <AlertTriangle className="error-icon" />
        </div>
        
        <div className="error-content">
          <h4 className="error-title">Translation Error</h4>
          <p className="error-message">{error}</p>
        </div>

        <div className="error-actions">
          {onRetry && (
            <button 
              onClick={onRetry}
              className="error-retry-btn"
              title="Retry translation"
            >
              <RefreshCw size={16} />
            </button>
          )}
          
          {onDismiss && (
            <button 
              onClick={onDismiss}
              className="error-dismiss-btn"
              title="Dismiss error"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TranslationErrorDisplay;