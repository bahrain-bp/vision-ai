import React, { createContext, useState, useCallback, ReactNode, useEffect } from "react";
import { translationService, TranslationResult, SpeakerType } from "../services/LiveTranslation/TranslationService";
import { useTranscription } from "../hooks/useTranscription";
import { useCaseContext } from "../hooks/useCaseContext";

export interface TranslationContextType {
  translations: TranslationResult[];
  addConversationTurn: () => Promise<void>;
  clearConversation: () => void;
  isTranslating: boolean;
  error: string | null;
  hasMoreConversation: boolean;
  currentSpeaker: string | null;
  investigatorLanguage: string;
  participantLanguage: string;
  setInvestigatorLanguage: (language: string) => void;
  setParticipantLanguage: (language: string) => void;
  saveTranslationsToS3: () => Promise<void>;
}

export const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

interface TranslationProviderProps {
  children: ReactNode;
  investigatorLanguage?: string;
  witnessLanguage?: string;
}

export const TranslationProvider: React.FC<TranslationProviderProps> = ({
  children,
  investigatorLanguage: initialInvestigatorLanguage = 'en-US',
  witnessLanguage: initialWitnessLanguage = 'ar-SA'
}) => {
  const [translations, setTranslations] = useState<TranslationResult[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [investigatorLanguage, setInvestigatorLanguage] = useState(initialInvestigatorLanguage);
  const [participantLanguage, setParticipantLanguage] = useState(initialWitnessLanguage);
  
  const { getTranscriptSegments, recordingStatus, resetTrigger } = useTranscription();
  const { currentCase, currentSession, currentPersonType } = useCaseContext();
  
  const [processedSegmentIds, setProcessedSegmentIds] = useState<Set<string>>(new Set());

  // Listen for reset trigger from transcription
  useEffect(() => {
    console.log(' Reset trigger detected, clearing translations');
    clearConversation();
    setProcessedSegmentIds(new Set());
  }, [resetTrigger]);

  const syncToLocalStorage = useCallback((translationData: TranslationResult[]) => {
    try {
      const syncData = {
        translations: translationData,
        lastUpdated: new Date().toISOString(),
        investigatorLanguage,
        participantLanguage
      };
      localStorage.setItem('vision-ai-translations', JSON.stringify(syncData));
      
      // ✨ Dispatch custom event for instant updates
      window.dispatchEvent(new CustomEvent('translations-updated', {
        detail: { count: translationData.length }
      }));
      
    } catch (err) {
      console.error(' Failed to sync to localStorage:', err);
    }
  }, [investigatorLanguage, participantLanguage]);

  // Normalize speaker type to match SpeakerType
  const normalizeSpeaker = (speaker: string): SpeakerType => {
    const normalized = speaker.trim();
    
    if (normalized === "Investigator") return "Investigator";
    
    // Check for participant types
    if (normalized === "Witness" || normalized.includes("Witness")) return "Witness";
    if (normalized === "Accused" || normalized.includes("Accused")) return "Accused";
    if (normalized === "Victim" || normalized.includes("Victim")) return "Victim";
    
    // Check for multi-participant mode (Speaker 0, Speaker 1, etc.)
    if (normalized.match(/Speaker \d+/)) {
      // Use the current person type or default to Witness
      return (currentPersonType as SpeakerType) || "Witness";
    }
    
    // Default fallback based on current person type
    return (currentPersonType as SpeakerType) || "Witness";
  };

  useEffect(() => {
    const processNewSegments = async () => {
      if (!recordingStatus || recordingStatus !== "on") {
        return;
      }

      const segments = getTranscriptSegments();
      
      if (!segments || segments.length === 0) {
        return;
      }

      // Find new segments that haven't been processed
      const newSegments = segments.filter(segment => {
        const segmentId = `${segment.timeStamp}-${segment.speaker}-${segment.formattedTranscript.substring(0, 20)}`;
        return !processedSegmentIds.has(segmentId);
      });

      if (newSegments.length === 0) {
        return;
      }

      console.log(` Processing ${newSegments.length} new segment(s)`);

      for (const segment of newSegments) {
        const segmentId = `${segment.timeStamp}-${segment.speaker}-${segment.formattedTranscript.substring(0, 20)}`;
        
        try {
          const actualText = segment.formattedTranscript.trim();
          
          if (!actualText || actualText.length < 2) {
            console.log(' Skipping - no meaningful text');
            continue;
          }

          const speaker = normalizeSpeaker(segment.speaker);
          
          console.log(` Processing segment - Speaker: ${speaker}, Text: "${actualText}"`);
          console.log(` Translation settings - Investigator: ${investigatorLanguage}, Participant: ${participantLanguage}`);

          setIsTranslating(true);
          setError(null);

          const investigatorLangCode = investigatorLanguage.split('-')[0];
          const participantLangCode = participantLanguage.split('-')[0];

          const { investigatorDisplay, participantDisplay, originalLanguage } = 
            await translationService.translateConversation(
              actualText,
              speaker,
              investigatorLangCode,
              participantLangCode
            );

          const newTranslation: TranslationResult = {
            id: translationService.generateId(),
            originalText: actualText,
            originalLanguage,
            speaker,
            investigatorDisplay,
            participantDisplay,
            timestamp: new Date(),
          };

          setTranslations(prev => {
            const updatedTranslations = [...prev, newTranslation];
            syncToLocalStorage(updatedTranslations);
            return updatedTranslations;
          });

          setProcessedSegmentIds(prev => new Set([...prev, segmentId]));
          
          console.log('Translation completed:', {
            speaker,
            originalText: actualText,
            investigatorSees: investigatorDisplay,
            participantSees: participantDisplay
          });
          
        } catch (err) {
          console.error('Translation failed for segment:', err);
          setError('Translation failed. Please try again.');
        } finally {
          setIsTranslating(false);
        }
      }
    };

    if (recordingStatus === "on") {
      processNewSegments();
    }
  }, [
    getTranscriptSegments, 
    recordingStatus, 
    investigatorLanguage, 
    participantLanguage, 
    syncToLocalStorage, 
    processedSegmentIds,
    currentPersonType
  ]);

  const addConversationTurn = useCallback(async () => {
    console.log('Translation is now automatic with real transcription');
  }, []);

  const clearConversation = useCallback(() => {
    setTranslations([]);
    syncToLocalStorage([]);
    console.log('Conversation and translations cleared');
  }, [syncToLocalStorage]);

  const saveTranslationsToS3 = useCallback(async () => {
    try {
      if (translations.length === 0) {
        console.log('⚠️ No translations to save');
        return;
      }

      const caseId = currentCase?.caseId || "";
      const sessionId = currentSession?.sessionId || currentCase?.caseId + "_" + crypto.randomUUID();

      console.log('📤 Saving translations to S3...', {
        caseId,
        sessionId,
        count: translations.length,
        investigatorLanguage,
        participantLanguage
      });

      await translationService.saveTranslations({
        caseId,
        sessionId,
        translations,
        metadata: {
          investigatorLanguage,
          participantLanguage,
          totalMessages: translations.length,
        }
      });

      console.log('Translations saved successfully to S3');
    } catch (error) {
      console.error('Failed to save translations to S3:', error);
    }
  }, [translations, investigatorLanguage, participantLanguage, currentCase, currentSession]);

  const value: TranslationContextType = {
    translations,
    addConversationTurn,
    clearConversation,
    isTranslating,
    error,
    hasMoreConversation: recordingStatus === "on",
    currentSpeaker: translations.length > 0 ? translations[translations.length - 1].speaker : null,
    investigatorLanguage,
    participantLanguage,
    setInvestigatorLanguage,
    setParticipantLanguage,
    saveTranslationsToS3,
  };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};