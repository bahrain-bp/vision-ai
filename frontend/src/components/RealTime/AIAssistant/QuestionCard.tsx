// src/components/RealTime/AIAssistant/QuestionCard.tsx

import React, { useState } from 'react';
import { Copy, RotateCcw } from 'lucide-react';
import { 
  QuestionCardProps, 
  QuestionCategory 
} from '../../../types/aiQuestionsRT';

/**
 * QuestionCard Component
 * 
 * Displays a single AI-generated question with:
 * - Category badge (color-coded)
 * - Selection checkbox
 * - Flip animation to show AI reasoning
 * - Copy to clipboard functionality
 * 
 * Props: Imported from aiQuestionsRT.ts
 */

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  isSelected,
  onSelect,
  onFlip,
  isFlipped: controlledIsFlipped,
  disabled = false,
}) => {
  // Local flip state (if not controlled by parent)
  const [localIsFlipped, setLocalIsFlipped] = useState(false);
  
  // Use controlled state if provided, otherwise use local state
  const isFlipped = controlledIsFlipped !== undefined ? controlledIsFlipped : localIsFlipped;

  // Category color mapping
  const getCategoryStyles = (category: QuestionCategory) => {
    const styles = {
      clarification: {
        bg: 'bg-indigo-100',
        text: 'text-indigo-700',
        border: 'border-indigo-500',
      },
      verification: {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        border: 'border-purple-500',
      },
      timeline: {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        border: 'border-amber-500',
      },
      motivation: {
        bg: 'bg-green-100',
        text: 'text-green-700',
        border: 'border-green-500',
      },
    };
    return styles[category];
  };

  const categoryStyles = getCategoryStyles(question.category);

  // Handle flip
  const handleFlip = () => {
    // Flip is always allowed, even in read-only mode
    
    if (onFlip) {
      onFlip(question.id);
    } else {
      setLocalIsFlipped(!isFlipped);
    }
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    // Copy is always allowed, even in read-only mode
    
    try {
      await navigator.clipboard.writeText(question.text);
      // TODO: Add toast notification "Question copied!"
      console.log('✓ Question copied to clipboard');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Handle checkbox change
  const handleSelect = () => {
    if (disabled) return;
    onSelect(question.id);
  };

  // Format category name for display
  const formatCategory = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <div
      className={`
        relative bg-white rounded-lg shadow-sm border-l-4 
        ${categoryStyles.border}
        ${isSelected ? 'ring-2 ring-indigo-500 ring-opacity-50' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
        transition-all duration-200
      `}
    >
      {/* Card Inner Container with Flip Effect */}
      <div
        className={`
          relative
          transition-transform duration-500 ease-in-out
          ${isFlipped ? '[transform:rotateY(180deg)]' : ''}
        `}
        style={{ transformStyle: 'preserve-3d' }}
      >
        
        {/* FRONT SIDE - Question */}
        <div
          className={`
            p-4
            ${isFlipped ? 'hidden' : 'block'}
          `}
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Header: Checkbox + Category Badge */}
          <div className="flex items-start gap-3 mb-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleSelect}
              disabled={disabled}
              className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
            />
            
            <span className={`
              ${categoryStyles.bg} ${categoryStyles.text}
              text-xs font-semibold px-3 py-1 rounded-full
            `}>
              {formatCategory(question.category)}
            </span>
          </div>

          {/* Question Text */}
          <p className="text-sm text-gray-800 leading-relaxed mb-4 pl-7">
            {question.text}
          </p>

          {/* Action Buttons */}
          <div className="flex gap-2 pl-7">
            <button
              onClick={handleFlip}
              disabled={false}  // Always allow flip, even in read-only mode
              className="
                flex items-center gap-1.5 px-3 py-1.5 
                text-xs font-medium text-gray-700 
                bg-gray-100 hover:bg-gray-200 
                rounded-md transition-colors
                disabled:hover:bg-gray-100 disabled:cursor-not-allowed
              "
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Show Reasoning
            </button>

            <button
              onClick={handleCopy}
              disabled={disabled}
              className="
                flex items-center gap-1.5 px-3 py-1.5 
                text-xs font-medium text-gray-700 
                bg-gray-100 hover:bg-gray-200 
                rounded-md transition-colors
                disabled:hover:bg-gray-100 disabled:cursor-not-allowed
              "
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
          </div>
        </div>

        {/* BACK SIDE - AI Reasoning */}
        <div
          className={`
            p-4
            ${isFlipped ? 'block' : 'hidden'}
          `}
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              AI Reasoning
            </h4>
          </div>

          {/* Reasoning Text */}
          {question.reasoning && (
            <div className="mb-3">
              <p className="text-sm text-gray-700 leading-relaxed">
                {question.reasoning}
              </p>
            </div>
          )}

          {/* Source Context */}
          {question.sourceContext && (
            <div className="mb-4 p-2 bg-gray-50 rounded border-l-2 border-gray-300">
              <p className="text-xs text-gray-600">
                <span className="font-semibold">Source: </span>
                {question.sourceContext}
              </p>
            </div>
          )}

          {/* Flip Back Button */}
          <button
            onClick={handleFlip}
            disabled={false} // Always allow flip, even in read-only mode
            className="
              flex items-center gap-1.5 px-3 py-1.5 
              text-xs font-medium text-indigo-700 
              bg-indigo-50 hover:bg-indigo-100 
              rounded-md transition-colors w-full justify-center
              disabled:hover:bg-indigo-50 disabled:cursor-not-allowed
            "
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Show Question
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionCard;