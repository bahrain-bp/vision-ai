import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { QuestionGeneratorControlsProps, Language } from '../../../types/aiQuestionsRT';

/**
 * GeneratorControls Component
 * 
 * Provides UI controls for generating AI questions:
 * - Generate button with loading state
 * - Question count selector (3, 5, 7, 10)
 * - Language selector (Arabic/English)
 * 
 * Props:
 * - onGenerate: Callback when generate button clicked
 * - isLoading: Whether generation is in progress
 * - disabled: Disable all controls (e.g., when recording is off)
 */

const GeneratorControls: React.FC<QuestionGeneratorControlsProps> = ({
  onGenerate,
  isLoading,
  disabled = false,
}) => {
  // Local state for selected options
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [language, setLanguage] = useState<Language>('en');

  // Available question count options
  const countOptions = [3, 5, 7, 10];

  // Language options with display labels
  const languageOptions: { value: Language; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'ar', label: 'Arabic' },
  ];

  // Handle generate button click
  const handleGenerate = () => {
    if (disabled || isLoading) return;
    onGenerate(questionCount, language);
  };

  // Determine if controls should be disabled
  const isDisabled = disabled || isLoading;

  return (
    <div className="space-y-3">

      {/* Dropdowns Container */}
      <div className="flex gap-2">

        {/* Question Count Dropdown */}
        <div className="flex-1">
          <select
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            disabled={isDisabled}
            className={`
              w-full px-3 py-2 rounded-lg text-sm font-medium
              border-2 border-gray-200
              focus:outline-none focus:ring-2 focus:ring-[#214080] focus:border-transparent
              transition-all
              ${isDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:border-gray-300 cursor-pointer'
              }
            `}
          >
            {countOptions.map((count) => (
              <option key={count} value={count}>
                {count} Questions
              </option>
            ))}
          </select>
        </div>

        {/* Language Dropdown */}
        <div className="flex-1">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            disabled={isDisabled}
            className={`
              w-full px-3 py-2 rounded-lg text-sm font-medium
              border-2 border-gray-200
              focus:outline-none focus:ring-2 focus:ring-[#214080] focus:border-transparent
              transition-all
              ${isDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:border-gray-300 cursor-pointer'
              }
            `}
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isDisabled}
        className={`
          w-full flex items-center justify-center gap-2
          px-4 py-3 rounded-lg font-semibold text-sm
          transition-all duration-200
          ${isDisabled
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-[#214080] text-white hover:bg-[#1a3366] active:scale-95'
          }
        `}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Generating...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            <span>Generate Questions</span>
          </>
        )}
      </button>
    </div>
  );
};

export default GeneratorControls;