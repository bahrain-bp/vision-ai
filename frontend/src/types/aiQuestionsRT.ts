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
  | 'motivation'   // Exploring intent or reasoning
  | 'contradiction' ; // discovering contradictions

/**
 * Status of a question (confirmed by investigator or rejected)
 */
export type QuestionStatus = 'confirmed' | 'rejected' | 'pending';

/**
 * Language options for question generation
 */
export type Language = 'ar' | 'en';

/**
 * A single AI-generated question
 */
export interface Question {
  id: string;
  text: string;
  category: QuestionCategory;
  status: QuestionStatus;
  reasoning?: string;
  sourceContext?: string;
  generatedAt: string;
  confidence?: 'high' | 'medium';
  priority?: 'high' | 'medium'; 
}

/**
 * A generation attempt containing multiple questions
 */
export interface QuestionAttempt {
  attemptId: string;
  questions: Question[];
  language: Language;
  timestamp: string;
  isConfirmed: boolean;
  transcriptSnapshot: string;
  rejectedQuestions?: Question[];
  caseSummary?: string;
  victimTestimony?: string;
  retryCount?: number;  //  ADDED: Track number of retries for this attempt
}

/**
 * Context data needed to generate questions
 */
export interface QuestionGenerationContext {
  caseId: string;
  sessionId: string;
  personType: "witness" | "accused" | "victim";
  caseSummary: string;
  currentTranscript: string;
  victimTestimony?: string;
  language: Language;
  questionCount: number;
  previousQuestions?: string[];  // Deduplicated array of question texts
  temperature?: number;  // ✅ ADDED: Optional temperature override (0.0-1.0)
}

/**
 * Helper interface for building context from existing contexts
 */
export interface QuestionGenerationContextBuilder {
  case: Case | null;
  session: Session | null;
  fullTranscript: string;
  caseSummary: string;
  victimTestimony?: string;
  investigatorLanguage: Language;
  questionCount: number;
  existingQuestions: Question[];
}

/**
 * Response from the question generation API
 */
export interface QuestionGenerationResponse {
  success: boolean;
  attempt?: QuestionAttempt;
  error?: string;
}

/**
 * Metrics for tracking question generation usage
 */
export interface QuestionMetrics {
  confirmedCount: number;
  rejectedCount: number;
  retryCount: number;
}

/**
 * Props for the main AI Question Panel component
 */
export interface AIQuestionPanelProps {
  caseId: string;
  sessionId: string;
  language: Language;
  onQuestionsConfirmed?: (attempt: QuestionAttempt) => void;
  className?: string;
}

/**
 * Props for Question Card component
 */
export interface QuestionCardProps {
  question: Question;
  isSelected: boolean;
  onSelect: (questionId: string) => void;
  onFlip?: (questionId: string) => void;
  isFlipped?: boolean;
  disabled?: boolean;
}

/**
 * Props for Question List component
 */
export interface QuestionListProps {
  attempt: QuestionAttempt;
  selectedQuestionIds: string[];
  onQuestionSelect: (questionId: string) => void;
  onConfirm: () => void;
  onRetry: () => void;
}

/**
 * Props for Metrics Widget component
 */
export interface MetricsWidgetProps {
  metrics: QuestionMetrics;
  className?: string;
}

/**
 * Props for Question Generator Controls component
 */
export interface QuestionGeneratorControlsProps {
  onGenerate: (questionCount: number, language: Language) => void;
  isLoading: boolean;
  disabled?: boolean;
}

/**
 * Props for Attempt Navigation component
 */
export interface AttemptNavigationProps {
  currentIndex: number;
  totalAttempts: number;
  onNavigate: (index: number) => void;
  disabled?: boolean;
}

/**
 * Request to save questions to S3
 */
export interface SaveQuestionsRequest {
  caseId: string;
  sessionId: string;
  attempts: QuestionAttempt[];
  isFinalSave?: boolean; // ✨ Triggers HTML generation when true
  metadata?: {
    investigator?: string;
    personType?: "witness" | "accused" | "victim";
    personName?: string;
    sessionDate?: string;
    savedAt?: string;
  };
}

/**
 * Response from saving questions to S3
 */
export interface SaveQuestionsResponse {
  success: boolean;
  s3Path?: string;
  savedAttempts?: number;
  error?: string;
}

export interface QuestionEvaluation {
  clarity: number;          // 0-100
  relevance: number;        // 0-100
  appropriateness: number;  // 0-100
  category: QuestionCategory;  // Reuse existing type
  issues: string[];
  suggestions: string[];
  improvedVersion?: string;
  overallScore: number;
}

export interface EvaluateQuestionRequest {
  question: string;
  caseId: string;
  sessionId: string;
  personType: 'witness' | 'accused' | 'victim';
  caseSummary: string;
  currentTranscript: string;
}

export interface EvaluateQuestionResponse {
  success: boolean;
  evaluation?: QuestionEvaluation;
  error?: string;
}