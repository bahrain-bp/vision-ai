export interface TranslatedLine {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: string;
  speaker: string;
  confidence?: number;
}

export type TranslationStatus = "idle" | "translating" | "completed" | "error";

export interface TranslationConfig {
  sourceLanguage: string;
  targetLanguage: string;
  autoTranslate: boolean;
}

export interface TranslationResult {
  translatedText: string;
  confidence?: number;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface BatchTranslationResult {
  translations: TranslationResult[];
}