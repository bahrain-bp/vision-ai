import React, { createContext, useState, useCallback, ReactNode, useEffect } from "react";
import { translationService, TranslationResult } from "../services/LiveTranslation/TranslationService";
import { useTranscription } from "../hooks/useTranscription";

export interface TranslationContextType {
  translations: TranslationResult[];
  addConversationTurn: () => Promise<void>;
  clearConversation: () => void;
  isTranslating: boolean;
  error: string | null;
  hasMoreConversation: boolean;
  currentSpeaker: string | null;
  investigatorLanguage: string;
  witnessLanguage: string;
  setInvestigatorLanguage: (language: string) => void;
  setWitnessLanguage: (language: string) => void;
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
  const [witnessLanguage, setWitnessLanguage] = useState(initialWitnessLanguage);
  
  // Get transcription data
  const { getFullTranscript, recordingStatus } = useTranscription();
  
  // Track processed content to avoid duplicates
  const [lastProcessedContent, setLastProcessedContent] = useState("");

  // Save data to localStorage for the witness view
  const syncToLocalStorage = useCallback((translationData: TranslationResult[]) => {
    try {
      const syncData = {
        translations: translationData,
        lastUpdated: new Date().toISOString(),
        investigatorLanguage,
        witnessLanguage
      };
      localStorage.setItem('vision-ai-translations', JSON.stringify(syncData));
    } catch (err) {
      console.error('Failed to sync to localStorage:', err);
    }
  }, [investigatorLanguage, witnessLanguage]);

  // Clean and extract speaker from the transcription text
  const extractSpeakerAndText = (content: string): { speaker: "Investigator" | "Witness"; text: string } => {
    console.log(` Raw transcription: "${content}"`);
    
    // Remove timestamp patterns 
    let cleanedContent = content.replace(/\[\d{2}:\d{2}:\d{2}\]/g, '').trim();
    
    console.log(` After timestamp removal: "${cleanedContent}"`);
    
    // Extract speaker - look for "Investigator:" or "Witness:" patterns
    if (cleanedContent.includes('Investigator:')) {
      const text = cleanedContent.split('Investigator:').pop()?.trim() || '';
      return {
        speaker: 'Investigator',
        text: text
      };
    } else if (cleanedContent.includes('Witness:')) {
      const text = cleanedContent.split('Witness:').pop()?.trim() || '';
      return {
        speaker: 'Witness',
        text: text
      };
    }
    
    // If no clear speaker, use alternating pattern
    const lastTranslation = translations[translations.length - 1];
    const fallbackSpeaker = lastTranslation?.speaker === "Investigator" ? "Witness" : "Investigator";
    
    console.warn(` No clear speaker found in: "${content}". Using fallback: ${fallbackSpeaker}`);
    
    return {
      speaker: fallbackSpeaker,
      text: cleanedContent
    };
  };

  // Listen to transcription changes and translate new content
  useEffect(() => {
    const processNewTranscription = async () => {
      if (!getFullTranscript || !recordingStatus || recordingStatus !== "on") {
        return;
      }

      const newContent = getFullTranscript.slice(lastProcessedContent.length).trim();
      
      if (!newContent) {
        return;
      }

      // Skip if this looks like duplicate or incomplete content
      if (newContent.length < 3 || newContent === lastProcessedContent) {
        return;
      }

      setIsTranslating(true);
      setError(null);

      try {
        console.log(` New transcription to process: "${newContent}"`);

        // Extract speaker and clean text
        const { speaker, text: actualText } = extractSpeakerAndText(newContent);

        // Skip if no actual text content after cleaning
        if (!actualText || actualText.length < 2) {
          console.log(' Skipping - no meaningful text after cleaning');
          return;
        }

        console.log(` Processing - Speaker: ${speaker}, Text: "${actualText}"`);
        console.log(`Translation settings - Investigator: ${investigatorLanguage}, Witness: ${witnessLanguage}`);

        // Convert language codes for AWS Translate
        const investigatorLangCode = investigatorLanguage.split('-')[0];
        const witnessLangCode = witnessLanguage.split('-')[0];

        const { investigatorDisplay, witnessDisplay, originalLanguage } = 
          await translationService.translateConversation(
            actualText,
            speaker,
            investigatorLangCode,
            witnessLangCode
          );

        const newTranslation: TranslationResult = {
          id: translationService.generateId(),
          originalText: actualText,
          originalLanguage,
          speaker,
          investigatorDisplay,
          witnessDisplay,
          timestamp: new Date(),
        };

        setTranslations(prev => {
          const updatedTranslations = [...prev, newTranslation];
          syncToLocalStorage(updatedTranslations);
          return updatedTranslations;
        });

        setLastProcessedContent(getFullTranscript);
        
        console.log(' Translation completed:', {
          speaker,
          originalText: actualText,
          investigatorSees: investigatorDisplay,
          witnessSees: witnessDisplay
        });
        
      } catch (err) {
        console.error(' Translation failed:', err);
        setError('Translation failed. Please try again.');
      } finally {
        setIsTranslating(false);
      }
    };

    if (recordingStatus === "on") {
      processNewTranscription();
    }
  }, [getFullTranscript, recordingStatus, lastProcessedContent, investigatorLanguage, witnessLanguage, syncToLocalStorage]);

  // Keep for backward compatibility
  const addConversationTurn = useCallback(async () => {
    console.log('Translation is now automatic with real transcription');
  }, []);

  const clearConversation = useCallback(() => {
    setTranslations([]);
    setLastProcessedContent("");
    syncToLocalStorage([]);
    console.log(' Conversation cleared');
  }, [syncToLocalStorage]);

  const value: TranslationContextType = {
    translations,
    addConversationTurn,
    clearConversation,
    isTranslating,
    error,
    hasMoreConversation: recordingStatus === "on",
    currentSpeaker: translations.length > 0 ? translations[translations.length - 1].speaker : null,
    investigatorLanguage,
    witnessLanguage,
    setInvestigatorLanguage,
    setWitnessLanguage
  };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};