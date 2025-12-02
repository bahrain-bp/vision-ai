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
    generateQuestions,
    confirmAttempt,
    retryWithSelection,
    navigateToAttempt,
    selectQuestion,
  } = useQuestionContext();

  // Case Context - Session data only
  const { currentSession } = useCaseContext();

  // Transcription Context - Live transcript
  const { recordingStatus, getFullTranscript } = useTranscription();

  // ========== PREREQUISITES CHECK ==========
  
  const isRecording = recordingStatus === 'on';
  const hasSession = !!currentSession;
  const canGenerate = isRecording && hasSession;

  // ========== GENERATION HANDLER ==========
  
  const handleGenerate = async (questionCount: number, language: Language) => {
    if (!canGenerate) {
      console.warn('⚠️ Prerequisites not met for generation');
      return;
    }

    // Build context from available data
    const context: QuestionGenerationContext = {
      caseId: currentSession!.caseId,
      sessionId: currentSession!.sessionId,
      personType: currentSession!.personType,
      
      // TODO: Fetch actual case summary from backend/S3
      caseSummary: 'Placeholder: Case summary will be fetched from case documents',
      
      // Get live transcript
      currentTranscript: getFullTranscript,
      
      // TODO: Fetch victim testimony if available
      victimTestimony: undefined,
      
      // From UI selections
      language,
      questionCount,
      
      // For duplicate prevention
      previousQuestions: attempts.flatMap(a => a.questions),
    };

    // Call context action
    await generateQuestions(context);
  };

  // ========== RETRY HANDLER ==========
  
  const handleRetry = async () => {
    if (!currentAttempt || !canGenerate) return;

    // Build context (same as generate)
    const context: QuestionGenerationContext = {
      caseId: currentSession!.caseId,
      sessionId: currentSession!.sessionId,
      personType: currentSession!.personType,
      caseSummary: 'Placeholder: Case summary will be fetched from case documents',
      currentTranscript: getFullTranscript,
      victimTestimony: undefined,
      language: currentAttempt.language,
      questionCount: currentAttempt.questions.length,
      previousQuestions: attempts.flatMap(a => a.questions),
    };

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