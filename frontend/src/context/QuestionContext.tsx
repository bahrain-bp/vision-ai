// React Context for managing AI Question Generation state and logic
import React, { createContext, useState, useCallback, useMemo, useContext, ReactNode } from 'react';
import { TranscriptionContext } from './TranscriptionContext';
import { CaseContext } from './CaseContext';
import {
  QuestionAttempt,
  QuestionMetrics,
  QuestionGenerationContext,
  SaveQuestionsRequest,
} from '../types';
import questionService from '../services/AIAssistant/questionServiceRT';

// ============================================
// CONTEXT TYPE DEFINITION
// ============================================
export interface QuestionContextType {
  // ========== STATE ==========
  attempts: QuestionAttempt[];
  currentAttemptIndex: number;
  currentAttempt: QuestionAttempt | null;
  selectedQuestionIds: string[];
  metrics: QuestionMetrics;
  isLoading: boolean;
  error: string | null;
  canGenerate: boolean;

  // ✨ NEW
  generateFinalHTMLReport: (
    caseId: string,
    sessionId: string,
    metadata: {
      investigator: string;
      personType: string;
      personName: string;
      sessionDate: string;
    }
  ) => Promise<{ success: boolean; data?: any; error?: any }>;


  // ========== ACTIONS ==========
  generateQuestions: (context: QuestionGenerationContext) => Promise<void>;
  confirmAttempt: () => Promise<void>;
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
  // ========== TRANSCRIPTION CONTEXT ==========
  const transcriptionContext = useContext(TranscriptionContext);
  
  if (!transcriptionContext) {
    throw new Error('QuestionProvider must be used within TranscriptionProvider');
  }
  
  const { recordingStatus, getFullTranscript } = transcriptionContext;

  // ========== CASE CONTEXT ==========
  const caseContext = useContext(CaseContext);

  if (!caseContext) {
    throw new Error('QuestionProvider must be used within CaseProvider');
  }

  const { 
    currentSession, 
    currentPersonType, 
    currentPersonName 
  } = caseContext;

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

  /**
   * Prerequisites check for question generation
   */
  const canGenerate = useMemo((): boolean => {
    const hasTranscript = !!(getFullTranscript && getFullTranscript.trim().length > 0);
    const isRecordingActiveOrPaused = recordingStatus !== 'off';
    const result = hasTranscript && isRecordingActiveOrPaused;
    
    console.log('🔍 Prerequisites check:', {
      hasTranscript,
      transcriptLength: getFullTranscript?.length || 0,
      recordingStatus,
      isRecordingActiveOrPaused,
      canGenerate: result,
    });
    
    return Boolean(result);
  }, [getFullTranscript, recordingStatus]);

  // ========== HELPER FUNCTIONS ==========
  
  /**
   * Generate unique attempt ID
   */
  const generateAttemptId = (): string => {
    return `attempt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  /**
   * Deduplicate questions array
   */
  const deduplicateQuestions = (questions: string[]): string[] => {
    const seen = new Set<string>();
    const unique: string[] = [];
    
    for (const question of questions) {
      const normalized = question.trim().toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(question);
      }
    }
    
    return unique;
  };

  /**
   * Sort questions by priority and confidence
   * High priority/confidence questions appear first
   */
  const sortQuestionsByPriority = (questions: any[]) => {
    return questions.sort((a, b) => {
      // Sort by priority first (high before medium)
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (a.priority !== 'high' && b.priority === 'high') return 1;
      
      // Then by confidence (high before medium)
      if (a.confidence === 'high' && b.confidence !== 'high') return -1;
      if (a.confidence !== 'high' && b.confidence === 'high') return 1;
      
      return 0; // Keep original order if same priority and confidence
    });
  };

  // ========== MAIN ACTIONS ==========

  /**
   * Generate new questions using API
   */
  const generateQuestions = useCallback(
    async (context: QuestionGenerationContext) => {
      if (!canGenerate) {
        const errorMsg = recordingStatus === 'off' 
          ? 'Cannot generate questions: Recording not started'
          : 'Cannot generate questions: No transcript available';
        setError(errorMsg);
        console.error('❌ Generation blocked:', errorMsg);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Fetch case summary (required)
        console.log('📥 Step 1/3: Fetching case summary...');
        const caseSummary = await questionService.getCaseSummary(context.caseId);
        
        // Step 2: Fetch victim testimony (optional - may return null)
        console.log('📥 Step 2/3: Fetching victim testimony...');
        const victimTestimony = await questionService.getVictimTestimony(
          context.caseId, 
          context.sessionId
        );
        
        // Step 3: Generate questions with complete context
        console.log('🤖 Step 3/3: Generating questions with AI...');
        const completeContext: QuestionGenerationContext = {
          ...context,
          caseSummary,
          victimTestimony: victimTestimony || undefined,
        };

        console.log('🔍 [QuestionContext] Complete context being sent to service:', {
          caseId: completeContext.caseId,
          sessionId: completeContext.sessionId,
          personType: completeContext.personType,
          language: completeContext.language,
          questionCount: completeContext.questionCount,
          hasCaseSummary: !!completeContext.caseSummary,
          hasVictimTestimony: !!completeContext.victimTestimony,
          transcriptLength: completeContext.currentTranscript.length,
        });

        const generatedQuestions = await questionService.generateQuestions(completeContext);

        // Create new attempt with sorted questions
        const newAttempt: QuestionAttempt = {
          attemptId: generateAttemptId(),
          questions: sortQuestionsByPriority(generatedQuestions),
          language: context.language,
          timestamp: new Date().toISOString(),
          isConfirmed: false,
          transcriptSnapshot: context.currentTranscript,
          rejectedQuestions: [],
          retryCount: 0,
        };

        setAttempts(prev => [...prev, newAttempt]);
        setCurrentAttemptIndex(attempts.length);
        setSelectedQuestionIds([]);

        console.log('✅ Generated questions successfully', {
          attemptId: newAttempt.attemptId,
          questionCount: generatedQuestions.length,
          language: context.language,
          hasCaseSummary: !!caseSummary,
          hasVictimTestimony: !!victimTestimony,
          transcriptLength: context.currentTranscript.length,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate questions';
        setError(errorMessage);
        console.error('❌ Error generating questions:', errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [attempts.length, canGenerate, recordingStatus]
  );

  /**
   * Confirm current attempt and save to S3
   */
  const confirmAttempt = useCallback(async () => {
    if (!currentAttempt) {
      console.warn('⚠️ No current attempt to confirm');
      return;
    }

    if (selectedQuestionIds.length > 0) {
      console.error('❌ DESIGN VIOLATION: Cannot confirm with active selections');
      setError('Cannot confirm with selections. Please use "Retry Selected" instead.');
      return;
    }

    // Mark all questions as confirmed
    const updatedQuestions = currentAttempt.questions.map(q => ({
      ...q,
      status: 'confirmed' as const,
    }));

    const confirmedAttempt: QuestionAttempt = {
      ...currentAttempt,
      questions: updatedQuestions,
      isConfirmed: true,
    };

    // Update local state immediately
    setAttempts(prev => prev.map(a => 
      a.attemptId === currentAttempt.attemptId ? confirmedAttempt : a
    ));

    const confirmedCount = updatedQuestions.filter(q => q.status === 'confirmed').length;
    setMetrics(prev => ({
      confirmedCount: prev.confirmedCount + confirmedCount,
      rejectedCount: prev.rejectedCount,
      retryCount: prev.retryCount,
    }));

    setSelectedQuestionIds([]);

    console.log('✅ Attempt confirmed locally', {
      attemptId: confirmedAttempt.attemptId,
      confirmedQuestions: confirmedCount,
      totalSessionConfirmed: metrics.confirmedCount + confirmedCount,
    });

    // Save to S3 (non-blocking)
    if (!currentSession) {
      console.warn('⚠️ No current session available for saving');
      return;
    }

    try {
      console.log('💾 Saving confirmed attempt to S3...');
      
      const saveRequest: SaveQuestionsRequest = {
        caseId: currentSession.caseId,
        sessionId: currentSession.sessionId,
        attempts: [confirmedAttempt],
        metadata: {
          investigator: currentSession.investigator || 'Unknown',
          personType: currentPersonType as "witness" | "accused" | "victim",
          personName: currentPersonName || 'Unknown',
          sessionDate: new Date().toISOString(),
          savedAt: new Date().toISOString(),
        }
      };

      const result = await questionService.saveQuestions(saveRequest);

      if (result.success) {
        console.log('✅ Questions saved to S3 successfully:', {
          s3Path: result.s3Path,
          savedAttempts: result.savedAttempts,
        });
      } else {
        console.error('❌ Failed to save questions to S3:', result.error);
      }
    } catch (err) {
      console.error('❌ Error saving to S3:', err);
    }
}, [currentAttempt, selectedQuestionIds, metrics, currentSession, currentPersonName, currentPersonType]);

  /**
   * Retry with selection - WITH PROGRESSIVE TEMPERATURE
   */
  const retryWithSelection = useCallback(
  async (context: QuestionGenerationContext) => {
    if (!currentAttempt) {
      console.warn('⚠️ No current attempt to retry');
      return;
    }

    if (!canGenerate) {
      const errorMsg = recordingStatus === 'off' 
        ? 'Cannot retry: Recording not started'
        : 'Cannot retry: No transcript available';
      setError(errorMsg);
      console.error('❌ Retry blocked:', errorMsg);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nothingSelected = selectedQuestionIds.length === 0;

      const rejectedQuestions = nothingSelected
        ? currentAttempt.questions.map(q => ({ ...q, status: 'rejected' as const }))
        : currentAttempt.questions
            .filter(q => selectedQuestionIds.includes(q.id))
            .map(q => ({ ...q, status: 'rejected' as const }));

      const keptQuestions = nothingSelected
        ? []
        : currentAttempt.questions.filter(q => !selectedQuestionIds.includes(q.id));

      const questionsToGenerate = rejectedQuestions.length;

      // Progressive temperature calculation
      const currentRetryCount = currentAttempt.retryCount || 0;
      const newRetryCount = currentRetryCount + 1;
      
      const baseTemperature = 0.7;
      const temperatureIncrement = 0.05;
      const maxTemperature = 0.95;
      
      const calculatedTemperature = Math.min(
        baseTemperature + (temperatureIncrement * newRetryCount),
        maxTemperature
      );

      console.log('🌡️ Temperature calculation:', {
        retryNumber: newRetryCount,
        temperature: calculatedTemperature,
        formula: `${baseTemperature} + (${temperatureIncrement} × ${newRetryCount}) = ${calculatedTemperature}`,
        cappedAt: calculatedTemperature >= maxTemperature ? 'MAX (0.95)' : 'No',
      });

      console.log('↻ Retry Details:', {
        mode: nothingSelected ? 'Retry All' : `Retry Selected (${selectedQuestionIds.length})`,
        keptCount: keptQuestions.length,
        rejectedCount: rejectedQuestions.length,
        willGenerate: questionsToGenerate,
        retryAttempt: newRetryCount,
        temperature: calculatedTemperature,
      });

      setMetrics(prev => ({
        ...prev,
        rejectedCount: prev.rejectedCount + rejectedQuestions.length,
        retryCount: prev.retryCount + 1,
      }));

      console.log('📥 Fetching context for retry...');
      const caseSummary = await questionService.getCaseSummary(context.caseId);
      
      const victimTestimony = await questionService.getVictimTestimony(
        context.caseId, 
        context.sessionId
      );

      // Deduplicate previous questions
      const allPreviousQuestions = [
        ...keptQuestions.map(q => q.text),
        ...rejectedQuestions.map(q => q.text),
        ...(context.previousQuestions || []),
      ];

      const uniquePreviousQuestions = deduplicateQuestions(allPreviousQuestions);

      console.log('🔍 Previous questions for retry:', {
        total: allPreviousQuestions.length,
        unique: uniquePreviousQuestions.length,
        duplicatesRemoved: allPreviousQuestions.length - uniquePreviousQuestions.length,
      });

      const retryContext: QuestionGenerationContext = {
        caseId: context.caseId,
        sessionId: context.sessionId,
        personType: context.personType,
        caseSummary,
        victimTestimony: victimTestimony || undefined,
        currentTranscript: currentAttempt.transcriptSnapshot,
        language: context.language,
        questionCount: questionsToGenerate,
        previousQuestions: uniquePreviousQuestions,
        temperature: calculatedTemperature,
      };

      console.log('🔄 Retry context prepared:', {
        questionCount: retryContext.questionCount,
        transcriptLength: retryContext.currentTranscript.length,
        previousQuestionsCount: retryContext.previousQuestions?.length || 0,
        temperature: retryContext.temperature,
        retryAttempt: newRetryCount,
      });

      const newQuestions = await questionService.generateQuestions(retryContext);
      
      // ✅ FIX: Filter out duplicates before merging
      const uniqueNewQuestions = newQuestions.filter(newQ => {
        // Check if this question text already exists in keptQuestions
        return !keptQuestions.some(keptQ => keptQ.text.trim() === newQ.text.trim());
      });

      if (uniqueNewQuestions.length < newQuestions.length) {
        const filteredCount = newQuestions.length - uniqueNewQuestions.length;
        console.warn(`⚠️ Filtered ${filteredCount} duplicate(s) from API response in retry`);
        console.warn('Duplicates found:', 
          newQuestions
            .filter(newQ => keptQuestions.some(keptQ => keptQ.text.trim() === newQ.text.trim()))
            .map(q => q.text)
        );
      }

      // ✅ Merge and SORT only unique questions
      const mergedQuestions = sortQuestionsByPriority([...keptQuestions, ...uniqueNewQuestions]);

      const updatedAttempt: QuestionAttempt = {
        ...currentAttempt,
        questions: mergedQuestions,
        rejectedQuestions: [
          ...(currentAttempt.rejectedQuestions || []),
          ...rejectedQuestions,
        ],
        retryCount: newRetryCount,
      };

      setAttempts(prev => prev.map(a => 
        a.attemptId === currentAttempt.attemptId ? updatedAttempt : a
      ));

      setSelectedQuestionIds([]);

      console.log('✅ Retry completed successfully', {
        attemptId: updatedAttempt.attemptId,
        keptQuestions: keptQuestions.length,
        newQuestions: newQuestions.length,
        uniqueNewQuestions: uniqueNewQuestions.length,
        duplicatesFiltered: newQuestions.length - uniqueNewQuestions.length,
        totalQuestions: mergedQuestions.length,
        usedTemperature: calculatedTemperature,
        totalRetriesForThisAttempt: newRetryCount,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry generation';
      setError(errorMessage);
      console.error('❌ Error during retry:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  },
  [currentAttempt, selectedQuestionIds, canGenerate, recordingStatus]
);

  /**
   * Navigate to specific attempt
   */
  const navigateToAttempt = useCallback(
  (index: number) => {
    if (index >= 0 && index < attempts.length) {
      console.log('🔄 Clearing state before navigation...');
      
      // Clear state first
      setCurrentAttemptIndex(-1);
      setSelectedQuestionIds([]);
      
      // Navigate in next tick to ensure clean state
      setTimeout(() => {
        setCurrentAttemptIndex(index);
        
        const attempt = attempts[index];
        
        console.log('📍 Navigated to attempt:', {
          index: index + 1,
          total: attempts.length,
          attemptId: attempt.attemptId,
          questionCount: attempt.questions.length,
          language: attempt.language,
          isConfirmed: attempt.isConfirmed,
        });
        
        // Only set selections for non-confirmed attempts
        if (!attempt.isConfirmed) {
          const selectedIds = attempt.questions
            .filter(q => q.status === 'confirmed')
            .map(q => q.id);
          
          if (selectedIds.length > 0) {
            setSelectedQuestionIds(selectedIds);
          }
        }
      }, 0);
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
      
      console.log(isSelected ? '❌ Deselected question' : '✅ Selected question', {
        questionId,
        totalSelected: newSelection.length,
      });
      
      return newSelection;
    });
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

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
    console.log('🔄 Session reset');
  }, []);

  // ========== ✨ NEW: HTML GENERATION FUNCTION ==========
  
  const generateFinalHTMLReport = async (
    caseId: string,
    sessionId: string,
    metadata: {
      investigator: string;
      personType: string;
      personName: string;
      sessionDate: string;
    }
  ) => {
    try {
      console.log('🎨 [QuestionContext] Generating final HTML report...');

      // Use the questionService to call the correct API
      const response = await questionService.saveQuestions({
        caseId,
        sessionId,
        attempts: [], // Empty - all attempts already saved
        isFinalSave: true, // ← Triggers HTML generation
        metadata: {
          investigator: metadata.investigator,
          personType: metadata.personType as "witness" | "accused" | "victim",
          personName: metadata.personName,
          sessionDate: metadata.sessionDate,
          savedAt: new Date().toISOString(),
        }
      });

      if (response.success) {
        console.log('✅ HTML report generated successfully:', response);
        return { success: true, data: response };
      } else {
        console.warn('⚠️ HTML generation failed:', response.error);
        return { success: false, error: response.error || 'Failed to generate report' };
      }
      
    } catch (error) {
      console.warn('⚠️ HTML generation error:', error);
      return { success: false, error };
    }
  };

  // ========== CONTEXT VALUE ==========
  const value: QuestionContextType = {
    attempts,
    currentAttemptIndex,
    currentAttempt,
    selectedQuestionIds,
    metrics,
    isLoading,
    error,
    canGenerate,
    generateQuestions,
    confirmAttempt,
    retryWithSelection,
    navigateToAttempt,
    selectQuestion,
    clearError,
    resetSession,
    generateFinalHTMLReport,
  };

  return (
    <QuestionContext.Provider value={value}>
      {children}
    </QuestionContext.Provider>
  );
};

export { QuestionContext };