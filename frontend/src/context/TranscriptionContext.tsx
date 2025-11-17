import React, {
  createContext,
  useState,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import { RecordingStatus } from "../types/";
import { TranscriptionResult } from "../types";
import TranscribeService from "../services/LiveTranscription/TranscribeService";

export interface TranscriptionContextType {
  audioStatus: boolean;
  recordingStatus: RecordingStatus;
  startRecording: (
    setSessionState?: (state: RecordingStatus) => void,
    onTranscriptUpdate?: (text: TranscriptionResult) => void,
    selectedLanguage?: string
  ) => Promise<boolean>;
  stopRecording: (setSessionState?: (state: RecordingStatus) => void) => void;
}

export const TranscriptionContext = createContext<
  TranscriptionContextType | undefined
>(undefined);

export const TranscriptionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [audioStatus, setAudioStatus] = useState(false);
  const [recordingStatus, setRecordingStatus] =
    useState<RecordingStatus>("off");
  const isStartingRef = useRef(false);

  const startRecording = useCallback(
    async (
      setSessionState?: (state: RecordingStatus) => void,
      onTranscriptUpdate?: (text: TranscriptionResult) => void,
      selectedLanguage?: string
    ) => {
      if (isStartingRef.current) {
        return false;
      }

      isStartingRef.current = true;

      try {
        const result = await TranscribeService.startRecording(
          onTranscriptUpdate,
          selectedLanguage
        );

        if (result.success) {
          const newStatus = TranscribeService.getRecordingStatus();
          const newAudioStatus = TranscribeService.getAudioStatus();

          setRecordingStatus(newStatus);
          setAudioStatus(newAudioStatus);

          if (setSessionState) {
            setSessionState(newStatus);
          }
          return true;
        }
        return false;
      } finally {
        isStartingRef.current = false;
      }
    },
    []
  );

  const stopRecording = useCallback(
    (setSessionState?: (state: RecordingStatus) => void) => {
      TranscribeService.stopRecording();

      const newStatus = TranscribeService.getRecordingStatus();
      const newAudioStatus = TranscribeService.getAudioStatus();

      setRecordingStatus(newStatus);
      setAudioStatus(newAudioStatus);

      if (setSessionState) {
        setSessionState(newStatus);
      }
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
