class StreamManager {
  private readonly sampleRate: number = 48000;

  private audioStream: MediaStream | null = null;

  private displayStream: MediaStream | null = null;

  private static instance: StreamManager;

  constructor(){}

  static getInstance(): StreamManager {
    if (!StreamManager.instance) {
      StreamManager.instance = new StreamManager();
    }
    return StreamManager.instance;
  }

  async getDisplayStream(): Promise<{
    success: boolean;
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
            return { success: false, displayStream: null };
        }
    }
    return { success: true, displayStream: this.displayStream };
  }

  async getMicStream(): Promise<{
    success: boolean;
    audioStream: MediaStream | null;
  }> {
    if (this.audioStream === null) {
        try {
        this.audioStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        } catch (error) {
            console.error("Microphone recording error:", error);
            return { success: false, audioStream: null };
        }
    }
    return { success: true, audioStream: this.audioStream };
  }

  getSampleRate(){
    return this.sampleRate;
  }

  stopStreams(){
    if (this.displayStream) {
       this.displayStream.getTracks().forEach((track) => track.stop());
       this.displayStream = null;
    }

    if (this.audioStream) {
        this.audioStream.getTracks().forEach((track) => track.stop());
        this.audioStream = null;
    }
  }
}
export default StreamManager.getInstance();