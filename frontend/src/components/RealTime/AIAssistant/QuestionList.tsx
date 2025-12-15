import React from 'react';
import { Check, RotateCcw, Sparkles } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext'; // ← ADDED
import { QuestionListProps } from '../../../types/aiQuestionsRT';
import QuestionCard from './QuestionCard';

/**
 * QuestionList Component
 * 
 * Displays a list of generated questions with action buttons:
 * - Maps QuestionCard components for each question
 * - Confirm button to save selected questions
 * - Retry button to regenerate questions
 * - Loading and empty states
 * 
 * Props:
 * - attempt: Current attempt with questions to display
 * - selectedQuestionIds: Array of selected question IDs
 * - onQuestionSelect: Callback when question checkbox clicked
 * - onConfirm: Callback when confirm button clicked
 * - onRetry: Callback when retry button clicked
 */
const QuestionList: React.FC<QuestionListProps> = ({
  attempt,
  selectedQuestionIds,
  onQuestionSelect,
  onConfirm,
  onRetry,
}) => {
  const { t } = useLanguage(); // ← ADDED
  // Empty state - no questions in attempt
  if (!attempt || !attempt.questions || attempt.questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Sparkles className="w-12 h-12 text-gray-400 mb-3" />
        <p className="text-sm font-medium text-gray-600 mb-1">
          {t("aiAssistant.noQuestionsYet")} {/* ← CHANGED */}
        </p>
        <p className="text-xs text-gray-500">
          {t("aiAssistant.clickGenerate")} {/* ← CHANGED */}
        </p>
      </div>
    );
  }

 // Calculate selection count
const selectedCount = selectedQuestionIds.length;
// Note: Confirm is NEVER disabled - 0 selections means "confirm all"

  return (
    <div className="space-y-3">
      
      {/* Question Cards */}
      <div className="space-y-3">
        {attempt.questions.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            isSelected={selectedQuestionIds.includes(question.id)}
            onSelect={onQuestionSelect}
            disabled={attempt.isConfirmed} // Disable checkboxes if confirmed
          />
        ))}
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-3">
        
        {/* Confirm Button */}
        <button
  onClick={onConfirm}
  disabled={attempt.isConfirmed || selectedCount > 0}  // ← Disabled if confirmed OR any selections
  className={`
    w-full flex items-center justify-center gap-2
    px-4 py-3 rounded-lg font-semibold text-sm
    transition-all duration-200
    ${attempt.isConfirmed || selectedCount > 0
      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
      : 'bg-green-600 text-white hover:bg-green-700 active:scale-95'
    }
  `}
>
  <Check className="w-5 h-5" />
  <span>
    {attempt.isConfirmed ? t("aiAssistant.confirmed") + ' ✓' : t("aiAssistant.confirmAll")} {/* ← CHANGED */}
  </span>
</button>

        {/* Retry Button */}
        <button
  onClick={onRetry}
  disabled={attempt.isConfirmed}
  className={`
    w-full flex items-center justify-center gap-2
    px-4 py-3 rounded-lg font-semibold text-sm
    transition-all duration-200
    ${attempt.isConfirmed
      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:scale-95'
    }
  `}
>
  <RotateCcw className="w-5 h-5" />
  <span>
    {selectedCount === 0 ? t("aiAssistant.retryAll") : `${t("aiAssistant.retrySelected")} (${selectedCount})`} {/* ← CHANGED */}
  </span>
</button>

      </div>

    </div>
  );
};

export default QuestionList;