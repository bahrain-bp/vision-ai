export interface TranscribedWord {
  id: number;
  content: string;
  confidence: number; 
  speaker: string;
}

export interface TranscriptionResult {
  words: TranscribedWord[];
  speaker: string;
  formattedTranscript: string;
  timeStamp: string;
}

export type Sources = "display" | "microphone"|"both";

export type Speakers = "Investigator" | "Witness";

export type sessionType = "standard" | "multi";

export const getSpeakerFromSource = (source: Sources): Speakers => {
  return source === "microphone" ? "Investigator" : "Witness";
};

export interface StreamStatus {
  isActive: boolean;
  hasTracks: boolean;
  message: string;
  isEnabled: boolean;
}

export interface TranscriptionStatus {
  success: boolean;
  timestamp?: string;
  source?: Sources;
  error?: TranscriptionError;
}

export interface TranscriptionError {
  success: boolean;
  message: string;
  type?: ErrorType;
  rawError?: any;
}

export type ErrorType =
  | "auth"
  | "network"
  | "device"
  | "permission"
  | "service"
  | "unknown";

export const ErrorTypeLabels: Record<ErrorType, string> = {
  auth: "Authentication Error",
  network: "Network Connection Issue",
  device: "Device Problem",
  permission: "Permission Denied",
  service: "Service Unavailable",
  unknown: "Unexpected Error",
};



  export interface SaveTranscriptionRequest {
    caseId: string | undefined;
    sessionId: string;
    transcription: string;
    metadata?: {
      duration?: string;
      language?: string;
      participants?: string[];
      [key: string]: any;
    };
  }
