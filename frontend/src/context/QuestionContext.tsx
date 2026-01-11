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
import questionService from '../services/AIAssistant/questionServiceRT'; // ← ADD THIS LINE


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
  
  // ✨ HTML GENERATION
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
// 🎭 MOCK DATA GENERATION
// ============================================

/**
 * Generate 30 realistic English questions based on ACTUAL case report #94346/2024
 */
const generateMockEnglishQuestions = () => {
  const questions = [
    // HIGH PRIORITY - TIMELINE (8 questions)
    { text: "At what exact time did you arrive at Traderfix Restaurant on the evening of May 23rd, 2024?", category: "timeline", priority: "high", confidence: "high", reasoning: "Establishes precise timeline for the witness's presence at the scene", sourceContext: "Police Report: Incident occurred at 00:15 on May 24, 2024" },
    { text: "How long were you serving other tables before you noticed the disturbance at the suspect's table?", category: "timeline", priority: "high", confidence: "high", reasoning: "Determines witness's attention and observation window", sourceContext: "Witness statement: Security manager Abdul Aziz was working during the incident" },
    { text: "What time did the suspect finish consuming alcoholic beverages before refusing payment?", category: "timeline", priority: "high", confidence: "high", reasoning: "Establishes sequence of events leading to confrontation", sourceContext: "Police Report: Suspect ordered alcoholic drinks at 22:00, refused payment at 00:00" },
    { text: "How much time elapsed between when you called the police and when Officers Ali Anwar and Shehzad Anjum arrived?", category: "timeline", priority: "high", confidence: "medium", reasoning: "Maps response time and escalation period", sourceContext: "Security log indicates officers responded to call #2140/2024" },
    { text: "At what point did the suspect begin shouting and creating the disturbance you described?", category: "timeline", priority: "high", confidence: "high", reasoning: "Identifies when situation escalated from payment dispute to public disturbance", sourceContext: "Witness Abdul Aziz: Suspect created chaos and shouting after refusing payment" },
    { text: "When exactly did the suspect board the police vehicle - immediately or after some delay?", category: "timeline", priority: "high", confidence: "medium", reasoning: "Clarifies cooperation level and any resistance period", sourceContext: "Police Report: Suspect boarded patrol vehicle voluntarily" },
    { text: "How long was the suspect at your restaurant before the payment dispute began?", category: "timeline", priority: "medium", confidence: "high", reasoning: "Provides context for behavior observation period", sourceContext: "Report indicates suspect arrived Thursday 23rd at 22:00, incident at 00:00 Friday" },
    { text: "What time did you personally witness the suspect's interaction with the responding officers?", category: "timeline", priority: "medium", confidence: "high", reasoning: "Confirms witness's direct observation of key events", sourceContext: "Witness present during police arrival and suspect's behavior" },

    // HIGH PRIORITY - VERIFICATION (7 questions)
    { text: "Can you confirm that the suspect, Sulaiman bin Abdul Mohsen, was the person you served at Traderfix Restaurant?", category: "verification", priority: "high", confidence: "high", reasoning: "Establishes positive identification of the accused", sourceContext: "Case #94346/2024 accused: Sulaiman Abdul Mohsen, ID 1011710782" },
    { text: "You mentioned the suspect refused to pay - can you verify the exact amount of the outstanding bill?", category: "verification", priority: "high", confidence: "high", reasoning: "Confirms the financial dispute that triggered the incident", sourceContext: "Bill dispute report filed under #2140/2024" },
    { text: "Can you confirm whether Officers Ali Anwar and Shehzad Anjum were the two officers who responded to your call?", category: "verification", priority: "high", confidence: "high", reasoning: "Verifies identity of complainant officers", sourceContext: "Complainants: Ali Anwar Mohammed (222077482) and Shehzad Anjum (222084284)" },
    { text: "Is it correct that you hold the position of Security Manager at Traderfix Restaurant at the Ritz-Carlton?", category: "verification", priority: "high", confidence: "high", reasoning: "Establishes witness credibility and authority", sourceContext: "Witness Abdul Aziz Maher Ahmed (222094635) - Security Manager" },
    { text: "Can you verify that the suspect appeared intoxicated based on your observations that evening?", category: "verification", priority: "high", confidence: "high", reasoning: "Corroborates medical alcohol test results", sourceContext: "Alcohol test confirmed suspect was intoxicated" },
    { text: "You stated there was no physical altercation between police and the suspect - can you confirm this absolutely?", category: "verification", priority: "high", confidence: "high", reasoning: "Critical to assault allegations made by suspect", sourceContext: "Witness Abdul Aziz: No physical confrontation occurred between suspect and police" },
    { text: "Can you confirm that security cameras at the Ritz-Carlton parking area captured this incident?", category: "verification", priority: "medium", confidence: "medium", reasoning: "Identifies potential video evidence", sourceContext: "Incident location: Traderfix parking lot, Ritz-Carlton, Seef area" },

    // HIGH PRIORITY - CLARIFICATION (6 questions)
    { text: "Can you describe in detail the suspect's behavior when he refused to pay the restaurant bill?", category: "clarification", priority: "high", confidence: "high", reasoning: "Documents specific conduct constituting disturbance", sourceContext: "Police Report: Suspect created chaos and shouted after refusing payment" },
    { text: "What specific words or phrases did the suspect shout when the police arrived?", category: "clarification", priority: "high", confidence: "high", reasoning: "Captures evidence of insults directed at officers", sourceContext: "Officers reported suspect shouted 'I am an international lawyer' and issued orders provocatively" },
    { text: "How would you describe the suspect's demeanor when Officers Ali and Shehzad first approached him?", category: "clarification", priority: "high", confidence: "high", reasoning: "Establishes initial confrontation dynamics", sourceContext: "Police Report: Suspect was uncooperative, refused to show ID, did not recognize them as police" },
    { text: "Can you clarify what you mean when you said the suspect 'issued orders' to the police officers?", category: "clarification", priority: "high", confidence: "medium", reasoning: "Defines specific insulting behavior toward officers", sourceContext: "Report states suspect gave orders to police in provocative manner" },
    { text: "Describe the suspect's physical state when police placed him in handcuffs - was he resisting or compliant?", category: "clarification", priority: "high", confidence: "high", reasoning: "Clarifies use of restraints and suspect cooperation", sourceContext: "Officers applied handcuffs; suspect later claimed self-injury with them" },
    { text: "What was your exact location in relation to the suspect when the police vehicle departed?", category: "clarification", priority: "medium", confidence: "medium", reasoning: "Determines what witness could observe during departure", sourceContext: "Incident occurred in restaurant parking area" },

    // MEDIUM PRIORITY - CONTRADICTION (5 questions)
    { text: "The suspect claims he paid 200 Bahraini Dinars but you dispute this - what amount did he actually pay?", category: "contradiction", priority: "medium", confidence: "high", reasoning: "Resolves factual dispute about payment", sourceContext: "Suspect's statement: claims partial payment made; witness disputes this" },
    { text: "The suspect alleges officers assaulted him, but you stated there was no physical contact - can you explain this discrepancy?", category: "contradiction", priority: "medium", confidence: "high", reasoning: "Addresses serious assault allegations", sourceContext: "Suspect accused officers; witness Abdul Aziz confirms no assault occurred" },
    { text: "The suspect mentioned you had a 'long-standing relationship' with him, yet you stated you don't know him - which is accurate?", category: "contradiction", priority: "medium", confidence: "medium", reasoning: "Tests for potential bias or prior relationship", sourceContext: "Standard witness credibility assessment regarding familiarity" },
    { text: "You said the suspect boarded the patrol car voluntarily, but he claims he was forced - what actually happened?", category: "contradiction", priority: "medium", confidence: "high", reasoning: "Clarifies nature of suspect's detention", sourceContext: "Police Report: Suspect boarded patrol vehicle by himself" },
    { text: "The suspect stated he was injured by officers, but later admitted self-harm - did you witness any injury occur?", category: "contradiction", priority: "medium", confidence: "high", reasoning: "Documents how injury actually occurred", sourceContext: "Suspect confession: Hit himself with handcuffs while in patrol car" },

    // MEDIUM PRIORITY - MOTIVATION (4 questions)
    { text: "Why did you decide to call the police rather than attempting to resolve the payment dispute internally?", category: "motivation", priority: "medium", confidence: "medium", reasoning: "Understands escalation decision-making", sourceContext: "Security manager called police after suspect refused payment and created disturbance" },
    { text: "What prompted the suspect to suddenly refuse payment after consuming the alcoholic beverages?", category: "motivation", priority: "medium", confidence: "medium", reasoning: "Explores trigger for the dispute", sourceContext: "Suspect ordered drinks at 22:00, refused payment at 00:00" },
    { text: "In your experience as Security Manager, why do you believe the suspect behaved this way toward the officers?", category: "motivation", priority: "low", confidence: "medium", reasoning: "Provides security professional's assessment", sourceContext: "Witness's professional role and experience" },
    { text: "What was the suspect's apparent reason for claiming he was an 'international lawyer' to the police?", category: "motivation", priority: "medium", confidence: "medium", reasoning: "Explores suspect's stated authority claims", sourceContext: "Officers reported suspect repeatedly claimed to be international lawyer" }
  ];

  // Add IDs and status
  return questions.map((q, index) => ({
    id: `en-q-${index + 1}`,
    text: q.text,
    category: q.category as "clarification" | "verification" | "contradiction" | "timeline" | "motivation",
    priority: q.priority as "high" | "medium" | "low",
    confidence: q.confidence as "high" | "medium" | "low",
    reasoning: q.reasoning,
    sourceContext: q.sourceContext,
    status: 'pending' as const
  }));
};

/**
 * Generate 30 realistic Arabic questions based on ACTUAL case report #94346/2024
 */
const generateMockArabicQuestions = () => {
  const questions = [
    // HIGH PRIORITY - TIMELINE (8 questions)
    { text: "في أي وقت بالضبط وصلت إلى مطعم تريدرفكس مساء 23 مايو 2024؟", category: "timeline", priority: "high", confidence: "high", reasoning: "يحدد الجدول الزمني الدقيق لتواجد الشاهد في مسرح الحادث", sourceContext: "تقرير الشرطة: وقع الحادث الساعة 00:15 يوم 24 مايو 2024" },
    { text: "كم من الوقت كنت تخدم طاولات أخرى قبل أن تلاحظ الاضطراب في طاولة المشتبه به؟", category: "timeline", priority: "high", confidence: "high", reasoning: "يحدد انتباه الشاهد ونافذة المراقبة", sourceContext: "إفادة الشاهد: مدير الأمن عبدالعزيز كان يعمل أثناء الحادث" },
    { text: "في أي وقت انتهى المشتبه به من تناول المشروبات الكحولية قبل رفضه الدفع؟", category: "timeline", priority: "high", confidence: "high", reasoning: "يحدد تسلسل الأحداث المؤدية للمواجهة", sourceContext: "تقرير الشرطة: المشتبه به طلب المشروبات الساعة 22:00، رفض الدفع الساعة 00:00" },
    { text: "كم من الوقت انقضى بين اتصالك بالشرطة ووصول العريف علي أنور ورئيس العرفاء شهزاد أنجم؟", category: "timeline", priority: "high", confidence: "medium", reasoning: "يحدد وقت الاستجابة وفترة التصعيد", sourceContext: "سجل الأمن يشير إلى استجابة الضباط للبلاغ رقم 2140/2024" },
    { text: "في أي لحظة بدأ المشتبه به بالصراخ وإحداث الفوضى التي وصفتها؟", category: "timeline", priority: "high", confidence: "high", reasoning: "يحدد متى تصاعد الموقف من نزاع الدفع إلى إزعاج عام", sourceContext: "الشاهد عبدالعزيز: المشتبه به أحدث فوضى وصراخ بعد رفض الدفع" },
    { text: "متى بالضبط صعد المشتبه به إلى سيارة الشرطة - فوراً أم بعد تأخير؟", category: "timeline", priority: "high", confidence: "medium", reasoning: "يوضح مستوى التعاون وأي فترة مقاومة", sourceContext: "تقرير الشرطة: المشتبه به صعد للدورية من نفسه" },
    { text: "كم من الوقت قضى المشتبه به في مطعمك قبل أن يبدأ نزاع الدفع؟", category: "timeline", priority: "medium", confidence: "high", reasoning: "يوفر سياقاً لفترة مراقبة السلوك", sourceContext: "التقرير يشير أن المشتبه به وصل الخميس 23 الساعة 22:00، الحادث 00:00 الجمعة" },
    { text: "في أي وقت شاهدت شخصياً تفاعل المشتبه به مع الضباط المستجيبين؟", category: "timeline", priority: "medium", confidence: "high", reasoning: "يؤكد المراقبة المباشرة للشاهد للأحداث الرئيسية", sourceContext: "الشاهد كان حاضراً أثناء وصول الشرطة وسلوك المشتبه به" },

    // HIGH PRIORITY - VERIFICATION (7 questions)
    { text: "هل يمكنك تأكيد أن المشتبه به سليمان بن عبدالمحسن هو الشخص الذي خدمته في مطعم تريدرفكس؟", category: "verification", priority: "high", confidence: "high", reasoning: "يثبت التعريف الإيجابي للمتهم", sourceContext: "القضية رقم 94346/2024 المتهم: سليمان عبدالمحسن، الرقم 1011710782" },
    { text: "ذكرت أن المشتبه به رفض الدفع - هل يمكنك تحديد المبلغ الدقيق للفاتورة المستحقة؟", category: "verification", priority: "high", confidence: "high", reasoning: "يؤكد النزاع المالي الذي أثار الحادث", sourceContext: "تقرير نزاع الفاتورة مسجل تحت رقم 2140/2024" },
    { text: "هل يمكنك تأكيد أن العريف علي أنور ورئيس العرفاء شهزاد أنجم هما الضابطان اللذان استجابا لمكالمتك؟", category: "verification", priority: "high", confidence: "high", reasoning: "يتحقق من هوية الضابطين المبلغين", sourceContext: "المبلغون: علي أنور محمد (222077482) وشهزاد أنجم (222084284)" },
    { text: "هل صحيح أنك تشغل منصب مدير الأمن في مطعم تريدرفكس بفندق الريتز كارلتون؟", category: "verification", priority: "high", confidence: "high", reasoning: "يثبت مصداقية الشاهد وسلطته", sourceContext: "الشاهد عبدالعزيز ماهر أحمد (222094635) - مدير الأمن" },
    { text: "هل يمكنك التحقق من أن المشتبه به بدا في حالة سكر بناءً على ملاحظاتك تلك الليلة؟", category: "verification", priority: "high", confidence: "high", reasoning: "يؤكد نتائج فحص الكحول الطبي", sourceContext: "فحص الكحول أكد أن المشتبه به كان سكراناً" },
    { text: "ذكرت أنه لم يحدث اشتباك جسدي بين الشرطة والمشتبه به - هل يمكنك تأكيد ذلك بشكل قاطع؟", category: "verification", priority: "high", confidence: "high", reasoning: "حاسم لمزاعم الاعتداء التي قدمها المشتبه به", sourceContext: "الشاهد عبدالعزيز: لم يحصل أي اعتداء جسدي بين المشتبه به والشرطة" },
    { text: "هل يمكنك تأكيد أن كاميرات المراقبة في موقف الريتز كارلتون سجلت هذا الحادث؟", category: "verification", priority: "medium", confidence: "medium", reasoning: "يحدد أدلة الفيديو المحتملة", sourceContext: "موقع الحادث: موقف سيارات تريدرفكس، فندق الريتز كارلتون، منطقة السيف" },

    // HIGH PRIORITY - CLARIFICATION (6 questions)
    { text: "هل يمكنك وصف بالتفصيل سلوك المشتبه به عندما رفض دفع فاتورة المطعم؟", category: "clarification", priority: "high", confidence: "high", reasoning: "يوثق السلوك المحدد الذي يشكل إزعاجاً", sourceContext: "تقرير الشرطة: المشتبه به أحدث فوضى وصراخ بعد رفض الدفع" },
    { text: "ما هي الكلمات أو العبارات المحددة التي صرخ بها المشتبه به عند وصول الشرطة؟", category: "clarification", priority: "high", confidence: "high", reasoning: "يلتقط أدلة الإهانات الموجهة للضباط", sourceContext: "الضباط أفادوا أن المشتبه به صرخ 'أنا محامي دولي' وأصدر أوامر بطريقة استفزازية" },
    { text: "كيف تصف سلوك المشتبه به عندما اقترب منه العريف علي ورئيس العرفاء شهزاد لأول مرة؟", category: "clarification", priority: "high", confidence: "high", reasoning: "يحدد ديناميكيات المواجهة الأولية", sourceContext: "تقرير الشرطة: المشتبه به لم يكن متعاوناً، رفض إظهار الهوية، لم يعترف بهم كشرطة" },
    { text: "هل يمكنك توضيح ما تقصده عندما قلت إن المشتبه به 'أصدر أوامر' لضباط الشرطة؟", category: "clarification", priority: "high", confidence: "medium", reasoning: "يحدد السلوك المهين المحدد تجاه الضباط", sourceContext: "التقرير يفيد أن المشتبه به أعطى أوامر للشرطة بطريقة استفزازية" },
    { text: "صف الحالة الجسدية للمشتبه به عندما وضعته الشرطة في الأصفاد - هل كان يقاوم أم متعاوناً؟", category: "clarification", priority: "high", confidence: "high", reasoning: "يوضح استخدام القيود وتعاون المشتبه به", sourceContext: "الضباط وضعوا الأصفاد؛ المشتبه به ادعى لاحقاً إصابة نفسه بها" },
    { text: "ما كان موقعك بالضبط بالنسبة للمشتبه به عندما غادرت سيارة الشرطة؟", category: "clarification", priority: "medium", confidence: "medium", reasoning: "يحدد ما كان يمكن للشاهد مراقبته أثناء المغادرة", sourceContext: "وقع الحادث في منطقة موقف سيارات المطعم" },

    // MEDIUM PRIORITY - CONTRADICTION (5 questions)
    { text: "المشتبه به يدعي أنه دفع 200 دينار بحريني لكنك تنفي ذلك - ما هو المبلغ الذي دفعه فعلياً؟", category: "contradiction", priority: "medium", confidence: "high", reasoning: "يحل النزاع الواقعي حول الدفع", sourceContext: "إفادة المشتبه به: يدعي دفع جزئي؛ الشاهد ينفي ذلك" },
    { text: "المشتبه به يزعم أن الضباط اعتدوا عليه، لكنك ذكرت عدم حدوث احتكاك جسدي - هل يمكنك شرح هذا التناقض؟", category: "contradiction", priority: "medium", confidence: "high", reasoning: "يعالج مزاعم الاعتداء الخطيرة", sourceContext: "المشتبه به اتهم الضباط؛ الشاهد عبدالعزيز يؤكد عدم حدوث اعتداء" },
    { text: "المشتبه به ذكر أن لديك 'علاقة طويلة' معه، ومع ذلك أنت ذكرت أنك لا تعرفه - أيهما صحيح؟", category: "contradiction", priority: "medium", confidence: "medium", reasoning: "يختبر التحيز المحتمل أو العلاقة السابقة", sourceContext: "تقييم مصداقية الشاهد القياسي فيما يتعلق بالمعرفة المسبقة" },
    { text: "قلت إن المشتبه به صعد لسيارة الدورية طوعاً، لكنه يدعي أنه أُجبر - ما الذي حدث فعلاً؟", category: "contradiction", priority: "medium", confidence: "high", reasoning: "يوضح طبيعة احتجاز المشتبه به", sourceContext: "تقرير الشرطة: المشتبه به صعد للدورية من نفسه" },
    { text: "المشتبه به ذكر أن الضباط أصابوه، لكنه اعترف لاحقاً بإيذاء نفسه - هل شاهدت أي إصابة تحدث؟", category: "contradiction", priority: "medium", confidence: "high", reasoning: "يوثق كيف حدثت الإصابة فعلياً", sourceContext: "اعتراف المشتبه به: ضرب نفسه بالأصفاد بينما كان في سيارة الدورية" },

    // MEDIUM PRIORITY - MOTIVATION (4 questions)
    { text: "لماذا قررت الاتصال بالشرطة بدلاً من محاولة حل نزاع الدفع داخلياً؟", category: "motivation", priority: "medium", confidence: "medium", reasoning: "يفهم عملية اتخاذ قرار التصعيد", sourceContext: "مدير الأمن اتصل بالشرطة بعد رفض المشتبه به الدفع وإحداث الفوضى" },
    { text: "ما الذي دفع المشتبه به فجأة لرفض الدفع بعد تناول المشروبات الكحولية؟", category: "motivation", priority: "medium", confidence: "medium", reasoning: "يستكشف المحفز للنزاع", sourceContext: "المشتبه به طلب المشروبات الساعة 22:00، رفض الدفع الساعة 00:00" },
    { text: "بحسب خبرتك كمدير أمن، لماذا تعتقد أن المشتبه به تصرف بهذه الطريقة تجاه الضباط؟", category: "motivation", priority: "low", confidence: "medium", reasoning: "يوفر تقييم محترف الأمن", sourceContext: "الدور المهني للشاهد وخبرته" },
    { text: "ما هو السبب الظاهر للمشتبه به لادعائه أنه 'محامي دولي' أمام الشرطة؟", category: "motivation", priority: "medium", confidence: "medium", reasoning: "يستكشف ادعاءات السلطة التي ذكرها المشتبه به", sourceContext: "الضباط أفادوا أن المشتبه به ادعى مراراً أنه محامي دولي" }
  ];

  // Add IDs and status
  return questions.map((q, index) => ({
    id: `ar-q-${index + 1}`,
    text: q.text,
    category: q.category as "clarification" | "verification" | "contradiction" | "timeline" | "motivation",
    priority: q.priority as "high" | "medium" | "low",
    confidence: q.confidence as "high" | "medium" | "low",
    reasoning: q.reasoning,
    sourceContext: q.sourceContext,
    status: 'pending' as const
  }));
};


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

  /**
   * 🎭 MOCK: Shuffle array to simulate variety
   */
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  /**
   * 🎭 MOCK: Filter out questions that were already used
   */
  const getUniqueQuestions = (
    allQuestions: any[],
    previousQuestions: string[],
    count: number
  ): any[] => {
    // Normalize previous questions for comparison
    const previousSet = new Set(
      previousQuestions.map(q => q.trim().toLowerCase())
    );

    // Filter out questions that match previous ones
    const availableQuestions = allQuestions.filter(q => 
      !previousSet.has(q.text.trim().toLowerCase())
    );

    console.log('🎭 Mock filtering:', {
      totalQuestions: allQuestions.length,
      previousQuestions: previousQuestions.length,
      availableAfterFilter: availableQuestions.length,
      requestedCount: count
    });

    // Shuffle and take requested count
    const shuffled = shuffleArray(availableQuestions);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  };
  // ========== MAIN ACTIONS ==========
  
  /**
   * 🎭 MOCK: Generate new questions using mock data instead of API
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
        console.log('🎭 [MOCK MODE] Generating questions with mock data...');
        
        // Simulate API delay (500-1000ms for realism)
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

        // Get appropriate question bank based on language
        const questionBank = context.language === 'ar' 
          ? generateMockArabicQuestions()
          : generateMockEnglishQuestions();

        console.log('🎭 Mock question bank loaded:', {
          language: context.language,
          totalQuestions: questionBank.length,
          requestedCount: context.questionCount
        });

        // Filter out previously used questions
        const previousQuestions = context.previousQuestions || [];
        const uniqueQuestions = getUniqueQuestions(
          questionBank,
          previousQuestions,
          context.questionCount
        );

        // If we don't have enough unique questions, warn but proceed
        if (uniqueQuestions.length < context.questionCount) {
          console.warn('⚠️ Not enough unique questions available:', {
            requested: context.questionCount,
            available: uniqueQuestions.length,
            previousCount: previousQuestions.length
          });
        }

        // Sort by priority
        const sortedQuestions = sortQuestionsByPriority(uniqueQuestions);

        // Create new attempt
        const newAttempt: QuestionAttempt = {
          attemptId: generateAttemptId(),
          questions: sortedQuestions,
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

        console.log('✅ [MOCK] Generated questions successfully', {
          attemptId: newAttempt.attemptId,
          questionCount: sortedQuestions.length,
          language: context.language,
          transcriptLength: context.currentTranscript.length,
          mode: 'MOCK DATA'
        });

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate questions';
        setError(errorMessage);
        console.error('❌ Error generating mock questions:', errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [attempts.length, canGenerate, recordingStatus]
  );
  /**
   * Confirm current attempt and save to S3
   * ✅ UNCHANGED - S3 save logic preserved
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

    // ✅ SAVE TO S3 - LOGIC UNCHANGED
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
   * 🎭 MOCK: Retry with selection - WITH PROGRESSIVE TEMPERATURE (simulated)
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

        // Progressive temperature calculation (for logging consistency)
        const currentRetryCount = currentAttempt.retryCount || 0;
        const newRetryCount = currentRetryCount + 1;
        
        const baseTemperature = 0.7;
        const temperatureIncrement = 0.05;
        const maxTemperature = 0.95;
        
        const calculatedTemperature = Math.min(
          baseTemperature + (temperatureIncrement * newRetryCount),
          maxTemperature
        );

        console.log('🌡️ Temperature calculation (simulated):', {
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

        // 🎭 MOCK: Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 600));

        console.log('🎭 [MOCK MODE] Generating retry questions...');

        // Collect ALL previous questions for deduplication
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

        // Get appropriate question bank
        const questionBank = context.language === 'ar' 
          ? generateMockArabicQuestions()
          : generateMockEnglishQuestions();

        // Get unique questions (filtering out previous)
        const newQuestions = getUniqueQuestions(
          questionBank,
          uniquePreviousQuestions,
          questionsToGenerate
        );

        console.log('🎭 Mock retry generation:', {
          requested: questionsToGenerate,
          generated: newQuestions.length,
          language: context.language
        });

        // ✅ Filter out duplicates before merging (comparing with kept questions)
        const uniqueNewQuestions = newQuestions.filter(newQ => {
          return !keptQuestions.some(keptQ => keptQ.text.trim() === newQ.text.trim());
        });

        if (uniqueNewQuestions.length < newQuestions.length) {
          const filteredCount = newQuestions.length - uniqueNewQuestions.length;
          console.warn(`⚠️ Filtered ${filteredCount} duplicate(s) from mock response in retry`);
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

        console.log('✅ [MOCK] Retry completed successfully', {
          attemptId: updatedAttempt.attemptId,
          keptQuestions: keptQuestions.length,
          newQuestions: newQuestions.length,
          uniqueNewQuestions: uniqueNewQuestions.length,
          duplicatesFiltered: newQuestions.length - uniqueNewQuestions.length,
          totalQuestions: mergedQuestions.length,
          simulatedTemperature: calculatedTemperature,
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
   * ✅ UNCHANGED - No backend calls here
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
   * ✅ UNCHANGED - Pure state management
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

  /**
   * Clear error message
   * ✅ UNCHANGED
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Reset entire session
   * ✅ UNCHANGED
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
    console.log('🔄 Session reset');
  }, []);
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
    generateFinalHTMLReport: async () => {
      console.warn('⚠️ HTML generation skipped in mock mode');
      return { success: false, error: 'HTML generation not available in mock mode' };
    },
  };

  return (
    <QuestionContext.Provider value={value}>
      {children}
    </QuestionContext.Provider>
  );
};

export { QuestionContext };
