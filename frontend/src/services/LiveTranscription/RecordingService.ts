import { RecordingStatus } from "../../types/";

class RecordingService {
  private static instance: RecordingService;
  private mediaStream: MediaStream | null = null;
  private recordingStatus: RecordingStatus = "off";

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
}

export default RecordingService.getInstance();
