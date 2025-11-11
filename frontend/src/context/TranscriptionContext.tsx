import React, { createContext, useState, useCallback, ReactNode } from "react";
import RecordingService from "../services/LiveTranscription/RecordingService";
import { RecordingStatus } from "../types/";
import { TranscriptionResult } from "../types";

export interface TranscriptionContextType {
  audioStatus: boolean;
  recordingStatus: RecordingStatus;
  startRecording: (
    setSessionState?: (state: RecordingStatus) => void,
    onTranscriptUpdate?: (text: TranscriptionResult) => void,
    selectedLanguage?: string,
  ) => Promise<boolean>;
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
  const [audioStatus, setAudioStatus] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("off");
  const startRecording = useCallback(
    async (
      setSessionState?: (state: RecordingStatus) => void,
      onTranscriptUpdate?: (text: TranscriptionResult) => void,
      selectedLanguage?: string
    ) => {
      const result = await RecordingService.startRecording(
        onTranscriptUpdate,
        selectedLanguage
      );
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



  return (
    <TranscriptionContext.Provider
      value={{
        audioStatus,
        recordingStatus,
        startRecording,
        stopRecording,
      }}
    >
      {children}
    </TranscriptionContext.Provider>
  );
};
