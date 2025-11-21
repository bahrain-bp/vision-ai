// React Context for managing AI Question Generation state and logic

import React, { createContext, useState, useCallback, ReactNode } from 'react';
import {
  Question,
  QuestionAttempt,
  QuestionMetrics,
  QuestionGenerationContext,
} from '../types';

// ============================================
// CONTEXT TYPE DEFINITION
// ============================================

export interface QuestionContextType {        // This basically shows what this context will provide
  // ========== STATE ==========
  attempts: QuestionAttempt[];              // All generation attempts in this session
  currentAttemptIndex: number;              // Index of currently displayed attempt
  currentAttempt: QuestionAttempt | null;   // Currently displayed attempt (computed)
  selectedQuestionIds: string[];            // IDs of selected questions in current attempt
  metrics: QuestionMetrics;                 // Session-wide metrics
  isLoading: boolean;                       // Is API call in progress?
  error: string | null;                     // Error message if generation failed

  // ========== ACTIONS ==========
  generateQuestions: (context: QuestionGenerationContext) => Promise<void>;
  confirmAttempt: () => void;
  retryWithSelection: (context: QuestionGenerationContext) => Promise<void>;
  navigateToAttempt: (index: number) => void;
  selectQuestion: (questionId: string) => void;
  clearError: () => void;
  resetSession: () => void;
}

// ============================================
// CREATE CONTEXT
// ============================================

const QuestionContext = createContext<QuestionContextType | undefined>(undefined);

// ============================================
// PROVIDER COMPONENT
// ============================================

export const QuestionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  
  // ========== STATE ==========
  const [attempts, setAttempts] = useState<QuestionAttempt[]>([]);
  const [currentAttemptIndex, setCurrentAttemptIndex] = useState<number>(-1);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<QuestionMetrics>({
    confirmedCount: 0,
    rejectedCount: 0,
    retryCount: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ========== COMPUTED VALUES ==========
  const currentAttempt = currentAttemptIndex >= 0 ? attempts[currentAttemptIndex] : null;

  // ========== HELPER FUNCTIONS ==========

  /**
   * Generate unique attempt ID
   */
  const generateAttemptId = (): string => {
    return `attempt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  /**
   * Generate unique question ID
   */
  const generateQuestionId = (): string => {
    return `question-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // ========== MAIN ACTIONS ==========
  /**
   * 1. generateQuestions()      // Generate new questions via API
     2. confirmAttempt()         // Save selected questions
     3. retryWithSelection()     // Regenerate with selective keep
     4. navigateToAttempt()      // Switch between attempts
     5. selectQuestion()         // Toggle question selection
     6. clearError()             // Dismiss error message
     7. resetSession()           // Clear everything
   */

  /**
   * Generate new questions using API
   * TODO: Replace mock data with actual API call in Phase 3
   */
  const generateQuestions = useCallback(
    async (context: QuestionGenerationContext) => {
      setIsLoading(true);
      setError(null);

      try {
        // TODO: Phase 3 - Replace with actual API call
        // const response = await questionService.generateQuestions(context);

        // MOCK DATA for now (Phase 1-2 testing)
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay

        const mockQuestions: Question[] = Array.from({ length: context.questionCount }, (_, i) => ({
          id: generateQuestionId(),
          text: `${context.language === 'ar' ? 'سؤال تجريبي' : 'Mock question'} ${i + 1}`,
          category: (['clarification', 'verification', 'timeline', 'motivation'] as const)[i % 4],
          status: 'pending',
          reasoning: `Generated based on testimony context (mock)`,
          sourceContext: 'Mock source context from transcript',
          generatedAt: new Date().toISOString(),
        }));

        const newAttempt: QuestionAttempt = {
          attemptId: generateAttemptId(),
          questions: mockQuestions,
          language: context.language,
          timestamp: new Date().toISOString(),
          isConfirmed: false,
        };

        // Add new attempt to history
        setAttempts(prev => [...prev, newAttempt]);
        setCurrentAttemptIndex(attempts.length); // Point to new attempt
        setSelectedQuestionIds([]); // Clear selections

        console.log('✅ Generated questions successfully', {
          attemptId: newAttempt.attemptId,
          questionCount: mockQuestions.length,
          language: context.language,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate questions';
        setError(errorMessage);
        console.error('❌ Error generating questions:', errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [attempts.length]
  );

  /**
   * Confirm current attempt and save selected questions
   */
  const confirmAttempt = useCallback(() => {
    if (!currentAttempt) {
      console.warn('⚠️ No current attempt to confirm');
      return;
    }

    // Update question statuses
    const updatedQuestions = currentAttempt.questions.map(q => ({
      ...q,
      status: (selectedQuestionIds.includes(q.id) ? 'confirmed' : 'rejected') as 'confirmed' | 'rejected',
    }));

    // Update attempt
    const updatedAttempt: QuestionAttempt = {
      ...currentAttempt,
      questions: updatedQuestions,
      isConfirmed: true,
    };

    // Update attempts array
    const updatedAttempts = [...attempts];
    updatedAttempts[currentAttemptIndex] = updatedAttempt;
    setAttempts(updatedAttempts);

    // Update metrics
    const confirmedCount = selectedQuestionIds.length;
    const rejectedCount = updatedQuestions.length - confirmedCount;

    setMetrics(prev => ({
      ...prev,
      confirmedCount: prev.confirmedCount + confirmedCount,
      rejectedCount: prev.rejectedCount + rejectedCount,
    }));

    // TODO: Phase 3 - Save to S3
    // await questionService.saveToS3(updatedAttempt);

    console.log('Confirmed attempt', {
      attemptId: updatedAttempt.attemptId,
      confirmedQuestions: confirmedCount,
      rejectedQuestions: rejectedCount,
    });
  }, [currentAttempt, currentAttemptIndex, attempts, selectedQuestionIds]);

  /**
   * Retry generation - keep selected questions, regenerate unselected
   */
  const retryWithSelection = useCallback(
    async (context: QuestionGenerationContext) => {
      if (!currentAttempt) {
        console.warn('No current attempt to retry');
        return;
      }

      // Increment retry count
      setMetrics(prev => ({ ...prev, retryCount: prev.retryCount + 1 }));

      // TODO: Phase 3 - Implement selective regeneration
      // For now, just generate new questions
      await generateQuestions(context);

      console.log('Retrying with selection', {
        previousAttemptId: currentAttempt.attemptId,
        selectedCount: selectedQuestionIds.length,
      });
    },
    [currentAttempt, selectedQuestionIds.length, generateQuestions]
  );

  /**
   * Navigate to specific attempt
   */
  const navigateToAttempt = useCallback(
    (index: number) => {
      if (index >= 0 && index < attempts.length) {
        setCurrentAttemptIndex(index);
        
        // Load selections from that attempt
        const attempt = attempts[index];
        const selectedIds = attempt.questions
          .filter(q => q.status === 'confirmed')
          .map(q => q.id);
        setSelectedQuestionIds(selectedIds);

        console.log('Navigated to attempt', {
          index: index + 1,
          total: attempts.length,
          attemptId: attempt.attemptId,
        });
      }
    },
    [attempts]
  );

  /**
   * Toggle question selection
   */
  const selectQuestion = useCallback((questionId: string) => {
    setSelectedQuestionIds(prev => {
      const isSelected = prev.includes(questionId);
      const newSelection = isSelected
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId];
      
      console.log(isSelected ? ' Deselected question' : ' Selected question', {
        questionId,
        totalSelected: newSelection.length,
      });
      
      return newSelection;
    });
  }, []);

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Reset entire session (clear all attempts and metrics)
   */
  const resetSession = useCallback(() => {
    setAttempts([]);
    setCurrentAttemptIndex(-1);
    setSelectedQuestionIds([]);
    setMetrics({
      confirmedCount: 0,
      rejectedCount: 0,
      retryCount: 0,
    });
    setError(null);
    console.log('Session reset');
  }, []);

  // ========== CONTEXT VALUE ==========
  const value: QuestionContextType = {
    // State
    attempts,
    currentAttemptIndex,
    currentAttempt,
    selectedQuestionIds,
    metrics,
    isLoading,
    error,

    // Actions
    generateQuestions,
    confirmAttempt,
    retryWithSelection,
    navigateToAttempt,
    selectQuestion,
    clearError,
    resetSession,
  };

  return (
    <QuestionContext.Provider value={value}>
      {children}
    </QuestionContext.Provider>
  );
};
export { QuestionContext };