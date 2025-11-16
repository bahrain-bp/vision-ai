import { RecordingStatus } from "../../types/";
import MicrophoneStream from "microphone-stream";
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from "@aws-sdk/client-transcribe-streaming";
import { getUserCredentials } from "../authService";
import {
  TranscribedWord,
  TranscriptionResult,
  getSpeakerFromSource,
  Speakers,
} from "../../types";
import { LanguageCode } from "@aws-sdk/client-transcribe-streaming";
import StreamManager from "./StreamManager";
import { StartStreamTranscriptionCommandOutput } from "@aws-sdk/client-transcribe-streaming";

class TranscribeService {
  private displayStatus: RecordingStatus = "off";

  private audioStatus: RecordingStatus = "off";

  private recordingStatus: RecordingStatus = "off";

  private mediaManager = StreamManager;
 
  private static instance: TranscribeService;

  private transcriptCallback: ((result: TranscriptionResult) => void) | null =
    null;

  constructor() {}


  static getInstance(): TranscribeService {
    if (!TranscribeService.instance) {
      TranscribeService.instance = new TranscribeService();
    }
    return TranscribeService.instance;
  }



  private async createTranscribeClient(): Promise<TranscribeStreamingClient> {
    const session = await getUserCredentials();

    return new TranscribeStreamingClient({
      region: process.env.REACT_APP_AWS_REGION!,
      credentials: {
        accessKeyId: session!.credentials!.accessKeyId,
        secretAccessKey: session.credentials!.secretAccessKey,
        sessionToken: session!.credentials!.sessionToken,
      },
    });
  }

  async startRecording(
    onTranscriptUpdate?: (text: TranscriptionResult) => void,
    selectedLanguage?: string
  ): Promise<{ success: boolean; message: String }> {
    this.transcriptCallback = onTranscriptUpdate || null;

    const display = await this.mediaManager.getDisplayStream();
    const audio = await this.mediaManager.getMicStream();

    if (display.displayStream === null || display.success === false)
      return { success: false, message: "Failed to start display stream" };
    if (audio.audioStream === null || audio.success === false)
      return { success: false, message: "Failed to start audio stream" };

    this.audioStatus = "on";
    this.displayStatus = "on";

    const transcribeClient: TranscribeStreamingClient =
      await this.createTranscribeClient();

     Promise.all([
      this.startTranscriptionStream(
        transcribeClient,
        audio.audioStream,
        "microphone",
        this.mediaManager.getSampleRate(),
        selectedLanguage
      ),

      this.startTranscriptionStream(
        transcribeClient,
        display.displayStream,
        "display",
        this.mediaManager.getSampleRate(),
        selectedLanguage
      ),
    ]);

    this.recordingStatus = "on";
    return { success: true, message: "Stream is running" };
  }

  private getAudioStream = async function* (
    microphoneStream: MicrophoneStream,
    sampleRate: Number
  ) {
    const encodePCMChunk = (chunk: any) => {
      const input = MicrophoneStream.toRaw(chunk);
      let offset = 0;
      const buffer = new ArrayBuffer(input.length * 2);
      const view = new DataView(buffer);
      for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }
      return Buffer.from(buffer);
    };

    for await (const chunk of microphoneStream) {
      if (chunk.length <= sampleRate) {
        yield {
          AudioEvent: {
            AudioChunk: encodePCMChunk(chunk),
          },
        };
      }
    }
  };

  async startTranscriptionStream(
    transcribeClient: TranscribeStreamingClient,
    stream: MediaStream,
    source: "display" | "microphone",
    sampleRate: number,
    selectedLanguage?: String
  ): Promise<{ success: boolean; message: String }> {
    
    const microphoneStream:MicrophoneStream = new MicrophoneStream();

    microphoneStream.setStream(stream);

const command: StartStreamTranscriptionCommand =
  new StartStreamTranscriptionCommand({
    LanguageCode:
      selectedLanguage === "auto"
        ? undefined
        : (selectedLanguage as LanguageCode),
    MediaEncoding: "pcm",
    MediaSampleRateHertz: sampleRate,
    IdentifyMultipleLanguages: selectedLanguage === "auto",
    LanguageOptions: selectedLanguage === "auto" ? "ar-SA,en-US" : undefined, 
    ShowSpeakerLabel: selectedLanguage !== "auto",
    AudioStream: this.getAudioStream(
      microphoneStream,
      this.mediaManager.getSampleRate()
    ),
  });

    const data: StartStreamTranscriptionCommandOutput = await transcribeClient.send(command);

    if (!data) {
        console.error(`${source} transcription: No response from AWS Transcribe`);
        return {
            success: false,
            message: "No response from transcription service",
        };
    }

    if (!data.TranscriptResultStream) {
      console.error(
        `${source} transcription: TranscriptResultStream is null or undefined`
      );
      return {
        success: false,
        message: "Failed to get transcription results stream",
      };
    }

    for await (const event of data.TranscriptResultStream) {
      const results = event.TranscriptEvent?.Transcript?.Results;

      if (!results) {
        continue;
      }

      for (const result of results) {
        if (!result || !result.Alternatives) {
         continue;
        }

        if (
          !result.IsPartial &&
          result.Alternatives &&
          result.Alternatives.length > 0
        ) {
          const Items = result.Alternatives[0]?.Items;
          if (!Items || Items.length === 0) {
            continue;
          }

          const transcriptWords: TranscribedWord[] = Items.map(
            (item, index) => ({
              id: index,
              content: item.Content ?? "N/A",
              confidence: item.Confidence ?? 0,
              speaker: item.Speaker ?? "0",
            })
          );
          
          const speaker: Speakers = getSpeakerFromSource(source);

            const timeStamp = new Date().toLocaleString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            });

            const fullDetailTranscript: TranscriptionResult = {
              words: transcriptWords,
              speaker,
              timeStamp: timeStamp,
              formattedTranscript:
                `[${timeStamp}] ${speaker}: ` +
                transcriptWords.map((item) => item.content).join(" ") +
                `\n\n`,
            };


          if (this.transcriptCallback) {
            this.transcriptCallback(fullDetailTranscript);
          }
        }
      }
    }

    return { success: true, message: `${source} stream is completed` };
  }

  stopRecording(): void {
    this.mediaManager.stopStreams();
    this.recordingStatus = "off";
  }

  getRecordingStatus(): RecordingStatus {
    return this.recordingStatus;
  }

  getIsRecording(): boolean {
    return this.recordingStatus === "on" ? true : false;
  }

  getDisplayStatus(): boolean {
    return this.displayStatus === "on" ? true : false;
  }
  getAudioStatus(): boolean {
    return this.audioStatus === "on" ? true : false;
  }
}

export default TranscribeService.getInstance();