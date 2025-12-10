import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { getUserCredentials } from "../authService";

export interface TranslationResult {
  id: string;
  originalText: string;
  originalLanguage: string;        // Language the speaker actually spoke in
  speaker: string;                 // "Investigator" or "Witness"
  // What each person sees
  investigatorDisplay: string;     // What investigator sees (translated if witness spoke)
  witnessDisplay: string;          // What witness sees (translated if investigator spoke)
  timestamp: Date;
}

export interface SaveTranslationRequest {
  caseId: string;
  sessionId: string;
  translations: TranslationResult[];
  metadata?: {
    investigatorLanguage: string;
    witnessLanguage: string;
    sessionDuration?: string;
    totalMessages?: number;
  };
}

class TranslationService {
  private translateClient: TranslateClient | null = null;

  async initializeClient() {
    try {
      const session = await getUserCredentials();
      this.translateClient = new TranslateClient({
        region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
        credentials: session.credentials
      });
      console.log('✓ Translate client initialized');
    } catch (error) {
      console.error('✗ Failed to initialize Translate client:', error);
    }
  }

  async translateText(
    text: string, 
    sourceLang: string, 
    targetLang: string
  ): Promise<string> {
    if (!this.translateClient) await this.initializeClient();
    if (sourceLang === targetLang || !text.trim()) return text;

    try {
      console.log(`🔄 Translating: "${text}" from ${sourceLang} to ${targetLang}`);
      const command = new TranslateTextCommand({
        Text: text,
        SourceLanguageCode: sourceLang,
        TargetLanguageCode: targetLang,
      });
      const response = await this.translateClient!.send(command);
      return response.TranslatedText || text;
    } catch (error) {
      console.error('✗ Translation error:', error);
      return text;
    }
  }

  // FIXED: Dynamic translation based on ANY selected languages
  async translateConversation(
    originalText: string,
    speaker: "Investigator" | "Witness",
    investigatorLanguage: string,
    witnessLanguage: string
  ): Promise<{
    investigatorDisplay: string;
    witnessDisplay: string;
    originalLanguage: string;
  }> {
    console.log(`🗣️ Processing: "${speaker}" says: "${originalText}"`);
    console.log(`🌐 Translation setup - Investigator lang: ${investigatorLanguage}, Witness lang: ${witnessLanguage}`);

    let investigatorDisplay = originalText;
    let witnessDisplay = originalText;
    let originalLanguage = 'auto'; // Let AWS detect the language

    if (speaker === "Investigator") {
      // Investigator speaks, Witness sees translation to witness language
      // Let AWS detect the source language automatically
      witnessDisplay = await this.translateText(originalText, 'auto', witnessLanguage);
      console.log(`   Witness sees (${witnessLanguage}): "${witnessDisplay}"`);
    } else if (speaker === "Witness") {
      // Witness speaks, Investigator sees translation to investigator language
      // Let AWS detect the source language automatically  
      investigatorDisplay = await this.translateText(originalText, 'auto', investigatorLanguage);
      console.log(`    👮 Investigator sees (${investigatorLanguage}): "${investigatorDisplay}"`);
    }

    return {
      investigatorDisplay,
      witnessDisplay,
      originalLanguage
    };
  }

  generateId(): string {
    return `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // NEW: Save translations to S3
  async saveTranslations(data: SaveTranslationRequest): Promise<any> {
    try {
      const endpoint = process.env.REACT_APP_API_ENDPOINT + "/translation/save";

      console.log(' Saving translations to S3...', {
        caseId: data.caseId,
        sessionId: data.sessionId,
        translationCount: data.translations.length,
        metadata: data.metadata
      });

      // Convert Date objects to ISO strings for JSON serialization
      const translationsWithStringDates = data.translations.map(trans => ({
        ...trans,
        timestamp: trans.timestamp.toISOString()
      }));

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caseId: data.caseId,
          sessionId: data.sessionId,
          translations: translationsWithStringDates,
          metadata: data.metadata
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Failed to save translations: ${response.status} - ${errorData.error || response.statusText}`
        );
      }

      const result = await response.json();
      console.log("Translations saved successfully:", result);
      return result;
    } catch (error) {
      console.error(" Error saving translations:", error);
      throw error;
    }
  }
}

export const translationService = new TranslationService();