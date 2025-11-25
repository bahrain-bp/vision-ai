import { useContext, useState, useEffect } from 'react';
import { TranslationContext } from '../context/TranslationContext';
import { TranslationResult } from '../services/LiveTranslation/TranslationService';

export const useRealTimeTranslation = () => {
  const context = useContext(TranslationContext);
  
  if (context === undefined) {
    throw new Error('useRealTimeTranslation must be used within a TranslationProvider');
  }
  
  return context;
};

// Read data from localStorage for Witness view
export const useWitnessTranslation = () => {
  const [witnessView, setWitnessView] = useState<Array<{
    id: string;
    speaker: string;
    text: string;
    timestamp: Date;
  }>>([]);

  useEffect(() => {
    const updateWitnessView = () => {
      try {
        const stored = localStorage.getItem('vision-ai-translations');
        if (stored) {
          const data = JSON.parse(stored);
          const witnessViewData = data.translations.map((trans: TranslationResult) => ({
            id: trans.id,
            speaker: trans.speaker,
            text: trans.witnessDisplay,
            timestamp: new Date(trans.timestamp)
          }));
          setWitnessView(witnessViewData);
        }
      } catch (err) {
        console.error(' Failed to update witness view:', err);
      }
    };

    updateWitnessView();
    const interval = setInterval(updateWitnessView, 1000); // Poll every second
    return () => clearInterval(interval);
  }, []);

  return witnessView;
};