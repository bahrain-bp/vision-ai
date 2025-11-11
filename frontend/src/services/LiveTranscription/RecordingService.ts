import { RecordingStatus } from "../../types/";
import MicrophoneStream from "microphone-stream";
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from "@aws-sdk/client-transcribe-streaming";
import { getUserCredentials } from "../authService";
import {TranscribedWord,TranscriptionResult} from "../../types"
//import textField from "../LiveTranscription/TranscribeService"
import { LanguageCode } from "@aws-sdk/client-transcribe-streaming";


class RecordingService {
  private static instance: RecordingService;

  private recordingStatus: RecordingStatus = "off";

  private onAudioProcess: any | null = null;

  // The main audio context that manages the audio graph and processing
  private audioContext: AudioContext | null = null;

  private audioStream: MediaStream | null = null;

  private displayStream: MediaStream | null = null;

  private sampleRate: number = 48000;

  private transcriptCallback: ((text: TranscriptionResult) => void) | null =
    null;

  private constructor() {}

  static getInstance(): RecordingService {
    if (!RecordingService.instance) {
      RecordingService.instance = new RecordingService();
    }
    return RecordingService.instance;
  }

  //unused
  async combineAudioStreams(
    stream1: MediaStream,
    stream2: MediaStream
  ): Promise<MediaStream> {
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    // Create sources from both streams
    const source1 = this.audioContext.createMediaStreamSource(stream1);
    const source2 = this.audioContext.createMediaStreamSource(stream2);

    // Create a destination to mix the streams
    const destination = this.audioContext.createMediaStreamDestination();

    // Connect both sources to the destination
    source1.connect(destination);
    source2.connect(destination);

    return destination.stream;
  }

  async startRecording(
    onTranscriptUpdate?: (text: TranscriptionResult) => void,
    selectedLanguage?: string
  ): Promise<{
    success: boolean;
    displayStream?: MediaStream;
  }> {
    this.transcriptCallback = onTranscriptUpdate || null;

    if (this.recordingStatus === "on") return { success: false };

    try {
      this.displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: this.sampleRate,
        },
      });

      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      let transcribeClient: TranscribeStreamingClient;

      const session = await getUserCredentials();

      transcribeClient = new TranscribeStreamingClient({
        region: process.env.REACT_APP_AWS_REGION!,
        credentials: {
          accessKeyId: session!.credentials!.accessKeyId,
          secretAccessKey: session.credentials!.secretAccessKey,
          sessionToken: session!.credentials!.sessionToken,
        },
        //logger: console, // Debugging
      });

      /*
      // Debugging middleware - logs AWS SDK requests and responses

      transcribeClient.middlewareStack.add(
        (next: any, _: any) => async (args: any) => {
          console.log("AWS SDK Request:", args);
          const result = await next(args);
          console.log("AWS SDK Response:", result);
          return result;
        },
        { step: "initialize" }
      );
      
      */

      // Small Timeouts to ensure no race conditions

      await new Promise((resolve) => setTimeout(resolve, 2000));

      this.startTranscriptionStream(
        transcribeClient,
        this.audioStream,
        "microphone",
        this.sampleRate,
        selectedLanguage
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      this.startTranscriptionStream(
        transcribeClient,
        this.displayStream,
        "display",
        this.sampleRate,
        selectedLanguage
      );

      this.recordingStatus = "on";

      return { success: true, displayStream: this.displayStream };
    } catch (err) {
      console.error("Recording error:", err);
      this.recordingStatus = "off";
      return { success: false };
    }
  }

  async startTranscriptionStream(
    transcribeClient: TranscribeStreamingClient,
    stream: MediaStream,
    source: "display" | "microphone",
    SAMPLE_RATE: any,
    selectedLanguage?: String
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

    const microphoneStream = new MicrophoneStream();
    microphoneStream.setStream(stream);

    const getAudioStream = async function* () {
      for await (const chunk of microphoneStream) {
        if (chunk.length <= SAMPLE_RATE) {
          yield {
            AudioEvent: {
              AudioChunk: encodePCMChunk(chunk),
            },
          };
        }
      }
    };

    const command = new StartStreamTranscriptionCommand({
      LanguageCode: selectedLanguage
        ? (selectedLanguage as LanguageCode)
        : "en-US", 
      MediaEncoding: "pcm",
      MediaSampleRateHertz: SAMPLE_RATE,
      ShowSpeakerLabel: true,
      AudioStream: getAudioStream(),
    });
    let data;
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      data = await transcribeClient.send(command);
      console.log(`${source} transcription started successfully`);
    } catch (err: unknown) {
      /*
      //Debugging

      if (err instanceof Error) {
        console.group("🛑 Detailed Transcribe Error");

        // Basic info
        console.error("Message:", err.message);
        console.error("Stack:", err.stack);

        // Get all hidden and non-enumerable properties
        const allProps = JSON.stringify(
          err,
          Object.getOwnPropertyNames(err),
          2
        );
        console.error("Full Error Object:", allProps);

        // AWS SDK often attaches metadata here:
        const meta = (err as any).$metadata;
        if (meta) {
          console.error("AWS Metadata:", JSON.stringify(meta, null, 2));
        }

        // Sometimes the SDK error includes name/code
        console.error("Error Name:", (err as any).name);
        console.error("Error Code:", (err as any).code);

        console.groupEnd();
      } else {
        console.error("Unknown error type:", err);
      }
        */
      console.error(`${source} transcription error`, err);
    }

    if (!data?.TranscriptResultStream) return;

    for await (const event of data.TranscriptResultStream) {
      const results = event.TranscriptEvent?.Transcript?.Results;
      if (!results) continue;

      for (const result of results) {
        if (!result) return;
        if (!result.Alternatives) return;
        if (result.IsPartial) {
          //console.log(result); //debuging
        }

        if (!result.IsPartial && result.Alternatives?.length > 0) {
          const Items = result.Alternatives[0].Items;
          if (Items) {
            if (Items.length > 0) {
              const transcriptWords: TranscribedWord[] = Items.map(
                (item, index) => ({
                  id: index,
                  content: item.Content ?? "N/A",
                  confidence: item.Confidence ?? 0,
                  speaker: item.Speaker ?? "0",
                })
              );
              const speaker =
                source === "microphone" ? "Investigator" : "Witness";

              const fullDetailTranscript: TranscriptionResult = {
                words: transcriptWords,
                speaker,
                formattedTranscript:
                  `[${speaker}]: ` +
                  transcriptWords.map((item) => item.content).join(" ") +
                  `\n`,
              };
              if (this.transcriptCallback) {
                this.transcriptCallback(fullDetailTranscript);
              }
            }
          }
          /*
          const transcript = result.Alternatives[0]?.Transcript;

          if (transcript && this.transcriptCallback) {
            this.transcriptCallback(fullDetailTranscript);
          }
            */
        }
      }
    }
  }
  //To do later
  getAudioStatus(): {
    hasAudio: boolean;
    enabled: boolean;
    readyState?: string;
  } {
    return {
      hasAudio: true,
      enabled: true,
      readyState: "",
    };
  }

  stopRecording(): void {
    if (this.audioContext && this.onAudioProcess) {
      this.onAudioProcess = null;
    }

    if (this.displayStream) {
      this.displayStream.getTracks().forEach((track) => track.stop());
      this.displayStream = null;
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }

    this.recordingStatus = "off";
  }

  getRecordingStatus(): RecordingStatus {
    return this.recordingStatus;
  }

  getIsRecording(): boolean {
    return this.recordingStatus === "on" ? true : false;
  }
}

export default RecordingService.getInstance();
