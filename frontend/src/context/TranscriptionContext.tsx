import React, {
  createContext,
  useState,
  useCallback,
  ReactNode,
  useRef,
  useEffect,
} from "react";
import { RecordingStatus, sessionType,SaveTranscriptionRequest } from "../types/";
import { TranscriptionResult,TranscriptionStatus } from "../types";
import TranscribeService from "../services/LiveTranscription/TranscribeService";
import StreamManager from "../services/LiveTranscription/StreamManager";
import {useCaseContext} from "../hooks/useCaseContext"
export interface TranscriptionContextType {
  audioStatus: boolean;
  recordingStatus: RecordingStatus;
  startRecording: (
    setSessionState?: (state: RecordingStatus) => void,
    selectedLanguage?: string,
    sessionType?: sessionType,
    detectionLanguages?: string
  ) => Promise<TranscriptionStatus>;
  stopRecording: (setSessionState?: (state: RecordingStatus) => void) => void;
  getFullTranscript: string;
}

export const TranscriptionContext = createContext<
  TranscriptionContextType | undefined
>(undefined);

export const TranscriptionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [audioStatus, setAudioStatus] = useState(false);
  const [onTranscriptUpdate, setTranscriptUpdate] = useState<TranscriptionResult | null>(null);
  const [fullTranscript, setFullTranscript] = useState<string>("");

  const [recordingStatus, setRecordingStatus] =
    useState<RecordingStatus>("off");
  const isStartingRef = useRef(false);

  const { currentCase,currentSession } = useCaseContext();


  const startRecording = useCallback(
    async (
      setSessionState?: (state: RecordingStatus) => void,
      selectedLanguage?: string,
      sessionType?: sessionType,
      detectionLanguages?:string,
    ): Promise<TranscriptionStatus> => {
      if (isStartingRef.current) {
        return {
          success: false,
          timestamp: new Date().toISOString(),
          source: "both",
          error: {
            success: false,
            message: "Recording already starting",
          },
        };
      }

      isStartingRef.current = true;

      try {
        const result = await TranscribeService.startRecording(
          setTranscriptUpdate,
          selectedLanguage,
          sessionType,
          detectionLanguages,
        );

        if (result.success) {
          const newStatus = TranscribeService.getRecordingStatus();
          const newAudioStatus = TranscribeService.getAudioStatus();

          setRecordingStatus(newStatus);
          setAudioStatus(newAudioStatus);

          if (setSessionState) {
            setSessionState(newStatus);
          }
        }else{
          StreamManager.stopStreams();
        }
        return result;
      } finally {
        isStartingRef.current = false;
      }
    },
    []
  );

    useEffect(() => {
      const newText = onTranscriptUpdate?.formattedTranscript;
      if (newText && newText.trim()) {
        setFullTranscript((prev) => prev + newText);
      }
    }, [onTranscriptUpdate]);


    const getFullTranscript = fullTranscript; ;


  const stopRecording = useCallback(
    (setSessionState?: (state: RecordingStatus) => void) => {
      TranscribeService.stopRecording();

      const newStatus = TranscribeService.getRecordingStatus();
      const newAudioStatus = TranscribeService.getAudioStatus();

      setRecordingStatus(newStatus);
      setAudioStatus(newAudioStatus);

      console.log("🔍 Saving transcript, length:", fullTranscript.length); // Debug

      const transcriptionData: SaveTranscriptionRequest = {
        caseId: currentCase?.caseId || "",
        sessionId:
          currentSession?.sessionId ||
          currentCase?.caseId + "_" + crypto.randomUUID(),
        transcription: fullTranscript, 
      };

      TranscribeService.saveTranscription(transcriptionData);

      if (setSessionState) {
        setSessionState(newStatus);
      }
    },
    [fullTranscript, currentCase, currentSession] 
  );

  return (
    <TranscriptionContext.Provider
      value={{
        audioStatus,
        recordingStatus,
        startRecording,
        stopRecording,
        getFullTranscript,
      }}
    >
      {children}
    </TranscriptionContext.Provider>
  );
};
