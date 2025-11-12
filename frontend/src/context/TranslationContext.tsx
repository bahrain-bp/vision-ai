import React, { createContext, useState, useCallback, ReactNode } from "react";
import TranslationService from "../services/LiveTranslation/TranslationService";
import { TranslatedLine, TranslationStatus, TranslationConfig } from "../types/";

interface TranslationContextType {
  translatedLines: TranslatedLine[];
  translationStatus: TranslationStatus;
  translationConfig: TranslationConfig;
  translateText: (text: string, speaker?: string, timestamp?: string) => Promise<void>;
  translateMultiple: (texts: { text: string; speaker?: string; timestamp?: string }[]) => Promise<void>;
  addTranslatedLine: (line: TranslatedLine) => void;
  updateTranslationConfig: (config: Partial<TranslationConfig>) => void;
  clearTranslations: () => void;
  getTranslationStats: () => { total: number; languages: string };
}

// Create the context
export const TranslationContext = createContext<TranslationContextType | null>(null);

// Provider component
export const TranslationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [translatedLines, setTranslatedLines] = useState<TranslatedLine[]>([]);
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus>("idle");
  const [translationConfig, setTranslationConfig] = useState<TranslationConfig>({
    sourceLanguage: "auto",
    targetLanguage: "ar",
    autoTranslate: true,
  });

  // Translate single text
  const translateText = useCallback(async (text: string, speaker: string = "User", timestamp?: string) => {
    if (!text.trim()) return;

    const actualTimestamp = timestamp || new Date().toLocaleTimeString('en-US', { hour12: false });

    try {
      setTranslationStatus("translating");

      const result = await TranslationService.translateText(
        text,
        translationConfig.sourceLanguage,
        translationConfig.targetLanguage
      );

      const translatedLine: TranslatedLine = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        originalText: text,
        translatedText: result.translatedText,
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage,
        timestamp: actualTimestamp,
        speaker,
        confidence: result.confidence,
      };

      setTranslatedLines(prev => [...prev, translatedLine]);
      setTranslationStatus("completed");
    } catch (error) {
      console.error("Translation error:", error);
      setTranslationStatus("error");

      const errorLine: TranslatedLine = {
        id: `${Date.now()}-error`,
        originalText: text,
        translatedText: `[Error: ${error instanceof Error ? error.message : 'Translation failed'}]`,
        sourceLanguage: translationConfig.sourceLanguage,
        targetLanguage: translationConfig.targetLanguage,
        timestamp: actualTimestamp,
        speaker,
        confidence: 0,
      };

      setTranslatedLines(prev => [...prev, errorLine]);
    }
  }, [translationConfig]);

  // Translate multiple texts
  const translateMultiple = useCallback(async (texts: { text: string; speaker?: string; timestamp?: string }[]) => {
    if (texts.length === 0) return;

    try {
      setTranslationStatus("translating");

      const results = await TranslationService.translateMultiple(
        texts.map(t => t.text),
        translationConfig.sourceLanguage,
        translationConfig.targetLanguage
      );

      const newTranslatedLines: TranslatedLine[] = texts.map((textObj, index) => {
        const timestamp = textObj.timestamp || new Date().toLocaleTimeString('en-US', { hour12: false });

        return {
          id: `${timestamp}-${Date.now()}-${index}`,
          originalText: textObj.text,
          translatedText: results[index].translatedText,
          sourceLanguage: results[index].sourceLanguage,
          targetLanguage: results[index].targetLanguage,
          timestamp,
          speaker: textObj.speaker || "User",
          confidence: results[index].confidence || 0.95,
        };
      });

      setTranslatedLines(prev => [...prev, ...newTranslatedLines]);
      setTranslationStatus("completed");
    } catch (error) {
      console.error("Batch translation error:", error);
      setTranslationStatus("error");
    }
  }, [translationConfig]);

  const addTranslatedLine = useCallback((line: TranslatedLine) => {
    setTranslatedLines(prev => [...prev, line]);
  }, []);

  const updateTranslationConfig = useCallback((config: Partial<TranslationConfig>) => {
    setTranslationConfig(prev => ({ ...prev, ...config }));
  }, []);

  const clearTranslations = useCallback(() => {
    setTranslatedLines([]);
    setTranslationStatus("idle");
  }, []);

  const getTranslationStats = useCallback(() => {
    const total = translatedLines.length;
    const languages = `${translationConfig.sourceLanguage.toUpperCase()}→${translationConfig.targetLanguage.toUpperCase()}`;
    return { total, languages };
  }, [translatedLines.length, translationConfig]);

  return (
    <TranslationContext.Provider value={{
      translatedLines,
      translationStatus,
      translationConfig,
      translateText,
      translateMultiple,
      addTranslatedLine,
      updateTranslationConfig,
      clearTranslations,
      getTranslationStats
    }}>
      {children}
    </TranslationContext.Provider>
  );
};

export type { TranslationContextType };