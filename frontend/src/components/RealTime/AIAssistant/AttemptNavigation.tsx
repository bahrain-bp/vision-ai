
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AttemptNavigationProps } from '../../../types/aiQuestionsRT';

/**
 * AttemptNavigation Component
 * 
 * Minimal navigation controls between question generation attempts:
 * - Previous/Next icon buttons
 * - Current attempt indicator
 * - Ultra-compact single-line layout
 * 
 * Props:
 * - currentIndex: 0-based index of current attempt
 * - totalAttempts: Total number of attempts
 * - onNavigate: Callback with new index when navigating
 * - disabled: Disable all navigation buttons
 * 
 * Note: Only renders if totalAttempts > 1
 */
const AttemptNavigation: React.FC<AttemptNavigationProps> = ({
  currentIndex,
  totalAttempts,
  onNavigate,
  disabled = false,
}) => {
  // Don't render if only one attempt
  if (totalAttempts <= 1) {
    return null;
  }

  // Calculate button states
  const isFirstAttempt = currentIndex === 0;
  const isLastAttempt = currentIndex === totalAttempts - 1;

  // Navigation handlers
  const handlePrevious = () => {
    if (!isFirstAttempt && !disabled) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (!isLastAttempt && !disabled) {
      onNavigate(currentIndex + 1);
    }
  };

  // Convert 0-based index to 1-based display
  const displayNumber = currentIndex + 1;

  return (
    <div className="flex items-center justify-center gap-3 py-2">
      
      {/* Previous Button - Icon Only */}
      <button
        onClick={handlePrevious}
        disabled={isFirstAttempt || disabled}
        className={`
          p-1.5 rounded-md transition-colors
          ${isFirstAttempt || disabled
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }
        `}
        aria-label="Previous attempt"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Current Attempt Indicator - Minimal */}
      <span className="text-xs font-semibold text-gray-600 px-2">
        Attempt {displayNumber} of {totalAttempts}
      </span>

      {/* Next Button - Icon Only */}
      <button
        onClick={handleNext}
        disabled={isLastAttempt || disabled}
        className={`
          p-1.5 rounded-md transition-colors
          ${isLastAttempt || disabled
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }
        `}
        aria-label="Next attempt"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

    </div>
  );
};

export default AttemptNavigation;