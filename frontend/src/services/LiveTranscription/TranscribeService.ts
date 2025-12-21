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
  SessionType,
  SaveTranscriptionRequest,
  LanguagePreferences,
  SourceSettings,
  Sources,
} from "../../types";
import { LanguageCode } from "@aws-sdk/client-transcribe-streaming";
import StreamManager from "./StreamManager";
import { StartStreamTranscriptionCommandOutput } from "@aws-sdk/client-transcribe-streaming";


class TranscribeService {
  private displayStatus: RecordingStatus = "off";

  private audioStatus: RecordingStatus = "off";

  private recordingStatus: RecordingStatus = "off";

  private mediaManager = StreamManager;

  private readonly microphoneAttempts: number = 8;

  private readonly displayAttempts: number = 8;

  private transcribeClient: TranscribeStreamingClient | null = null;

  private micSettings: SourceSettings | null = null;

  private displaySettings: SourceSettings | null = null;

  private transcriptCallback: ((result: TranscriptionResult) => void) | null =
    null;

  private participantType: string = "Witness";

  private micAbortController: AbortController | null = null;
  private displayAbortController: AbortController | null = null;

  private static instance: TranscribeService;

  private constructor() {}

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
    sessionType?: SessionType,
    detectionLanguages?: string
  ): Promise<TranscriptionStatus> {
    this.transcriptCallback = onTranscriptUpdate || null;

    // Capture display and microphone streams
    const display = await this.mediaManager.getDisplayStream();
    const audio = await this.mediaManager.getMicStream();

    // Validate display stream exists
    if (display.displayStream === null || display.success === false) {
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
    }

    // Validate display stream has audio tracks
    if (!this.mediaManager.getDisplayStreamStatus().hasAudioTracks) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        source: "display",
        error: {
          success: false,
          type: "device",
          message:
            "Please enable 'Share system audio' when selecting your screen.",
          rawError: audio.error,
        },
      };
    }

    // Validate microphone stream exists
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

    this.audioStatus = "on";
    this.displayStatus = "on";

    // Initialize AWS Transcribe client with authentication
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

    // Configure microphone connection settings
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

    // Attempt microphone connection with retry logic
    const micResult = await this.attemptConnection(this.micSettings);

    if (!micResult.success) {
      this.mediaManager.stopStreams();
      return {
        success: false,
        timestamp: new Date().toISOString(),
        source: "microphone",
        error: micResult,
      };
    }

    // Configure display connection settings
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

    // Attempt display connection with retry logic
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
    settings: SourceSettings
  ): Promise<TranscriptionError> {
    let attempts = settings.maxAttempts;
    let connected = false;
    let result: TranscriptionError = {
      success: false,
      message: "No attempts made",
    };

    // Retry connection until successful or attempts exhausted
    while (attempts > 0 && !connected) {
      result = await this.startTranscriptionStream(
        settings.transcribeClient,
        settings.stream,
        settings.source,
        this.mediaManager.getSampleRate(),
        settings.selectedLanguage,
        settings.speakerMode,
        settings.detectionLanguages
      );

      connected = result.success;

      // Wait 1 second before retry on failure
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

  // Generator function that streams audio chunks to AWS Transcribe
  private async *getAudioStream(
    microphoneStream: MicrophoneStream,
    sampleRate: number
  ) {
    // Convert float audio samples to 16-bit PCM format
    const encodePCMChunk = (chunk: any) => {
      const input = MicrophoneStream.toRaw(chunk);
      let offset = 0;
      const buffer = new ArrayBuffer(input.length * 2);
      const view = new DataView(buffer);

      // Convert each float sample to 16-bit integer
      for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i])); // Clamp to [-1, 1]
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }
      return Buffer.from(buffer);
    };

    // Stream audio chunks as they arrive
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
    source: Sources,
    sampleRate: number,
    selectedLanguage?: string,
    speakerMode?: SessionType,
    detectionLanguages?: string
  ): Promise<TranscriptionError> {
    // Initialize audio stream processor for PCM conversion
    const microphoneStream: MicrophoneStream = new MicrophoneStream();
    if (source === "microphone") {
      this.micAbortController = new AbortController();
    } else {
      this.displayAbortController = new AbortController();
    }
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

    // Configure AWS Transcribe command based on language mode
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
            ? detectionLanguages // User-specified languages
            : selectedLanguage === "auto"
            ? "ar-SA,en-US,hi-IN,fr-FR,es-ES,de-DE,pt-BR,zh-CN,ja-JP,ko-KR" // Default fallback
            : undefined,
        ShowSpeakerLabel: source === "display" && speakerMode === "multi",
        AudioStream: this.getAudioStream(microphoneStream, sampleRate),
      });
    try {
      // Send connection request to AWS Transcribe
      const data: StartStreamTranscriptionCommandOutput =
        await transcribeClient.send(command, {
          abortSignal:
            source === "microphone"
              ? this.micAbortController?.signal
              : this.displayAbortController?.signal,
        });

      // Validate response contains transcript stream
      if (!data || !data.TranscriptResultStream) {
        return {
          success: false,
          type: "service",
          message: "Transcription service unavailable. Please try again later.",
        };
      }

      // Begin processing incoming transcription events
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
    stream: AsyncIterable<any>,
    source: Sources,
    speakerMode?: SessionType
  ) {
    try {
      for await (const event of stream) {
        let results = event.TranscriptEvent?.Transcript?.Results;

        // Skip processing if recording is paused
        if (this.recordingStatus === "paused") continue;
        if (!results) continue;

        for (const result of results) {
          // Skip partial results (wait for finalized transcription)
          if (!result?.Alternatives || result.IsPartial) continue;

          const Items = result.Alternatives[0]?.Items;
          if (!Items || Items.length === 0) continue;

          // Extract words with confidence scores from AWS response
          const transcriptWords: TranscribedWord[] = Items.map(
            (item: any, index: any) => ({
              id: index,
              content: item.Content ?? "N/A",
              confidence: item.Confidence ?? 0,
              speaker: item.Speaker ?? "0",
            })
          );

          // Assign speaker labels based on audio source and session type
          let speaker: string;
          if (source === "microphone") {
            speaker = "Investigator";
          } else {
            // Display audio handling
            if (speakerMode === "standard") {
              speaker = this.participantType ?? "Witness";
            } else {
              // Multi-participant mode: use AWS speaker labels
              const awsSpeakerLabel = transcriptWords[0]?.speaker || "0";
              speaker = `${
                this.participantType ?? "Speaker"
              } ${awsSpeakerLabel}`;
            }
          }

          const timeStamp = new Date().toLocaleString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          });

          // Build complete transcription result with metrics
          const fullDetailTranscript: TranscriptionResult = {
            words: transcriptWords,
            sentences: transcriptWords.map((item) => item.content).join(" "),
            speaker,
            timeStamp: timeStamp,
            avgWitnessConfidenceLevel:
              speaker !== "Investigator"
                ? transcriptWords.reduce(
                    (prev, word) => prev + (word.confidence || 0),
                    0
                  ) / transcriptWords.length
                : 0,
            witnessWordCount:
              speaker !== "Investigator" ? transcriptWords.length : 0,
            investigatorWordCount:
              speaker === "Investigator" ? transcriptWords.length : 0,
            formattedTranscript:
              `[${timeStamp}] ${speaker}: ` +
              transcriptWords
                .map((item) => item.content)
                .join(" ")
                .trim() +
              `\n`,
          };

          // Send transcript to callback for UI update
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
      //console.log("Transcription saved:", result);
      return result;
    } catch (error) {
      console.error("Error saving transcription:", error);
      throw error;
    }
  }
  setPersonType(personType: string) {
    this.participantType = personType;
  }

  stopRecording(): void {
    this.micAbortController?.abort();
    this.displayAbortController?.abort();
    this.mediaManager.stopStreams();
    this.recordingStatus = "off";
  }

  toggleRecordingPause(isPaused: boolean): void {
    this.recordingStatus = isPaused ? "paused" : "on";
  }

  getRecordingStatus(): RecordingStatus {
    return this.recordingStatus;
  }

  isRecording(): boolean {
    return this.recordingStatus === "on";
  }

  isDisplayActive(): boolean {
    return this.displayStatus === "on";
  }

  isAudioActive(): boolean {
    return this.audioStatus === "on";
  }
}

export default TranscribeService.getInstance();