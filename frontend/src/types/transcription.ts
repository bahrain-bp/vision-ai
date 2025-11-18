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

export type Sources = "display" | "microphone";

export type Speakers = "Investigator" | "Witness";

export const getSpeakerFromSource = (source: Sources): Speakers => {
  return source === "microphone" ? "Investigator" : "Witness";
};

export interface StreamStatus {
  isActive: boolean;
  hasTracks: boolean;
  message: string;
  isEnabled: boolean;
}