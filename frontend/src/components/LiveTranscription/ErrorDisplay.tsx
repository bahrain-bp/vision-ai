import React, { useState } from "react";
import { AlertCircle, X, ChevronDown, ChevronUp } from "lucide-react";
import { ErrorType, ErrorTypeLabels } from "../../types"; // Import the types

interface ErrorDisplayProps {
  displayMessage: string;
  rawMessage?: string;
  displayTitle?: ErrorType; // Change to ErrorType
  onClose?: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  displayMessage,
  rawMessage,
  displayTitle = "unknown", // Default to 'unknown' ErrorType
  onClose,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const handleClose = () => {
    if (onClose) onClose();
    window.location.reload();
  };
  return (
    <div className="modal-overlay">
      <div className="summary-modal max-w-lg">
        {/* Header */}
        <div className="modal-header bg-gradient-to-r from-red-500 to-red-600">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <AlertCircle className="w-5 h-5 text-white" />
            </div>
            <h2 className="modal-title text-white">
              {ErrorTypeLabels[displayTitle]}
            </h2>
          </div>
          {onClose && (
            <button
              onClick={handleClose}
              className="close-button text-white/80 hover:text-white hover:bg-white/10"
            >
              <X className="icon" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Main Message */}
          <div className="session-details-card">
            <p className="text-gray-700 text-base leading-relaxed">
              {displayMessage}
            </p>
          </div>

          {/* Technical Details */}
          {rawMessage && (
            <div className="session-details-card mt-4">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-between hover:bg-gray-50 transition-colors p-2 rounded-lg group"
              >
                <span className="details-title text-sm">Technical Details</span>
                {showDetails ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {showDetails && (
                <div className="mt-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-words font-mono">
                      {rawMessage}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="modal-actions">
            {onClose && (
              <button onClick={handleClose} className="action-btn primary">
                <span>Try Again</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay;
