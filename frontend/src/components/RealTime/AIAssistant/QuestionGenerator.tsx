// src/components/RealTime/AIAssistant/QuestionGenerator.tsx
import React from 'react';
import { Sparkles } from 'lucide-react';
import { useQuestionContext } from '../../../hooks/useQuestionContext';
import { useCaseContext } from '../../../hooks/useCaseContext';
import { useTranscription } from '../../../hooks/useTranscription';
import { Language, QuestionGenerationContext } from '../../../types/aiQuestionsRT';
import GeneratorControls from './GeneratorControls';
import MetricsWidget from './MetricsWidget';
import AttemptNavigation from './AttemptNavigation';
import QuestionList from './QuestionList';

/**
 * QuestionGenerator Component
 * 
 * Main orchestrator for AI question generation feature.
 * Integrates with multiple contexts and manages the complete lifecycle:
 * - Prerequisites checking (recording status, session existence)
 * - Context building from CaseContext + TranscriptionContext
 * - Question generation via QuestionContext
 * - Progressive UI disclosure (components appear after generation)
 * - Deduplication of previous questions
 * 
 * No props needed - gets everything from contexts
 */
const QuestionGenerator: React.FC = () => {
  // ========== CONTEXT INTEGRATION ==========
  
  // Question Context - Main state management
  const {
    attempts,
    currentAttempt,
    selectedQuestionIds,
    metrics,
    isLoading,
    error,
    clearError,
    generateQuestions,
    confirmAttempt,
    retryWithSelection,
    navigateToAttempt,
    selectQuestion,
  } = useQuestionContext();

  // Case Context - Session data only
  const { 
    currentSession, 
    currentPersonType, 
    currentPersonName 
  } = useCaseContext();

  // Transcription Context - Live transcript
  const { recordingStatus, getFullTranscript } = useTranscription();

  // ========== PREREQUISITES CHECK ==========
  
  const isRecording = recordingStatus === 'on';
  const hasSession = !!currentSession;
  const canGenerate = isRecording && hasSession;

  // ========== HELPER FUNCTIONS ==========
  
  /**
   * Deduplicate questions by removing exact text matches
   * Normalizes to lowercase and trims whitespace for comparison
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

  // ========== GENERATION HANDLER ==========
  
  const handleGenerate = async (questionCount: number, language: Language) => {
    if (!canGenerate) {
      console.warn('⚠️ Prerequisites not met for generation');
      return;
    }

    console.log('🔍 [QuestionGenerator] Building context from currentSession:', {
      caseId: currentSession?.caseId,
      sessionId: currentSession?.sessionId,
      personType: currentPersonType,
      personName: currentPersonName,
      hasSession: !!currentSession,
    });

    // Collect all confirmed questions from all confirmed attempts
    const allPreviousQuestions = attempts
      .filter(a => a.isConfirmed)
      .flatMap(a => 
        a.questions
          .filter(q => q.status === 'confirmed')
          .map(q => q.text)
      );

    // DEDUPLICATE before sending to backend
    const uniquePreviousQuestions = deduplicateQuestions(allPreviousQuestions);

    console.log('🔍 Previous questions analysis:', {
      total: allPreviousQuestions.length,
      unique: uniquePreviousQuestions.length,
      duplicatesRemoved: allPreviousQuestions.length - uniquePreviousQuestions.length,
    });

    // Build context - backend will fetch case summary and victim testimony
    const context: QuestionGenerationContext = {
      caseId: currentSession!.caseId,
      sessionId: currentSession!.sessionId,
      personType: currentPersonType as "witness" | "accused" | "victim",
      
      // These will be fetched by QuestionContext from backend
      caseSummary: '', // Placeholder - will be fetched
      victimTestimony: undefined, // Placeholder - will be fetched if needed
      
      // Get live transcript
      currentTranscript: getFullTranscript,
      
      // From UI selections
      language,
      questionCount,
      
      // ✅ Use deduplicated questions
      previousQuestions: uniquePreviousQuestions,
    };

    console.log('🔍 [QuestionGenerator] Context built:', {
      personType: context.personType,
      previousQuestionsCount: context.previousQuestions?.length || 0,
      confirmedAttemptsCount: attempts.filter(a => a.isConfirmed).length,
      totalAttemptsCount: attempts.length,
    });

    // Call context action (it handles the API calls)
    await generateQuestions(context);
  };

  // ========== RETRY HANDLER ==========
  
  const handleRetry = async () => {
    if (!currentAttempt || !canGenerate) return;

    // Determine if this is "Retry All" or "Retry Selected"
    const isRetryAll = selectedQuestionIds.length === 0;

    console.log('🔄 [QuestionGenerator] Retry type:', {
      isRetryAll,
      selectedCount: selectedQuestionIds.length,
      totalInAttempt: currentAttempt.questions.length,
    });

    // Collect previous questions based on retry type
    let allPreviousQuestions: string[];

    if (isRetryAll) {
      // ✅ RETRY ALL: Include questions from OTHER confirmed attempts 
      // AND questions from the CURRENT attempt (to avoid regenerating same questions)
      allPreviousQuestions = [
        // From other confirmed attempts
        ...attempts
          .filter(a => a.isConfirmed && a.attemptId !== currentAttempt.attemptId)
          .flatMap(a => 
            a.questions
              .filter(q => q.status === 'confirmed')
              .map(q => q.text)
          ),
        // ✅ CRITICAL FIX: Include current attempt's questions too!
        ...currentAttempt.questions.map(q => q.text)
      ];

      console.log('🔄 Retry All - Including current attempt questions to avoid duplicates');
    } else {
      // RETRY SELECTED: Include questions from OTHER confirmed attempts
      // AND unselected questions from CURRENT attempt
      const unselectedQuestions = currentAttempt.questions
        .filter(q => !selectedQuestionIds.includes(q.id))
        .map(q => q.text);

      allPreviousQuestions = [
        // From other confirmed attempts
        ...attempts
          .filter(a => a.isConfirmed && a.attemptId !== currentAttempt.attemptId)
          .flatMap(a => 
            a.questions
              .filter(q => q.status === 'confirmed')
              .map(q => q.text)
          ),
        // Unselected questions from current attempt
        ...unselectedQuestions
      ];

      console.log('🔄 Retry Selected - Including unselected questions:', {
        selectedCount: selectedQuestionIds.length,
        unselectedCount: unselectedQuestions.length,
      });
    }

    // ✅ DEDUPLICATE before sending
    const uniquePreviousQuestions = deduplicateQuestions(allPreviousQuestions);

    console.log('🔍 Previous questions for retry:', {
      retryType: isRetryAll ? 'ALL' : 'SELECTED',
      total: allPreviousQuestions.length,
      unique: uniquePreviousQuestions.length,
      duplicatesRemoved: allPreviousQuestions.length - uniquePreviousQuestions.length,
      currentAttemptId: currentAttempt.attemptId,
    });

    const context: QuestionGenerationContext = {
      caseId: currentSession!.caseId,
      sessionId: currentSession!.sessionId,
      personType: currentPersonType as "witness" | "accused" | "victim",
      caseSummary: '', // Will be fetched
      currentTranscript: getFullTranscript,
      victimTestimony: undefined, // Will be fetched if needed
      language: currentAttempt.language,
      questionCount: isRetryAll ? currentAttempt.questions.length : selectedQuestionIds.length,
      
      // ✅ Use deduplicated questions (including current attempt for "Retry All")
      previousQuestions: uniquePreviousQuestions,
    };

    console.log('🔄 [QuestionGenerator] Retry context built:', {
      questionCount: context.questionCount,
      previousQuestionsCount: context.previousQuestions?.length || 0,
      language: context.language,
    });

    await retryWithSelection(context);
  };

  // ========== UI CONDITIONS ==========
  
  const hasAttempts = attempts.length > 0;
  const showMetrics = hasAttempts;
  const showQuestions = hasAttempts && currentAttempt;

  // ========== RENDER ==========

  return (
    <div className="space-y-3">
      
      {/* ALWAYS VISIBLE: Generator Controls */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <GeneratorControls
          onGenerate={handleGenerate}
          isLoading={isLoading}
          disabled={!canGenerate || (hasAttempts && !currentAttempt?.isConfirmed)}
        />
      </div>

      {/* PREREQUISITES NOT MET: Show Message */}
      {!canGenerate && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Sparkles className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">
            Start recording to generate questions
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Questions will be generated based on live testimony
          </p>
        </div>
      )}

      {/* AFTER GENERATION: Progressive Disclosure */}
      {canGenerate && (
        <>
          {/* Metrics Widget - Shows after first generation */}
          {showMetrics && <MetricsWidget metrics={metrics} />}

          {/* Attempt Navigation - Shows only confirmed attempts */}
          {(() => {
            const confirmedAttempts = attempts.filter(a => a.isConfirmed);
            
            const currentConfirmedIndex = currentAttempt?.isConfirmed 
              ? confirmedAttempts.findIndex(a => a.attemptId === currentAttempt.attemptId)
              : -1;

            // Only show navigation if: 2+ confirmed attempts AND viewing a confirmed attempt
            const shouldShowNavigation = confirmedAttempts.length > 1 && currentConfirmedIndex >= 0;

            return shouldShowNavigation && (
              <AttemptNavigation
                currentIndex={currentConfirmedIndex}
                totalAttempts={confirmedAttempts.length}
                onNavigate={(index) => {
                  const targetAttempt = confirmedAttempts[index];
                  const targetIndex = attempts.findIndex(a => a.attemptId === targetAttempt.attemptId);
                  navigateToAttempt(targetIndex);
                }}
                disabled={isLoading}
              />
            );
          })()}

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-800 mb-1">
                    Cannot Generate Questions
                  </h3>
                  <p className="text-sm text-red-700">
                    {error}
                  </p>
                  {!canGenerate && (
                    <p className="text-xs text-red-600 mt-2">
                      💡 <strong>Tip:</strong> {!isRecording 
                        ? 'Start the recording to begin collecting testimony.' 
                        : 'Wait for the witness to speak so the system can generate relevant questions.'}
                    </p>
                  )}
                </div>
                <button
                  onClick={clearError}
                  className="flex-shrink-0 text-red-500 hover:text-red-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Question List - Shows after generation */}
          {showQuestions ? (
            <>
              {/* Scrollable Question Area */}
              <div className="max-h-[500px] overflow-y-auto border-2 border-gray-200 rounded-lg p-3 bg-white">
                <QuestionList
                  attempt={currentAttempt}
                  selectedQuestionIds={selectedQuestionIds}
                  onQuestionSelect={selectQuestion}
                  onConfirm={confirmAttempt}
                  onRetry={handleRetry}
                />
              </div>

              {/* Rejected Questions Section - Only show for confirmed attempts */}
              {currentAttempt.isConfirmed && (() => {
                const rejectedQuestions = currentAttempt.rejectedQuestions || [];
                
                if (rejectedQuestions.length === 0) return null;

                return (
                  <details className="bg-gray-50 border-2 border-gray-200 rounded-lg">
                    <summary className="cursor-pointer p-3 font-semibold text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-between">
                      <span>🗑️ Rejected Questions ({rejectedQuestions.length})</span>
                      <span className="text-xs text-gray-500">Click to expand</span>
                    </summary>
                    
                    <div className="max-h-[300px] overflow-y-auto p-3 space-y-2">
                      {rejectedQuestions.map((question) => (
                        <div
                          key={question.id}
                          className="bg-white rounded-lg border-l-4 border-red-400 p-3 opacity-60"
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <span className={`
                              text-xs font-semibold px-2 py-1 rounded-full
                              ${question.category === 'clarification' ? 'bg-indigo-100 text-indigo-700' :
                                question.category === 'verification' ? 'bg-purple-100 text-purple-700' :
                                question.category === 'timeline' ? 'bg-amber-100 text-amber-700' :
                                'bg-green-100 text-green-700'}
                            `}>
                              {question.category.charAt(0).toUpperCase() + question.category.slice(1)}
                            </span>
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-semibold">
                              Rejected
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {question.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })()}
            </>
          ) : (
            // Empty state when recording but no questions yet
            <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-gray-200 rounded-lg">
              <Sparkles className="w-10 h-10 text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-600">
                No questions generated yet
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Click "Generate Questions" above to start
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QuestionGenerator;