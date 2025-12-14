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

export const useParticipantTranslation = () => {
  const [participantView, setParticipantView] = useState<Array<{
    id: string;
    speaker: string;
    text: string;
    timestamp: Date;
  }>>([]);

  useEffect(() => {
    const updateParticipantView = () => {
      try {
        const stored = localStorage.getItem('vision-ai-translations');
        if (stored) {
          const data = JSON.parse(stored);
          const participantViewData = data.translations.map((trans: TranslationResult) => ({
            id: trans.id,
            speaker: trans.speaker,
            text: trans.participantDisplay,
            timestamp: new Date(trans.timestamp)
          }));
          setParticipantView(participantViewData);
        }
      } catch (err) {
        console.error('❌ Failed to update participant view:', err);
      }
    };

    // Initial load
    updateParticipantView();

    // ✨ Listen for custom event (instant updates, same tab)
    const handleTranslationUpdate = () => {
      console.log('🔔 Translation update received');
      updateParticipantView();
    };

    window.addEventListener('translations-updated', handleTranslationUpdate);
    
    // Listen for storage events (updates from other tabs/windows)
    window.addEventListener('storage', updateParticipantView);

    // Fallback polling (in case events don't fire) - increased to 2 seconds
    const interval = setInterval(updateParticipantView, 2000);

    return () => {
      window.removeEventListener('translations-updated', handleTranslationUpdate);
      window.removeEventListener('storage', updateParticipantView);
      clearInterval(interval);
    };
  }, []);

  return participantView;
};