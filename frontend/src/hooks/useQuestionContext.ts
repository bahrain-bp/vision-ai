import { useContext } from 'react';
import { QuestionContext, QuestionContextType } from '../context/QuestionContext';

/**
 * Custom hook to use Question Context
 * Throws error if used outside provider
 */
export const useQuestionContext = (): QuestionContextType => {
  const context = useContext(QuestionContext);
  
  if (context === undefined) {
    throw new Error('useQuestionContext must be used within a QuestionProvider');
  }
  
  return context;
};