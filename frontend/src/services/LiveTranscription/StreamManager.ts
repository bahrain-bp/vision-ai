class StreamManager {
  private readonly sampleRate: number = 48000;

  private audioStream: MediaStream | null = null;

  private displayStream: MediaStream | null = null;

  private static instance: StreamManager;

  constructor() {}

  static getInstance(): StreamManager {
    if (!StreamManager.instance) {
      StreamManager.instance = new StreamManager();
    }
    return StreamManager.instance;
  }

  async getDisplayStream(): Promise<{
    success: boolean;
    error?: any;
    displayStream: MediaStream | null;
  }> {
    if (this.displayStream === null) {
      try {
        this.displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            sampleRate: this.sampleRate,
          },
        });
      } catch (error) {
        console.error("Display recording error:", error);
        return {
          success: false,
          error: error,
          displayStream: null,
        };
      }
    }
    return { success: true, displayStream: this.displayStream };
  }

  async getMicStream(): Promise<{
    success: boolean;
    error?: any;
    audioStream: MediaStream | null;
  }> {
    if (this.audioStream === null) {
      try {
        this.audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      } catch (error) {
        console.error("Microphone recording error:", error);
        return {
          success: false,
          error: error,
          audioStream: null,
        };
      }
    }
    return { success: true, audioStream: this.audioStream };
  }

  getSampleRate() {
    return this.sampleRate;
  }

  getAudioStreamStatus(): {
    isActive: boolean;
    hasAudioTracks: boolean;
    message: string;
  } {
    if (!this.audioStream) {
      return {
        isActive: false,
        hasAudioTracks: false,
        message: "Audio stream not initialized",
      };
    }

    const audioTracks = this.audioStream.getAudioTracks();
    const isActive = this.audioStream.active;
    const hasAudioTracks = audioTracks.length > 0;
    const allTracksEnabled = audioTracks.every(
      (track) => track.enabled && track.readyState === "live"
    );
    return {
      isActive,
      hasAudioTracks,
      message:
        isActive && hasAudioTracks && allTracksEnabled
          ? "Audio stream active and ready"
          : !isActive
          ? "Audio stream inactive"
          : !hasAudioTracks
          ? "No audio tracks available"
          : "Audio tracks present but not all enabled/live",
    };
  }

  getDisplayStreamStatus(): {
    isActive: boolean;
    hasVideoTracks: boolean;
    hasAudioTracks: boolean;
    message: string;
  } {
    if (!this.displayStream) {
      return {
        isActive: false,
        hasVideoTracks: false,
        hasAudioTracks: false,
        message: "Display stream not initialized",
      };
    }

    const videoTracks = this.displayStream.getVideoTracks();
    const audioTracks = this.displayStream.getAudioTracks();
    const isActive = this.displayStream.active;
    const hasVideoTracks = videoTracks.length > 0;
    const hasAudioTracks = audioTracks.length > 0;
    const allTracksLive = videoTracks.every(
      (track) => track.enabled && track.readyState === "live"
    );

    return {
      isActive,
      hasVideoTracks,
      hasAudioTracks,
      message:
        isActive && hasVideoTracks && allTracksLive
          ? hasAudioTracks
            ? "Display stream active with audio"
            : "Display stream active (no audio)"
          : !isActive
          ? "Display stream inactive"
          : !hasVideoTracks
          ? "No video tracks available"
          : "Video tracks present but not all enabled/live",
    };
  }

  stopStreams() {
    if (this.displayStream) {
      this.displayStream.getTracks().forEach((track) => track.stop());
      this.displayStream = null;
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }
  }

  pauseStreams(isPaused:boolean): void {
    
    if (this.displayStream) {
      this.displayStream.getAudioTracks().forEach((track) => {
        track.enabled = !isPaused;
      });
    }

    if (this.audioStream) {
      this.audioStream.getAudioTracks().forEach((track) => {
        track.enabled = !isPaused;
      });
    }
  }
}
export default StreamManager.getInstance();
