import { RecordingStatus } from "../../types/";
import MicrophoneStream from "microphone-stream";
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from "@aws-sdk/client-transcribe-streaming";
import { getUserCredentials } from "../authService";
//import textField from "../LiveTranscription/TranscribeService"
class RecordingService {
  private static instance: RecordingService;
  private mediaStream: MediaStream | null = null;
  private recordingStatus: RecordingStatus = "off";
  private onAudioProcess: any | null = null;

  // The main audio context that manages the audio graph and processing
  private audioContext: AudioContext | null = null;

  // Represents the microphone or media stream input as an AudioNode
  // This allows the audio to be routed into the Web Audio API graph
  private source: MediaStreamAudioSourceNode | null = null;

  // ScriptProcessorNode allows access to raw audio data in JavaScript
  // Used to split audio into chunks and process them in real-time
  //private processor: ScriptProcessorNode | null = null;

  // Raw audio chunks as ArrayBuffer (16-bit PCM)
  //private audioChunks: ArrayBuffer[] = [];

  private audioStream: MediaStream | null = null;
  private displayStream: MediaStream | null = null;
  private transcriptCallback: ((text: string) => void) | null = null;
  private constructor() {}

  static getInstance(): RecordingService {
    if (!RecordingService.instance) {
      RecordingService.instance = new RecordingService();
    }
    return RecordingService.instance;
  }

  async combineAudioStreams(
    stream1: MediaStream,
    stream2: MediaStream
  ): Promise<MediaStream> {
    this.audioContext = new AudioContext({ sampleRate: 16000 });
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

  async startRecording(onTranscriptUpdate?: (text: string) => void): Promise<{
    success: boolean;
    displayStream?: MediaStream;
  }> {
    this.transcriptCallback = onTranscriptUpdate || null;
    const SAMPLE_RATE: any = 44100;

    if (this.recordingStatus === "on") return { success: false };

    try {
      this.recordingStatus = "on";

       this.displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: SAMPLE_RATE,
        },
      });
      //await new Promise((resolve) => setTimeout(resolve, 2000));

      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      /*
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        this.recordingStatus = "off";
        return { success: false };
      }
     
      this.mediaStream = stream;
      this.getAudioCapture(stream);
 */

      let transcribeClient1: any;
      //let transcribeClient2: any;
      const session = await getUserCredentials();

      transcribeClient1 = new TranscribeStreamingClient({
        region: process.env.REACT_APP_AWS_REGION!,
        credentials: {
          accessKeyId: session!.credentials!.accessKeyId,
          secretAccessKey: session.credentials!.secretAccessKey,
          sessionToken: session!.credentials!.sessionToken,
        },
        logger: console, // prints all SDK info to browser console
      });

      transcribeClient1.middlewareStack.add(
        (next: any, _: any) => async (args: any) => {
          console.log("AWS SDK Request:", args);
          const result = await next(args);
          console.log("AWS SDK Response:", result);
          return result;
        },
        { step: "initialize" }
      );
      /*  
      transcribeClient2 = new TranscribeStreamingClient({
           region: process.env.REACT_APP_AWS_REGION!,
           credentials: {
             accessKeyId: session!.credentials!.accessKeyId,
             secretAccessKey: session.credentials!.secretAccessKey,
             sessionToken: session!.credentials!.sessionToken,
           },
         });

      //console.log("Fetched credentials:", session.credentials);

      //const audioStreamTracks = new MediaStream(displayStream);

      /*
      const combinedStream = await this.combineAudioStreams(
        audioStreamTracks,
        displayStream
      );
      */
      // microphoneStream.setStream(combinedStream);

      /*
  const getAudioStream = async function* () {
      const chunk = await new Promise((resolve) => {
        (microphoneStream as any).on("data", (dataChunk: any) => {
          resolve(dataChunk);
        });
      });
      yield { AudioEvent: { AudioChunk: encodePCMChunk(chunk) } };
    
  };
  */
      await new Promise((resolve) => setTimeout(resolve, 2000));

      this.createTranscript(
        transcribeClient1,
        this.audioStream,
        "microphone",
        SAMPLE_RATE
      ).catch((err) => {
        console.error("Microphone failed:", err);
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      this.createTranscript(
        transcribeClient1,
        this.displayStream,
        "display",
        SAMPLE_RATE
      ).catch((err) => {
        console.error("Display failed:", err);
      });
      
      return { success: true, displayStream: this.displayStream  };
    } catch (err) {
      console.error("Recording error:", err);
      this.recordingStatus = "off";
      return { success: false };
    }
  }

  async createTranscript(
    transcribeClient: TranscribeStreamingClient,
    stream: MediaStream,
    source: "display" | "microphone",
    SAMPLE_RATE: any
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

    /*
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`[${source}] Timeout`));
      }, 2000);

      microphoneStream.once("data", () => {
        console.log(`[${source}] Audio ready`);
        clearTimeout(timeout);
        resolve();
      });
    });
*/
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
      LanguageCode: "en-US",
      MediaEncoding: "pcm",
      MediaSampleRateHertz: SAMPLE_RATE,
      ShowSpeakerLabel: true,
      AudioStream: getAudioStream(),
    });
    let data;
    try {
      data = await transcribeClient.send(command);
      console.log(`${source} transcription started successfully`);
    } catch (err: unknown) {
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
    }

    if (!data?.TranscriptResultStream) return;

    for await (const event of data.TranscriptResultStream) {
      const results = event.TranscriptEvent?.Transcript?.Results;
      if (!results) continue;

      for (const result of results) {
        if (!result) return;
        if (!result.Alternatives) return;
        if (result.IsPartial) {
          console.log(result); //debuging
        }
        if (!result.IsPartial && result.Alternatives?.length > 0) {
          const transcript = result.Alternatives[0]?.Transcript;
          if (transcript && this.transcriptCallback) {
            this.transcriptCallback(
              `[${
                source === "microphone" ? "Investigator" : "Witness"
              }]: ${transcript}\n`
            );
          }
        }
      }
    }
  }
  getAudioStatus(): {
    hasAudio: boolean;
    enabled: boolean;
    readyState?: string;
  } {
    if (!this.mediaStream) {
      return { hasAudio: false, enabled: false };
    }

    const audioTracks = this.mediaStream.getAudioTracks();

    if (audioTracks.length === 0) {
      return { hasAudio: false, enabled: false };
    }

    const track = audioTracks[0];
    return {
      hasAudio: true,
      enabled: track.enabled,
      readyState: track.readyState,
    };
  }

  stopRecording(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.onAudioProcess) {
      this.onAudioProcess = null;
      this.source?.disconnect();
      //this.processor?.disconnect();
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

  getStream(): MediaStream | null {
    return this.mediaStream;
  }
  getRecordingStatus(): RecordingStatus {
    return this.recordingStatus;
  }

  getIsRecording(): boolean {
    return this.recordingStatus === "on" ? true : false;
  }
  /*
  getAudioCapture(stream: MediaStream): void {
    //capture audio samples in 16kHz
    this.audioContext = new AudioContext({ sampleRate: 16000 });

    //convert stream audio to AudioNode so it can be used in the Web Audio API
    this.source = this.audioContext.createMediaStreamSource(stream);

    //Splits the audio into chunks of 4096 samples.
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.onAudioProcess = this.processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      // Convert to Int16Array (PCM format for AWS)
      const pcmData = new Int16Array(inputData.length);

      this.audioChunks.push(pcmData.buffer);

      //DeBug
      //console.log(this.audioChunks);
    };
    //Routes the raw audio to be processed
    this.source.connect(this.processor);

    //Connect audio processor to the audio output to be processed
    this.processor.connect(this.audioContext.destination);
  }
    */
}

export default RecordingService.getInstance();
