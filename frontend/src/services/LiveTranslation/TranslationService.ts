import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { getUserCredentials } from "../authService";

export type SpeakerType = "Investigator" | "Witness" | "Accused" | "Victim";

export interface TranslationResult {
  id: string;
  originalText: string;
  originalLanguage: string;
  speaker: SpeakerType;
  investigatorDisplay: string;
  participantDisplay: string;
  timestamp: Date;
}

export interface SaveTranslationRequest {
  caseId: string;
  sessionId: string;
  translations: TranslationResult[];
  metadata?: {
    investigatorLanguage: string;
    participantLanguage: string;
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
    
    // Extract language codes (e.g., "en-US" -> "en")
    const sourceCode = sourceLang.split('-')[0];
    const targetCode = targetLang.split('-')[0];
    
    if (sourceCode === targetCode || !text.trim()) return text;

    try {
      console.log(`🔄 Translating: "${text}" from ${sourceCode} to ${targetCode}`);
      const command = new TranslateTextCommand({
        Text: text,
        SourceLanguageCode: sourceCode,
        TargetLanguageCode: targetCode,
      });
      const response = await this.translateClient!.send(command);
      return response.TranslatedText || text;
    } catch (error) {
      console.error('✗ Translation error:', error);
      return text;
    }
  }

  async translateConversation(
    originalText: string,
    speaker: SpeakerType,
    investigatorLanguage: string,
    participantLanguage: string
  ): Promise<{
    investigatorDisplay: string;
    participantDisplay: string;
    originalLanguage: string;
  }> {
    console.log(`🗣️ Processing: "${speaker}" says: "${originalText}"`);
    console.log(`🌐 Translation setup - Investigator lang: ${investigatorLanguage}, Participant lang: ${participantLanguage}`);

    let investigatorDisplay = originalText;
    let participantDisplay = originalText;
    let originalLanguage = 'auto';

    if (speaker === "Investigator") {
      participantDisplay = await this.translateText(originalText, investigatorLanguage, participantLanguage);
      console.log(`   Participant sees (${participantLanguage}): "${participantDisplay}"`);
    } else {
      investigatorDisplay = await this.translateText(originalText, participantLanguage, investigatorLanguage);
      console.log(`    👮 Investigator sees (${investigatorLanguage}): "${investigatorDisplay}"`);
    }

    return {
      investigatorDisplay,
      participantDisplay,
      originalLanguage
    };
  }

  generateId(): string {
    return `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveTranslations(data: SaveTranslationRequest): Promise<any> {
    try {
      const endpoint = process.env.REACT_APP_API_ENDPOINT + "/translation/save";

      console.log('💾 Saving translations to S3...', {
        caseId: data.caseId,
        sessionId: data.sessionId,
        translationCount: data.translations.length,
        metadata: data.metadata
      });

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
      console.log("✅ Translations saved successfully:", result);
      return result;
    } catch (error) {
      console.error("❌ Error saving translations:", error);
      throw error;
    }
  }
}

export const translationService = new TranslationService();