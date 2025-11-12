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
}
