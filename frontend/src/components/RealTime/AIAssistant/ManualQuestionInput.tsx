// src/components/RealTime/AIAssistant/ManualQuestionInput.tsx
import React, { useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext'; // ← ADDED
import { useCaseContext } from '../../../hooks/useCaseContext';
import { useTranscription } from '../../../hooks/useTranscription';
import questionService from '../../../services/AIAssistant/questionServiceRT';  
import type { QuestionEvaluation } from '../../../types/aiQuestionsRT'; 

// Score Bar Component (defined BEFORE main component)
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

const ManualQuestionInput: React.FC = () => {
   const { t } = useLanguage(); // ← ADDED
   const { language } = useLanguage();
  const [manualQuestion, setManualQuestion] = useState('');
  const [evaluation, setEvaluation] = useState<QuestionEvaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Context hooks
  const { currentSession, currentPersonType } = useCaseContext();
  const { getFullTranscript } = useTranscription();

  const handleEvaluate = async () => {
    if (!manualQuestion.trim() || !currentSession) return;
    
    setIsEvaluating(true);
    setError(null);
    
    
    try {
      const response = await questionService.evaluateQuestion({
        question: manualQuestion,
        caseId: currentSession.caseId,
        sessionId: currentSession.sessionId,
        personType: currentPersonType as 'witness' | 'accused' | 'victim',
        caseSummary: '', // Will be fetched by backend
        currentTranscript: getFullTranscript,
        language: language, // ← ADD THIS - sends 'en' or 'ar'
      });
      
      if (response.evaluation) {
        setEvaluation(response.evaluation);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to evaluate question';
      setError(errorMessage);
      console.error('Failed to evaluate question:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleClear = () => {
    setManualQuestion('');
    setEvaluation(null);
    setError(null);
  };

  return (
    <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">✍️</span>
        <h3 className="font-semibold text-gray-700">{t("evaluation.title")}</h3> {/* ← CHANGED */}
        <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
          {t("evaluation.subtitle")} {/* ← CHANGED */}
        </span>
      </div>

      <p className="text-xs text-gray-600 mb-3">
        {t("evaluation.instructions")} {/* ← CHANGED */}
      </p>
      
      <textarea
        value={manualQuestion}
        onChange={(e) => setManualQuestion(e.target.value)}
        placeholder={t("evaluation.placeholder")} // CHANGED 
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
              {t("evaluation.evaluating")} {/* ← CHANGED */}
            </>
          ) : (
            <>
              🔍 {t("evaluation.evaluateButton")} {/* ← CHANGED */}
            </>
          )}
        </button>
        
        <button
          onClick={handleClear}
          disabled={!manualQuestion && !evaluation}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
        >
         {t("evaluation.clear")} {/* ← CHANGED */}
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
            <h4 className="font-semibold text-gray-700">{t("evaluation.resultsTitle")}</h4> {/* ← CHANGED */}
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
            <ScoreBar label={t("evaluation.clarity")} score={evaluation.clarity} /> {/* ← CHANGED */}
            <ScoreBar label={t("evaluation.relevance")} score={evaluation.relevance} /> {/* ← CHANGED */}
            <ScoreBar label={t("evaluation.appropriate")} score={evaluation.appropriateness} /> {/* ← CHANGED */}
          </div>
          
          {/* Category */}
          <div className="mb-3">
            <span className="text-xs text-gray-600">{t("evaluation.category")}:</span> {/* ← CHANGED */}
            <span className="ml-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
              {t(`aiAssistant.category.${evaluation.category}`)} {/* ← CHANGED */}
            </span>
          </div>
          
          {/* Issues Found */}
          {evaluation.issues.length > 0 && (
            <div className="mb-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                <span>⚠️</span>
                {t("evaluation.issuesFound")} {/* ← CHANGED */}
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
               {t("evaluation.suggestions")} {/* ← CHANGED */}
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
                {t("evaluation.improved")} {/* ← CHANGED */}
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
                  {t("evaluation.excellentQuestion")} {/* ← CHANGED */}
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