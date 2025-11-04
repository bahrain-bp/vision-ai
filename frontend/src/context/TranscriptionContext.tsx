import React, { createContext, useState, useCallback, ReactNode } from "react";
import RecordingService from "../services/LiveTranscription/RecordingService";
import { RecordingStatus } from "../types/";
import {TranscriptLine} from "../types"

export interface TranscriptionContextType {
  transcript: TranscriptLine[];
  audioStatus: boolean;
  recordingStatus: RecordingStatus;
  addLine: (line: TranscriptLine) => void;
  startRecording: (setSessionState?: (state: RecordingStatus) => void) => Promise<boolean>;
  stopRecording: (setSessionState?: (state: RecordingStatus) => void) => void; 
}

export const TranscriptionContext = createContext<
  TranscriptionContextType | undefined
>(undefined);

const updateStatuses = (
  setRecordingStatus: (state: RecordingStatus) => void,
  setAudioStatus: (state: boolean) => void,
  setSessionState?: (state: RecordingStatus) => void
) => {
  const newStatus = RecordingService.getRecordingStatus();
  const newAudioStatus = RecordingService.getAudioStatus().hasAudio;

  setRecordingStatus(newStatus);
  setAudioStatus(newAudioStatus);

  if (setSessionState) {
    setSessionState(newStatus);
  }
};


export const TranscriptionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [audioStatus, setAudioStatus] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("off");
  const startRecording = useCallback(
    async (setSessionState?: (state: RecordingStatus) => void) => {
      const result = await RecordingService.startRecording();

      if (result.success) {
        updateStatuses(setRecordingStatus, setAudioStatus, setSessionState);
        return true;
      }
      return false;
    },
    []
  );

  const stopRecording = useCallback(
    (setSessionState?: (state: RecordingStatus) => void) => {
      RecordingService.stopRecording();
      updateStatuses(setRecordingStatus, setAudioStatus, setSessionState);
    },
    []
  );

  const addLine = useCallback((line: TranscriptLine) => {
    setTranscript((prev) => [...prev, line]);
  }, []);


  return (
    <TranscriptionContext.Provider
      value={{
        transcript,
        audioStatus,
        recordingStatus,
        addLine,
        startRecording,
        stopRecording,
      }}
    >
      {children}
    </TranscriptionContext.Provider>
  );
};
