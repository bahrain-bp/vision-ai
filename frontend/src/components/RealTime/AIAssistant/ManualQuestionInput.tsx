// src/components/RealTime/AIAssistant/ManualQuestionInput.tsx
import React, { useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useCaseContext } from '../../../hooks/useCaseContext';
import type { QuestionEvaluation } from '../../../types/aiQuestionsRT'; 

// ============================================
// 🎯 DEMO TEST QUESTIONS WITH PRE-CALCULATED EVALUATIONS
// ============================================
/**
 * Pre-prepared test questions with known evaluations for reliable demos
 * Based on actual case #94346/2024 details
 * 3 English + 3 Arabic questions
 */
const DEMO_TEST_QUESTIONS = [
  // ========== ENGLISH QUESTIONS ==========
  {
    question: "Can you confirm whether the suspect, Sulaiman bin Abdul Mohsen, refused to pay the restaurant bill on May 24th, 2024?",
    expectedEval: {
      overallScore: 92,
      clarity: 95,
      relevance: 95,
      appropriateness: 85,
      category: "verification" as const,
      issues: [],
      suggestions: [
        "Consider adding specific time reference (00:15 AM) for precision",
        "Could reference the case number #94346/2024 for documentation"
      ],
      improvedVersion: "Can you confirm whether the suspect, Sulaiman bin Abdul Mohsen (ID: 1011710782), refused to pay the restaurant bill at approximately 00:15 AM on May 24th, 2024, as documented in case #94346/2024?"
    }
  },
  {
    question: "What happened at the restaurant",
    expectedEval: {
      overallScore: 35,
      clarity: 25,
      relevance: 40,
      appropriateness: 40,
      category: "clarification" as const,
      issues: [
        "Missing question mark - statement format may confuse the witness",
        "Too vague - lacks specific focus on which aspect of the incident",
        "No time reference - unclear which event or timeframe is being asked about",
        "Missing context - does not reference case details, parties involved, or specific actions"
      ],
      suggestions: [
        "Add proper punctuation with a question mark",
        "Specify exact time, date, and location (Traderfix Restaurant, Ritz-Carlton, May 24, 2024)",
        "Reference specific parties involved (suspect, officers, witness)",
        "Focus on a particular aspect: payment dispute, police arrival, or suspect's behavior",
        "Include case reference number for documentation"
      ],
      improvedVersion: "Can you describe in detail what occurred at Traderfix Restaurant on May 24th, 2024 at approximately 00:15 AM, specifically regarding the payment dispute between the suspect Sulaiman Abdul Mohsen and restaurant management?"
    }
  },
  {
    question: "At what time did Officers Ali Anwar and Shehzad Anjum arrive at the Traderfix Restaurant parking lot in response to your call regarding the payment dispute?",
    expectedEval: {
      overallScore: 95,
      clarity: 95,
      relevance: 100,
      appropriateness: 90,
      category: "timeline" as const,
      issues: [],
      suggestions: [
        "Excellent question - could optionally add case number for formal documentation"
      ],
      improvedVersion: undefined
    }
  },
  
  // ========== ARABIC QUESTIONS ==========
  {
    question: "هل يمكنك تأكيد أن المشتبه به سليمان بن عبدالمحسن رفض دفع فاتورة المطعم في 24 مايو 2024؟",
    expectedEval: {
      overallScore: 92,
      clarity: 95,
      relevance: 95,
      appropriateness: 85,
      category: "verification" as const,
      issues: [],
      suggestions: [
        "يمكن إضافة التوقيت المحدد (الساعة 00:15 صباحاً) للدقة",
        "يمكن الإشارة إلى رقم القضية 94346/2024 للتوثيق"
      ],
      improvedVersion: "هل يمكنك تأكيد أن المشتبه به سليمان بن عبدالمحسن (الرقم: 1011710782) رفض دفع فاتورة المطعم في حوالي الساعة 00:15 صباحاً بتاريخ 24 مايو 2024، كما هو موثق في القضية رقم 94346/2024؟"
    }
  },
  {
    question: "ماذا حدث في المطعم",
    expectedEval: {
      overallScore: 35,
      clarity: 25,
      relevance: 40,
      appropriateness: 40,
      category: "clarification" as const,
      issues: [
        "علامة الاستفهام مفقودة - قد يربك التنسيق الشاهد",
        "غامض جداً - يفتقر إلى تركيز محدد على أي جانب من الحادث",
        "لا توجد إشارة زمنية - غير واضح أي حدث أو إطار زمني يُسأل عنه",
        "يفتقر إلى السياق - لا يشير إلى تفاصيل القضية أو الأطراف المعنية أو الإجراءات المحددة"
      ],
      suggestions: [
        "أضف علامات الترقيم المناسبة مع علامة استفهام",
        "حدد الوقت والتاريخ والموقع بالضبط (مطعم تريدرفكس، فندق الريتز كارلتون، 24 مايو 2024)",
        "اشر إلى الأطراف المحددة المعنية (المشتبه به، الضباط، الشاهد)",
        "ركز على جانب معين: نزاع الدفع، وصول الشرطة، أو سلوك المشتبه به",
        "قم بتضمين رقم القضية للتوثيق"
      ],
      improvedVersion: "هل يمكنك وصف بالتفصيل ما حدث في مطعم تريدرفكس يوم 24 مايو 2024 في حوالي الساعة 00:15 صباحاً، خاصة فيما يتعلق بنزاع الدفع بين المشتبه به سليمان عبدالمحسن وإدارة المطعم؟"
    }
  },
  {
    question: "في أي وقت وصل العريف علي أنور ورئيس العرفاء شهزاد أنجم إلى موقف سيارات مطعم تريدرفكس رداً على اتصالك بخصوص نزاع الدفع؟",
    expectedEval: {
      overallScore: 95,
      clarity: 95,
      relevance: 100,
      appropriateness: 90,
      category: "timeline" as const,
      issues: [],
      suggestions: [
        "سؤال ممتاز - يمكن إضافة رقم القضية للتوثيق الرسمي بشكل اختياري"
      ],
      improvedVersion: undefined
    }
  }
];
// ============================================
// 🎭 MOCK EVALUATION DATA GENERATOR
// ============================================
/**
 * Generate realistic mock evaluation based on question quality indicators
 * Used for questions that are NOT in the pre-prepared demo list
 */
const generateMockEvaluation = (question: string, language: 'en' | 'ar'): QuestionEvaluation => {
  const lowerQuestion = question.toLowerCase();
  
  // Quality indicators
  const hasQuestionMark = question.includes('?') || question.includes('؟');
  const isShort = question.length < 20;
  const isVeryLong = question.length > 300;
  const hasMultipleQuestions = (question.match(/\?/g) || []).length > 1 || (question.match(/؟/g) || []).length > 1;
  const isVague = /what|how|why|tell me|explain|describe|ماذا|كيف|لماذا|أخبرني|اشرح|صف/i.test(lowerQuestion) && question.split(' ').length < 8;
  const isLeading = /don't you think|isn't it true|wouldn't you say|ألا تعتقد|أليس صحيحاً|ألا توافق/i.test(lowerQuestion);
  const hasLegalTerms = /incident|testimony|statement|witness|alleged|case|officer|suspect|حادث|شهادة|بيان|شاهد|مزعوم|قضية|ضابط|مشتبه/i.test(lowerQuestion);
  
  // Calculate scores
  let clarity = 85;
  let relevance = 80;
  let appropriateness = 90;
  
  // Adjust clarity
  if (!hasQuestionMark) clarity -= 20;
  if (isShort) clarity -= 15;
  if (isVeryLong) clarity -= 10;
  if (hasMultipleQuestions) clarity -= 25;
  if (isVague) clarity -= 20;
  
  // Adjust relevance
  if (hasLegalTerms) relevance += 10;
  if (isVague) relevance -= 25;
  if (isShort && !hasLegalTerms) relevance -= 15;
  
  // Adjust appropriateness
  if (isLeading) appropriateness -= 30;
  if (hasMultipleQuestions) appropriateness -= 15;
  
  // Clamp scores to 0-100
  clarity = Math.max(0, Math.min(100, clarity));
  relevance = Math.max(0, Math.min(100, relevance));
  appropriateness = Math.max(0, Math.min(100, appropriateness));
  
  // Calculate overall score
  const overallScore = Math.round((clarity + relevance + appropriateness) / 3);
  
  // Determine category based on content
  let category: 'clarification' | 'verification' | 'contradiction' | 'timeline' | 'motivation' = 'clarification';
  
  if (/when|time|date|متى|وقت|تاريخ/i.test(lowerQuestion)) {
    category = 'timeline';
  } else if (/confirm|verify|true|correct|تأكيد|تحقق|صحيح/i.test(lowerQuestion)) {
    category = 'verification';
  } else if (/why|reason|motive|لماذا|سبب|دافع/i.test(lowerQuestion)) {
    category = 'motivation';
  } else if (/but|however|earlier said|previously|لكن|ومع ذلك|سابقاً|قلت سابقاً/i.test(lowerQuestion)) {
    category = 'contradiction';
  }
  
  // Generate issues
  const issues: string[] = [];
  if (!hasQuestionMark) {
    issues.push(language === 'en' 
      ? 'Missing question mark - statement format may confuse the witness'
      : 'علامة الاستفهام مفقودة - قد يربك التنسيق الشاهد'
    );
  }
  if (hasMultipleQuestions) {
    issues.push(language === 'en'
      ? 'Contains multiple questions - should be split into separate questions'
      : 'يحتوي على أسئلة متعددة - يجب تقسيمها إلى أسئلة منفصلة'
    );
  }
  if (isLeading) {
    issues.push(language === 'en'
      ? 'Leading question - suggests a desired answer'
      : 'سؤال إيحائي - يوحي بإجابة مرغوبة'
    );
  }
  if (isVague) {
    issues.push(language === 'en'
      ? 'Too vague - needs more specific focus'
      : 'غامض جداً - يحتاج إلى تركيز أكثر تحديداً'
    );
  }
  if (isShort && !hasLegalTerms) {
    issues.push(language === 'en'
      ? 'Lacks context - should reference case details'
      : 'يفتقر إلى السياق - يجب الإشارة إلى تفاصيل القضية'
    );
  }
  
  // Generate suggestions
  const suggestions: string[] = [];
  if (!hasQuestionMark) {
    suggestions.push(language === 'en'
      ? 'Rephrase as a direct question with proper punctuation'
      : 'أعد صياغته كسؤال مباشر مع علامات ترقيم مناسبة'
    );
  }
  if (isVague) {
    suggestions.push(language === 'en'
      ? 'Add specific details about time, place, or circumstances from case #94346/2024'
      : 'أضف تفاصيل محددة عن الوقت أو المكان أو الظروف من القضية رقم 94346/2024'
    );
  }
  if (hasMultipleQuestions) {
    suggestions.push(language === 'en'
      ? 'Break into separate questions, one per topic'
      : 'قسّم إلى أسئلة منفصلة، واحد لكل موضوع'
    );
  }
  if (!hasLegalTerms && overallScore < 70) {
    suggestions.push(language === 'en'
      ? 'Reference relevant testimony or evidence from the police report'
      : 'ارجع إلى الشهادة أو الأدلة ذات الصلة من تقرير الشرطة'
    );
  }
  if (isLeading) {
    suggestions.push(language === 'en'
      ? 'Rephrase to be neutral and open-ended'
      : 'أعد الصياغة لتكون محايدة ومفتوحة'
    );
  }
  
  // Generate improved version if score is low
  let improvedVersion: string | undefined;
  
  if (overallScore < 80) {
    if (language === 'en') {
      if (isVague) {
        improvedVersion = `Can you describe in detail ${question.replace(/\?/g, '').trim()}, including the specific time and your exact location?`;
      } else if (hasMultipleQuestions) {
        const firstQuestion = question.split(/\?|؟/)[0] + '?';
        improvedVersion = firstQuestion;
      } else if (!hasQuestionMark) {
        improvedVersion = question.trim() + '?';
      } else if (isLeading) {
        improvedVersion = question
          .replace(/don't you think|isn't it true|wouldn't you say/gi, 'What is your view on')
          .replace(/\?$/, '') + '?';
      }
    } else {
      if (isVague) {
        improvedVersion = `هل يمكنك وصف بالتفصيل ${question.replace(/؟/g, '').trim()}، بما في ذلك الوقت المحدد وموقعك بالضبط؟`;
      } else if (hasMultipleQuestions) {
        const firstQuestion = question.split(/\?|؟/)[0] + '؟';
        improvedVersion = firstQuestion;
      } else if (!hasQuestionMark) {
        improvedVersion = question.trim() + '؟';
      } else if (isLeading) {
        improvedVersion = question
          .replace(/ألا تعتقد|أليس صحيحاً|ألا توافق/gi, 'ما هو رأيك في')
          .replace(/؟$/, '') + '؟';
      }
    }
  }
  
  return {
    overallScore,
    clarity,
    relevance,
    appropriateness,
    category,
    issues,
    suggestions,
    improvedVersion
  };
};
// ============================================
// SCORE BAR COMPONENT
// ============================================
/**
 * Visual score bar component for evaluation metrics
 */
const ScoreBar: React.FC<{ label: string; score: number }> = ({ label, score }) => (
  <div>
    <div className="text-xs text-gray-600 mb-1">{label}</div>
    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
      <div 
        className={`h-full transition-all ${
          score >= 80 ? 'bg-green-500' :
          score >= 60 ? 'bg-yellow-500' :
          'bg-red-500'
        }`}
        style={{ width: `${score}%` }}
      />
    </div>
    <div className="text-xs text-gray-500 mt-1">{score}%</div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================
const ManualQuestionInput: React.FC = () => {
  const { t } = useLanguage();
  const { language } = useLanguage();
  
  const [manualQuestion, setManualQuestion] = useState('');
  const [evaluation, setEvaluation] = useState<QuestionEvaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Context hooks
  const { currentSession } = useCaseContext();

  /**
   * 🎭 MOCK: Evaluate question using pre-prepared demos or mock logic
   */
  const handleEvaluate = async () => {
    if (!manualQuestion.trim() || !currentSession) return;
    
    setIsEvaluating(true);
    setError(null);
    
    try {
      console.log('🎭 [MOCK MODE] Evaluating question...');
      
      // Simulate API delay (400-800ms for realism)
      await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 400));
      
      // 🎯 Check if this is one of our demo questions (case-insensitive trim comparison)
      const normalizedInput = manualQuestion.trim().toLowerCase();
      const demoIndex = DEMO_TEST_QUESTIONS.findIndex(
        demo => demo.question.trim().toLowerCase() === normalizedInput
      );
      
      let mockEvaluation: QuestionEvaluation;
      
      if (demoIndex >= 0) {
        // ✅ Use pre-prepared evaluation for demo question
        mockEvaluation = DEMO_TEST_QUESTIONS[demoIndex].expectedEval;
        console.log('✅ [DEMO] Using pre-prepared evaluation for known question #' + (demoIndex + 1));
      } else {
        // ✅ Generate mock evaluation for unknown question
        mockEvaluation = generateMockEvaluation(manualQuestion, language);
        console.log('✅ [MOCK] Generated evaluation for custom question');
      }
      
      console.log('✅ Question evaluated successfully:', {
        overallScore: mockEvaluation.overallScore,
        category: mockEvaluation.category,
        issuesFound: mockEvaluation.issues.length,
        suggestionsProvided: mockEvaluation.suggestions.length,
        hasImprovedVersion: !!mockEvaluation.improvedVersion,
        language: language,
        mode: demoIndex >= 0 ? `DEMO (Pre-prepared #${demoIndex + 1})` : 'MOCK (Generated)'
      });
      
      setEvaluation(mockEvaluation);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to evaluate question';
      setError(errorMessage);
      console.error('❌ Error evaluating question:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  /**
   * Clear input and evaluation
   */
  const handleClear = () => {
    setManualQuestion('');
    setEvaluation(null);
    setError(null);
  };

  return (
    <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">✍️</span>
        <h3 className="font-semibold text-gray-700">{t("evaluation.title")}</h3>
        <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
          {t("evaluation.subtitle")}
        </span>
      </div>
      
      <p className="text-xs text-gray-600 mb-3">
        {t("evaluation.instructions")}
      </p>
      
      <textarea
        value={manualQuestion}
        onChange={(e) => setManualQuestion(e.target.value)}
        placeholder={t("evaluation.placeholder")}
        className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        rows={3}
      />
      
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleEvaluate}
          disabled={!manualQuestion.trim() || isEvaluating || !currentSession}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
        >
          {isEvaluating ? (
            <>
              <span className="animate-spin">⚙️</span>
              {t("evaluation.evaluating")}
            </>
          ) : (
            <>
              🔍 {t("evaluation.evaluateButton")}
            </>
          )}
        </button>
        
        <button
          onClick={handleClear}
          disabled={!manualQuestion && !evaluation}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
        >
          {t("evaluation.clear")}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border-l-4 border-red-500 rounded">
          <div className="flex items-center gap-2">
            <span className="text-red-500">⚠️</span>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
      
      {/* Evaluation Results */}
      {evaluation && (
        <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200">
          {/* Overall Score */}
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-700">{t("evaluation.resultsTitle")}</h4>
            <div className={`px-4 py-2 rounded-full font-bold text-lg ${
              evaluation.overallScore >= 80 ? 'bg-green-100 text-green-700' :
              evaluation.overallScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {evaluation.overallScore}%
              {evaluation.overallScore >= 80 && <span className="ml-1">✓</span>}
            </div>
          </div>
          
          {/* Score Breakdown */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <ScoreBar label={t("evaluation.clarity")} score={evaluation.clarity} />
            <ScoreBar label={t("evaluation.relevance")} score={evaluation.relevance} />
            <ScoreBar label={t("evaluation.appropriate")} score={evaluation.appropriateness} />
          </div>
          
          {/* Category */}
          <div className="mb-3">
            <span className="text-xs text-gray-600">{t("evaluation.category")}:</span>
            <span className="ml-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
              {t(`aiAssistant.category.${evaluation.category}`)}
            </span>
          </div>
          
          {/* Issues Found */}
          {evaluation.issues.length > 0 && (
            <div className="mb-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                <span>⚠️</span>
                {t("evaluation.issuesFound")}
              </div>
              <ul className="text-xs text-red-600 space-y-1 list-disc list-inside">
                {evaluation.issues.map((issue: string, i: number) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Suggestions */}
          {evaluation.suggestions.length > 0 && (
            <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                <span>💡</span>
                {t("evaluation.suggestions")}
              </div>
              <ul className="text-xs text-blue-600 space-y-1 list-disc list-inside">
                {evaluation.suggestions.map((suggestion: string, i: number) => (
                  <li key={i}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Improved Version */}
          {evaluation.improvedVersion && (
            <div className="p-3 bg-white rounded-lg border-l-4 border-green-500 shadow-sm">
              <div className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                <span>✨</span>
                {t("evaluation.improved")}
              </div>
              <p className="text-sm text-gray-700 italic mb-2">"{evaluation.improvedVersion}"</p>
            </div>
          )}

          {/* Success Message for High Scores */}
          {evaluation.overallScore >= 80 && evaluation.issues.length === 0 && (
            <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 text-green-700">
                <span>✓</span>
                <p className="text-sm font-semibold">
                  {t("evaluation.excellentQuestion")}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ManualQuestionInput;
