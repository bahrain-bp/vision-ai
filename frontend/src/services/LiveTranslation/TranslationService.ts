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

// Custom error class to distinguish translation errors
export class TranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranslationError';
  }
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
      throw new TranslationError('Failed to initialize translation service');
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
      console.log(`🔄 Translating: "${text.substring(0, 50)}..." from ${sourceCode} to ${targetCode}`);
      
      const command = new TranslateTextCommand({
        Text: text,
        SourceLanguageCode: sourceCode,
        TargetLanguageCode: targetCode,
      });
      
      const response = await this.translateClient!.send(command);
      console.log(`✅ Translation successful`);
      
      return response.TranslatedText || text;
    } catch (error: any) {
      console.error('❌ Translation API error:', error);
      
      // Throw a custom error with a user-friendly message
      if (error.name === 'NetworkError' || error.message?.includes('network')) {
        throw new TranslationError('Translation service unavailable. Please check your internet connection.');
      } else if (error.name === 'CredentialsError') {
        throw new TranslationError('Authentication failed. Please refresh and try again.');
      } else {
        throw new TranslationError('Translation failed. Please try again.');
      }
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
    error?: string; // ✅ NEW: Include error in return
  }> {
    console.log(`\n🗣️ Processing: "${speaker}" says: "${originalText}"`);
    console.log(`🌐 Investigator lang: ${investigatorLanguage}, Participant lang: ${participantLanguage}`);

    let investigatorDisplay = originalText;
    let participantDisplay = originalText;
    let originalLanguage = 'auto';
    let errorMessage: string | undefined;

    try {
      if (speaker === "Investigator") {
        // Investigator spoke - translate for participant
        console.log(`👨‍⚖️ Translating for participant...`);
        participantDisplay = await this.translateText(
          originalText, 
          investigatorLanguage, 
          participantLanguage
        );
        console.log(`   ✅ Participant will see: "${participantDisplay.substring(0, 50)}..."`);
      } else {
        // Participant spoke - translate for investigator
        console.log(`🧑 Translating for investigator...`);
        investigatorDisplay = await this.translateText(
          originalText, 
          participantLanguage, 
          investigatorLanguage
        );
        console.log(`   ✅ Investigator will see: "${investigatorDisplay.substring(0, 50)}..."`);
      }
    } catch (error: any) {
      console.error('❌ translateConversation failed:', error);
      
      // ✅ Capture error message but continue with original text
      errorMessage = error instanceof TranslationError 
        ? error.message 
        : 'Translation failed. Please try again.';
      
      console.warn('⚠️ Displaying original text due to translation error');
    }

    // ✅ Always return result (with original text if translation failed)
    return {
      investigatorDisplay,
      participantDisplay,
      originalLanguage,
      error: errorMessage // ✅ Include error if it occurred
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