import {
  TranscribeStreamingClient,
} from "@aws-sdk/client-transcribe-streaming";
import { getUserCredentials } from "../authService";

class TranscribeService {
  private client: TranscribeStreamingClient | null = null;
  private static instance: TranscribeService;
  private async initializeClient() {
    const session = await getUserCredentials();

    if (!session.credentials) {
      throw new Error("No credentials available. User must be signed in.");
    }
    
    this.client = new TranscribeStreamingClient({
      region: process.env.REACT_APP_AWS_REGION,
      credentials: session.credentials,
    });
  }

  async getClient() {
    if (this.client === null) {
      await this.initializeClient();
    }
    return this.client;
  }

  async startTranscription( data: any) {
    /*
    const client = await this.getClient();

    const command = new StartStreamTranscriptionCommand({
      LanguageCode: "en-US",
      MediaEncoding: "pcm",
      MediaSampleRateHertz: 16000,
      AudioStream: audioStreamGenerator(),
    });
*/
if (data.TranscriptResultStream === undefined) return;

for await (const event of data.TranscriptResultStream) {
  const results = event.TranscriptEvent?.Transcript?.Results;
  for (const result of results) {
    if (!result.IsPartial && result.Alternatives && result.Alternatives.length > 0) {
      const transcript = result.Alternatives[0]?.Transcript;
      if (transcript) {
        console.log('📝 Final:', transcript);
      }
    } else if (result.IsPartial && result.Alternatives && result.Alternatives.length > 0) {
      const transcript = result.Alternatives[0]?.Transcript;
      if (transcript) {
        console.log('⏳ Partial:', transcript);
      }
    }
  }
}
  }

  static getInstance(): TranscribeService {
    if (!TranscribeService.instance) {
      TranscribeService.instance = new TranscribeService();
    }
    return TranscribeService.instance;
  }
}
export default TranscribeService.getInstance();
