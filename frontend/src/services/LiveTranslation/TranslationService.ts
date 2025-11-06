// TranslationService.ts
class TranslationService {
  private static instance: TranslationService;
  private apiBaseUrl: string = process.env.REACT_APP_TRANSLATION_API_URL!;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  public static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }

  public static async translateText(
    text: string, 
    sourceLanguage: string, 
    targetLanguage: string
  ): Promise<{
    translatedText: string;
    sourceLanguage: string;
    targetLanguage: string;
    confidence?: number;
  }> {
    const instance = TranslationService.getInstance();
    
    try {
      console.log('Calling translation API:', `${instance.apiBaseUrl}/translate`);
      
      const response = await fetch(`${instance.apiBaseUrl}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          sourceLanguage,
          targetLanguage
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Translation failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Translation service error:', error);
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public static async translateMultiple(
    texts: string[], 
    sourceLanguage: string, 
    targetLanguage: string
  ): Promise<Array<{
    translatedText: string;
    sourceLanguage: string;
    targetLanguage: string;
    confidence?: number;
  }>> {
    const instance = TranslationService.getInstance();
    
    try {
      const response = await fetch(`${instance.apiBaseUrl}/translate-multiple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts,
          sourceLanguage,
          targetLanguage
        })
      });

      if (!response.ok) {
        throw new Error(`Batch translation failed: ${response.statusText}`);
      }

      const results = await response.json();
      return results;
    } catch (error) {
      console.error('Batch translation service error:', error);
      throw new Error(`Batch translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Health check for the translation API
  public static async healthCheck(): Promise<boolean> {
    const instance = TranslationService.getInstance();
    
    try {
      const response = await fetch(`${instance.apiBaseUrl}/health`, {
        method: 'GET'
      });
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  // Update API base URL (useful for testing)
  public setApiBaseUrl(url: string): void {
    this.apiBaseUrl = url;
  }

  // Get current API base URL
  public getApiBaseUrl(): string {
    return this.apiBaseUrl;
  }
}

export default TranslationService;