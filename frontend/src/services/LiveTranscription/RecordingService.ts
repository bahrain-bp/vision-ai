import { RecordingStatus } from "../../types/";

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
  private processor: ScriptProcessorNode | null = null;

  // Raw audio chunks as ArrayBuffer (16-bit PCM)
  private audioChunks: ArrayBuffer[] = [];

  private constructor() {}

  static getInstance(): RecordingService {
    if (!RecordingService.instance) {
      RecordingService.instance = new RecordingService();
    }
    return RecordingService.instance;
  }

  async startRecording(): Promise<{ success: boolean; stream?: MediaStream }> {
    if (this.recordingStatus === "on") return { success: false };

    try {
      this.recordingStatus = "on";

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 16000,
        },
      });

      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        this.recordingStatus = "off";
        return { success: false };
      }

      this.mediaStream = stream;
      this.getAudioCapture(stream);
      return { success: true, stream };
    } catch (err) {
      console.error("Recording error:", err);
      this.recordingStatus = "off";
      return { success: false };
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
      this.processor?.disconnect();
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
}

export default RecordingService.getInstance();
