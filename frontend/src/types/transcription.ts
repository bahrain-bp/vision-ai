import {
  TranscribeStreamingClient,
} from "@aws-sdk/client-transcribe-streaming";
export interface TranscribedWord {
  id: number;
  content: string;
  confidence: number; 
  speaker: string;
}

export interface TranscriptionResult {
  words: TranscribedWord[];
  sentences: string;
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
  | "timeout"
  | "unknown";

export const ErrorTypeLabels: Record<ErrorType, string> = {
  auth: "Authentication Error",
  network: "Network Connection Issue",
  device: "Device Problem",
  permission: "Permission Denied",
  service: "Service Unavailable",
  timeout: "Session Timeout",
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
export interface LanguagePreferences {
  languageMode: "unified" | "separate";
  sharedLanguage: string ; // For unified mode
  investigatorLanguage: string; // For separate mode
  witnessLanguage: string; // For separate mode - single language
}


export interface sourceSettings {
  source: "display" | "microphone";
  transcribeClient: TranscribeStreamingClient;
  stream: MediaStream;
  maxAttempts: number;
  selectedLanguage?: string;
  speakerMode?: sessionType;
  detectionLanguages?: string;
}