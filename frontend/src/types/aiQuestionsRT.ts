// Type definitions for AI Question Generation feature

// ============================================
// IMPORTS FROM EXISTING CONTEXTS
// ============================================
import { Case, Session } from '../services/caseService';


/**
 * Category types for classifying questions
 */
export type QuestionCategory = 
  | 'clarification'  // Seeking additional details or explanation
  | 'verification'   // Confirming facts or statements
  | 'timeline'       // Establishing chronological order of events
  | 'motivation';    // Exploring intent or reasoning

/**
 * Status of a question (confirmed by investigator or rejected)
 */
export type QuestionStatus = 'confirmed' | 'rejected' | 'pending'; // When first generated all questions will be in pending state

/**
 * Language options for question generation
 */
export type Language = 'ar' | 'en';

/**
 * A single AI-generated question
 */
export interface Question {
  id: string;                          // Unique identifier for the question
  text: string;                        // The actual question text
  category: QuestionCategory;          // Classification of question type
  status: QuestionStatus;              // Whether it's confirmed, rejected, or pending
  reasoning?: string;                  // AI's explanation of why this question was generated
  sourceContext?: string;              // What part of testimony informed this question
  generatedAt: string;                 // ISO timestamp of when it was generated
}

/**
 * A generation attempt containing multiple questions
 */
export interface QuestionAttempt {
  attemptId: string;                   // Unique identifier for this attempt
  questions: Question[];               // Array of questions in this attempt
  language: Language;                  // Language questions were generated in
  timestamp: string;                   // ISO timestamp of attempt
  isConfirmed: boolean;                // Whether investigator confirmed this attempt
}

/**
 * Context data needed to generate questions
 */
export interface QuestionGenerationContext {
  caseId: string;                      // From currentCase.caseId
  sessionId: string;                   // From currentSession.sessionId 
  personType: "witness" | "accused" | "victim";    // From currentSession.personType
  caseSummary: string;                 // Case background from police documents
  currentTranscript: string;           // From getFullTranscript
  victimTestimony?: string;            // Optional: victim's testimony if available
  language: Language;                  // Investigator's preferred language
  questionCount: number;               // How many questions to generate (ISN'T questionCount ENOUGH ?? )
  previousQuestions?: Question[];      // For duplicate prevention
}

/**
 * Helper interface for building context from existing contexts
 */

export interface QuestionGenerationContextBuilder {
  case: Case | null;                   // From currentCase
  session: Session | null;             // From currentSession
  fullTranscript: string;              // From  getFullTranscript
  caseSummary: string;                 // Fetch from backend/S3
  victimTestimony?: string;            // Fetch from backend/S3 if available
  investigatorLanguage: Language;      // From UI selection
  requestedQuestionCount: number;      // From UI selection
  existingQuestions: Question[];       // From my context state
}


/**
 * Response from the question generation API
 */
export interface QuestionGenerationResponse {
  success: boolean;                    // Whether generation succeeded
  attempt?: QuestionAttempt;           // The generated attempt (if successful)
  error?: string;                      // Error message (if failed)
}

/**
 * Metrics for tracking question generation usage
 */
export interface QuestionMetrics {
  confirmedCount: number;              // Total confirmed questions in session
  rejectedCount: number;               // Total rejected questions in session
  retryCount: number;                  // Number of retry attempts made
}

/**
 * Props for Question Card component
 */
export interface QuestionCardProps {
  question: Question;                  // The question to display
  isSelected: boolean;                 // Whether this question is selected
  onSelect: (questionId: string) => void;      // Handler for selection
  onFlip?: (questionId: string) => void;       // Handler for flip animation
  isFlipped?: boolean;                         // Whether card is currently flipped
}

/**
 * Props for Question List component
 */
export interface QuestionListProps {
  attempt: QuestionAttempt;            // Current attempt to display
  selectedQuestionIds: string[];       // IDs of selected questions
  onQuestionSelect: (questionId: string) => void;  // Selection handler
  onConfirm: () => void;               // Confirm button handler
  onRetry: () => void;                 // Retry button handler
}