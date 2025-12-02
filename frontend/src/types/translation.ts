import { TranslationResult } from "../services/LiveTranslation/TranslationService";

export interface SaveTranslationRequest {
  caseId: string;
  sessionId: string;
  translations: TranslationResult[];
  metadata?: {
    investigatorLanguage: string;
    witnessLanguage: string;
    totalMessages?: number;
    investigatorMessages?: number;
    witnessMessages?: number;
    [key: string]: any;
  };
}

export interface TranslationSettings {
  sourceLanguage: string;
  targetLanguage: string;
}