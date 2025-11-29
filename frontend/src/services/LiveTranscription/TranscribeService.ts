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
  //getSpeakerFromSource,
  //Speakers,
  TranscriptionStatus,
  TranscriptionError,
  sessionType,
  SaveTranscriptionRequest,
  LanguagePreferences,
  sourceSettings,
} from "../../types";
import { LanguageCode } from "@aws-sdk/client-transcribe-streaming";
import StreamManager from "./StreamManager";
import { StartStreamTranscriptionCommandOutput } from "@aws-sdk/client-transcribe-streaming";


class TranscribeService {
  private displayStatus: RecordingStatus = "off";

  private audioStatus: RecordingStatus = "off";

  private recordingStatus: RecordingStatus = "off";

  private mediaManager = StreamManager;

  private microphoneAttempts: number = 15;

  private displayAttempts: number = 15;

  private transcribeClient: TranscribeStreamingClient | null = null;

  private micSettings: sourceSettings | null = null;

  private displaySettings: sourceSettings | null = null;

  private transcriptCallback: ((result: TranscriptionResult) => void) | null =
    null;

  private static instance: TranscribeService;

  constructor() {}

  static getInstance(): TranscribeService {
    if (!TranscribeService.instance) {
      TranscribeService.instance = new TranscribeService();
    }
    return TranscribeService.instance;
  }

  private async createTranscribeClient(): Promise<TranscribeStreamingClient> {
    try {
      const session = await getUserCredentials();

      if (!session || !session.credentials) {
        throw new Error("Failed to get user credentials");
      }

      return new TranscribeStreamingClient({
        region: process.env.REACT_APP_AWS_REGION!,
        credentials: {
          accessKeyId: session.credentials.accessKeyId,
          secretAccessKey: session.credentials.secretAccessKey,
          sessionToken: session.credentials.sessionToken,
        },
      });
    } catch (error) {
      console.error("Failed to create Transcribe client:", error);
      throw error;
    }
  }

  async startRecording(
    onTranscriptUpdate?: (text: TranscriptionResult) => void,
    languagePreferences?: LanguagePreferences,
    sessionType?: sessionType,
    detectionLanguages?: string
  ): Promise<TranscriptionStatus> {
    this.transcriptCallback = onTranscriptUpdate || null;

    const display = await this.mediaManager.getDisplayStream();
    const audio = await this.mediaManager.getMicStream();

    if (display.displayStream === null || display.success === false)
      return {
        success: false,
        timestamp: new Date().toISOString(),
        source: "display",
        error: {
          success: false,
          type: "device",
          message:
            "Unable to capture your screen. Please try selecting the window again.",
          rawError: display.error,
        },
      };
    if (audio.audioStream === null || audio.success === false)
      return {
        success: false,
        timestamp: new Date().toISOString(),
        source: "microphone",
        error: {
          success: false,
          message: "Microphone not detected. Please check your device settings",
          rawError: audio.error,
        },
      };

    if (!this.mediaManager.getDisplayStreamStatus().hasAudioTracks) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        source: "microphone",
        error: {
          success: false,
          type: "device",
          message:
            "Please enable 'Share system audio' when selecting your screen.",
          rawError: audio.error,
        },
      };
    }

    this.audioStatus = "on";
    this.displayStatus = "on";

    try {
      this.transcribeClient = await this.createTranscribeClient();
    } catch (error) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        source: "both",
        error: {
          success: false,
          type: "auth",
          message: "Authentication failed. Please log in again.",
          rawError: error instanceof Error ? error.message : String(error),
        },
      };
    }

    this.micSettings = {
      source: "microphone",
      transcribeClient: this.transcribeClient,
      stream: audio.audioStream,
      maxAttempts: this.microphoneAttempts,
      selectedLanguage:
        languagePreferences?.languageMode === "unified"
          ? languagePreferences.sharedLanguage
          : languagePreferences?.investigatorLanguage,
      speakerMode: "standard",
      detectionLanguages: detectionLanguages,
    };

    const micResult = await this.attemptConnection(this.micSettings);

    if (!micResult.success) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        source: "microphone",
        error: micResult,
      };
    }

    this.displaySettings = {
      source: "display",
      transcribeClient: this.transcribeClient,
      stream: display.displayStream,
      maxAttempts: this.displayAttempts,
      selectedLanguage:
        languagePreferences?.languageMode === "unified"
          ? languagePreferences.sharedLanguage
          : languagePreferences?.witnessLanguage,
      speakerMode: sessionType,
      detectionLanguages: detectionLanguages,
    };

    const displayResult = await this.attemptConnection(this.displaySettings);

    if (!displayResult.success) {
      this.mediaManager.stopStreams();
      return {
        success: false,
        timestamp: new Date().toISOString(),
        source: "display",
        error: displayResult,
      };
    }

    this.recordingStatus = "on";
    return { success: true };
  }

  async attemptConnection(
    settings: sourceSettings
  ): Promise<TranscriptionError> {
    let attempts = settings.maxAttempts;

    let connected = false;

    let result: TranscriptionError = {
      success: false,
      message: "No attempts made",
    };

    while (attempts > 0 && !connected) {
      console.log(
        `${settings.source} attempt ${settings.maxAttempts - attempts + 1}/${
          settings.maxAttempts
        }`
      );

      result = await this.startTranscriptionStream(
        settings.transcribeClient,
        settings.stream,
        settings.source,
        this.mediaManager.getSampleRate(),
        settings.selectedLanguage,
        settings.speakerMode,
        settings.detectionLanguages
      );

      console.log(`📊 Result:`, result);

      connected = result.success;

      if (!connected) {
        attempts--;
        if (attempts > 0) {
          console.log(`Retrying... (${attempts} left)`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
    return connected
      ? { success: true, message: `${settings.source} connected` }
      : {
          success: false,
          type: "network",
          message:
            result.message ||
            (settings.source === "microphone"
              ? "Unable to connect microphone to transcription service. Please try again."
              : "Unable to connect screen audio to transcription service. Please try again."),
          rawError: result.rawError,
        };
  }

  private async *getAudioStream(
    microphoneStream: MicrophoneStream,
    sampleRate: number
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
  }

  private async startTranscriptionStream(
    transcribeClient: TranscribeStreamingClient,
    stream: MediaStream,
    source: "display" | "microphone",
    sampleRate: number,
    selectedLanguage?: String,
    speakerMode?: sessionType,
    detectionLanguages?: string
  ): Promise<TranscriptionError> {
    const microphoneStream: MicrophoneStream = new MicrophoneStream();

    try {
      microphoneStream.setStream(stream);
    } catch (error) {
      console.error(`${source}: Failed to initialize stream`, error);
      return {
        success: false,
        type: "device",
        message:
          "Failed to process audio stream. Please refresh and try again.",
        rawError: error instanceof Error ? error.message : String(error),
      };
    }

    const command: StartStreamTranscriptionCommand =
      new StartStreamTranscriptionCommand({
        LanguageCode:
          selectedLanguage === "auto"
            ? undefined
            : (selectedLanguage as LanguageCode),
        MediaEncoding: "pcm",
        MediaSampleRateHertz: sampleRate,
        IdentifyMultipleLanguages: selectedLanguage === "auto",
        LanguageOptions:
          selectedLanguage === "auto" &&
          detectionLanguages &&
          detectionLanguages.length > 0
            ? detectionLanguages
            : selectedLanguage === "auto"
            ? "ar-SA,en-US,fr-FR,es-ES,de-DE,hi-IN,pt-BR,zh-CN,ja-JP,ko-KR"
            : undefined,
        ShowSpeakerLabel: source === "display" && speakerMode === "multi",
        AudioStream: this.getAudioStream(microphoneStream, sampleRate),
      });

    try {
      const data: StartStreamTranscriptionCommandOutput =
        await transcribeClient.send(command);

      if (!data || !data.TranscriptResultStream) {
        return {
          success: false,
          type: "service",
          message: "Transcription service unavailable. Please try again later.",
        };
      }

      this.processStream(data.TranscriptResultStream, source, speakerMode);

      return { success: true, message: `${source} connected` };
    } catch (error) {
      console.error(`${source}: Connection failed`, error);
      return {
        success: false,
        type: "network",
        message:
          "Connection to transcription service lost. Check your internet connection and try again.",
        rawError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async processStream(
    stream: any,
    source: "display" | "microphone",
    speakerMode?: sessionType
  ) {
    try {
      for await (const event of stream) {
        let results = event.TranscriptEvent?.Transcript?.Results;
        if (this.recordingStatus === "paused") {
          continue;
        }
        if (!results) continue;

        for (const result of results) {
          if (!result?.Alternatives || result.IsPartial) continue;
          //console.log("Partial ", result);
          const Items = result.Alternatives[0]?.Items;
          if (!Items || Items.length === 0) continue;

          const transcriptWords: TranscribedWord[] = Items.map(
            (item: any, index: any) => ({
              id: index,
              content: item.Content ?? "N/A",
              confidence: item.Confidence ?? 0,
              speaker: item.Speaker ?? "0",
            })
          );
          // Determine speaker label based on mode
          let speaker: string;

          if (source === "microphone") {
            speaker = "Investigator";
          } else {
            // Display audio
            if (speakerMode === "standard") {
              speaker = "Witness";
            } else {
              const awsSpeakerLabel = transcriptWords[0]?.speaker || "0";
              speaker = `Speaker ${awsSpeakerLabel}`;
            }
          }

          //const speaker: Speakers = getSpeakerFromSource(source);
          const timeStamp = new Date().toLocaleString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          });

          const fullDetailTranscript: TranscriptionResult = {
            words: transcriptWords,
            sentences: transcriptWords.map((item) => item.content).join(" "),
            speaker,
            timeStamp: timeStamp,
            formattedTranscript:
              `[${timeStamp}] ${speaker}: ` +
              transcriptWords
                .map((item) => item.content)
                .join(" ")
                .trim() +
              `\n`,
          };

          if (this.transcriptCallback) {
            this.transcriptCallback(fullDetailTranscript);
          }
        }
      }
    } catch (error) {
      console.error(`${source}: Stream processing error`, error);
    }
  }
  async saveTranscription(data: SaveTranscriptionRequest) {
    try {
      const endPoint =
        process.env.REACT_APP_API_ENDPOINT + "/transcription/save";

      const response = await fetch(endPoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to save transcription: ${response.status}`);
      }

      const result = await response.json();
      console.log("Transcription saved:", result);
      return result;
    } catch (error) {
      console.error("Error saving transcription:", error);
      throw error;
    }
  }

  stopRecording(): void {
    this.mediaManager.stopStreams();
    this.recordingStatus = "off";
  }
  toggleRecordingPause(isPaused: boolean) {
    this.recordingStatus = isPaused ? "paused" : "on";
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