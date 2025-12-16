import { 
  QuestionGenerationContext, 
  Question, 
  SaveQuestionsRequest, 
  SaveQuestionsResponse,
  EvaluateQuestionRequest,
  EvaluateQuestionResponse
} from '../../types/aiQuestionsRT';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://yphcka81y6.execute-api.us-east-1.amazonaws.com/prod';

/**
 * API Service for AI Question Generation
 * Handles all backend communication for Requirements 1 & 2
 */
class QuestionService {
  /**
   * Fetch case summary from S3
   * Endpoint 1: GET /cases/{caseId}/police-summary
   */
  async getCaseSummary(caseId: string): Promise<string> {
    try {
      const response = await fetch(`${API_BASE_URL}/cases/${caseId}/police-summary`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Case summary not found. Please ensure police documents have been processed.');
        }
        throw new Error(`Failed to fetch case summary: ${response.statusText}`);
      }

      const data = await response.json();
      return data.caseSummary;
    } catch (error) {
      console.error('❌ Error fetching case summary:', error);
      throw error;
    }
  }

  /**
 * Fetch victim testimony from S3
 * Endpoint 2: GET /cases/{caseId}/victim-testimony?sessionId={sessionId}
 * 
 * Returns previous victim testimonies (excluding current session if current person is also a victim)
 */
async getVictimTestimony(caseId: string, sessionId: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/cases/${caseId}/victim-testimony?sessionId=${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status !== 404) {
        throw new Error(`Failed to fetch victim testimony: ${response.statusText}`);
      }
      console.log('ℹ️ No previous victim testimony found (expected for first victim or non-victim questioning)');
      return null;
    }

    const data = await response.json();
    return data.victimTestimony;
  } catch (error) {
    console.error('❌ Error fetching victim testimony:', error);
    return null;
  }
}

  /**
   * Generate AI questions using Bedrock
   * Endpoint 3: POST /questions/generate
   */
  async generateQuestions(context: QuestionGenerationContext): Promise<Question[]> {
    try {
      console.log('🔍 [questionService] Received context:', {
        personType: context.personType,
        caseId: context.caseId,
        sessionId: context.sessionId,
        temperature: context.temperature,
      });
    
      // Map frontend language format to backend format
      const language = context.language === 'ar' ? 'Arabic' : 'English';
      
      const requestBody = {
        caseId: context.caseId,
        sessionId: context.sessionId,
        personType: context.personType,
        caseSummary: context.caseSummary,
        victimTestimony: context.victimTestimony || null,
        currentTranscript: context.currentTranscript,
        language: language,
        questionCount: context.questionCount,
        previousQuestions: context.previousQuestions || [],
        temperature: context.temperature || 0.7,
      };

      console.log('📤 Sending question generation request:', {
        caseId: requestBody.caseId,
        sessionId: requestBody.sessionId,
        personType: requestBody.personType,
        language: requestBody.language,
        questionCount: requestBody.questionCount,
        hasCaseSummary: !!requestBody.caseSummary,
        hasVictimTestimony: !!requestBody.victimTestimony,
        transcriptLength: requestBody.currentTranscript.length,
        previousQuestionsCount: requestBody.previousQuestions.length,
        temperature: requestBody.temperature,
      });

      const response = await fetch(`${API_BASE_URL}/questions/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Failed to generate questions: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Question generation failed');
      }

      // Map backend response to frontend Question type
      const questions: Question[] = data.questions.map((q: any) => ({
        id: q.id,
        text: q.text,
        category: q.category,
        status: 'pending' as const,
        reasoning: q.reasoning,
        sourceContext: q.sourceContext,
        confidence: q.confidence,     
        priority: q.priority,          
        generatedAt: new Date().toISOString(),
      }));

      console.log('✅ Generated questions successfully:', {
        count: questions.length,
        categories: questions.map(q => q.category),
        usedTemperature: requestBody.temperature,
      });

      return questions;
    } catch (error) {
      console.error('❌ Error generating questions:', error);
      throw error;
    }
  }

  /**
   * Save confirmed questions to S3
   * Endpoint 4: POST /ai-questions/save
   * Non-blocking operation - errors logged but not shown to user
   */
  async saveQuestions(request: SaveQuestionsRequest): Promise<SaveQuestionsResponse> {
    try {
      console.log('💾 Saving questions to S3:', {
        caseId: request.caseId,
        sessionId: request.sessionId,
        attemptsCount: request.attempts.length,
        totalQuestions: request.attempts.reduce((sum, attempt) => sum + attempt.questions.length, 0),
        metadata: request.metadata,
      });

      const response = await fetch(`${API_BASE_URL}/ai-questions/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: response.statusText 
        }));
        
        console.error('❌ S3 save failed (non-blocking):', {
          status: response.status,
          error: errorData.error,
          caseId: request.caseId,
          sessionId: request.sessionId,
        });

        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const result: SaveQuestionsResponse = await response.json();
      
      console.log('✅ Questions saved to S3 successfully:', {
        s3Path: result.s3Path,
        savedAttempts: result.savedAttempts,
        savedAt: result.success ? new Date().toISOString() : 'N/A',
      });
      
      return result;

    } catch (error) {
      console.error('❌ Unexpected error saving to S3 (non-blocking):', {
        error: error instanceof Error ? error.message : 'Unknown error',
        caseId: request.caseId,
        sessionId: request.sessionId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
  /**
   * Evaluate manually entered question
   * Endpoint 5: POST /questions/evaluate
   */
  async evaluateQuestion(request: EvaluateQuestionRequest): Promise<EvaluateQuestionResponse> {
    try {
      console.log('🔍 Evaluating manual question:', {
        questionLength: request.question.length,
        caseId: request.caseId,
      });

      const response = await fetch(`${API_BASE_URL}/questions/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: response.statusText 
        }));
        throw new Error(errorData.error || `Failed to evaluate question: ${response.statusText}`);
      }

      const data: EvaluateQuestionResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Question evaluation failed');
      }

      console.log('✅ Question evaluated successfully:', {
        overallScore: data.evaluation?.overallScore,
        category: data.evaluation?.category,
      });

      return data;
    } catch (error) {
      console.error('❌ Error evaluating question:', error);
      throw error;
    }
  }
}



const questionService = new QuestionService();
export default questionService;