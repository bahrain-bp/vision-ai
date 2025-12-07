import React, {
  createContext,
  useState,
  useCallback,
  ReactNode,
  useRef,
  useEffect,
} from "react";
import {
  RecordingStatus,
  SessionType,
  SaveTranscriptionRequest,
  LanguagePreferences,
  TranscriptionStats,
} from "../types/";
import { TranscriptionResult,TranscriptionStatus,FormattedTranscript } from "../types";
import TranscribeService from "../services/LiveTranscription/TranscribeService";
import StreamManager from "../services/LiveTranscription/StreamManager";
import {useCaseContext} from "../hooks/useCaseContext"


export interface TranscriptionContextType {
  audioStatus: boolean;
  recordingStatus: RecordingStatus;
  setParticipantType: (personType: string) => void;
  startRecording: (
    setSessionState?: (state: RecordingStatus) => void,
    languagePreferences?: LanguagePreferences,
    sessionType?: SessionType,
    detectionLanguages?: string
  ) => Promise<TranscriptionStatus>;
  stopRecording: (setSessionState?: (state: RecordingStatus) => void) => void;
  getFullTranscript: string;
  getTranscriptSegments: () => FormattedTranscript[];
  toggleRecordingPause: (isPaused: boolean) => void;
  toggleReset: () => void;
  resetTrigger: boolean;
  transcriptStats: TranscriptionStats;
}


export const TranscriptionContext = createContext<
  TranscriptionContextType | undefined
>(undefined);

export const TranscriptionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [audioStatus, setAudioStatus] = useState(false);
  const [onTranscriptUpdate, setTranscriptUpdate] =
    useState<TranscriptionResult | null>(null);
  const [fullTranscript, setFullTranscript] = useState<string>("");
  const [transcriptSegments, setTranscriptSegments] = useState<
    FormattedTranscript[]
  >([]); 
  const [transcriptStats, setTranscriptStats] = useState<TranscriptionStats>({
    avgWitnessConfidenceLevel: 0,
    witnessWordCount: 0,
    investigatorWordCount: 0,
    totalWordCount: 0,
  });


  const [isResetTrigger, setIsResetTrigger] = useState(false);

  const [recordingStatus, setRecordingStatus] =
    useState<RecordingStatus>("off");

  const isStartingRef = useRef(false);

  const { currentCase, currentSession } = useCaseContext();

  const startRecording = useCallback(
    async (
      setSessionState?: (state: RecordingStatus) => void,
      languagePreferences?: LanguagePreferences,
      sessionType?: SessionType,
      detectionLanguages?: string
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
        setTranscriptSegments([]);
        setFullTranscript("");
        setTranscriptStats({
          avgWitnessConfidenceLevel: 0,
          witnessWordCount: 0,
          investigatorWordCount: 0,
          totalWordCount: 0,
        });
        const result = await TranscribeService.startRecording(
          setTranscriptUpdate,
          languagePreferences,
          sessionType,
          detectionLanguages
        );

        if (result.success) {
          const newStatus = TranscribeService.getRecordingStatus();
          const newAudioStatus = TranscribeService.isAudioActive();

          setRecordingStatus(newStatus);
          setAudioStatus(newAudioStatus);

          if (setSessionState) {
            setSessionState(newStatus);
          }
        } else {
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
      if (recordingStatus !== "on") {
        return;
      }
     const newSpeaker = onTranscriptUpdate?.speaker || "N/A";
    const newText = onTranscriptUpdate?.formattedTranscript;

    const textOnlyTranscript = onTranscriptUpdate?.sentences || "N/A";
    const newTimeStamp = onTranscriptUpdate?.timeStamp || "N/A"
    if (newText && newText.trim()) {
      setFullTranscript((prev) => prev + newText);

      setTranscriptSegments((prev) => [
        ...prev,
        {
          speaker: newSpeaker,
          formattedTranscript: textOnlyTranscript,
          timeStamp: newTimeStamp,
        },
      ]);
    setTranscriptStats((prev) => {
      if (!prev) return prev;

      const newWitnessWords =
        prev.witnessWordCount + onTranscriptUpdate.witnessWordCount;
      const newInvestigatorWords =
        prev.investigatorWordCount + onTranscriptUpdate.investigatorWordCount;
      const newTotalWords = newWitnessWords + newInvestigatorWords;

      let newAvgConfidence = prev.avgWitnessConfidenceLevel;

      if (onTranscriptUpdate.witnessWordCount > 0 && newWitnessWords > 0) {
        const prevTotalConfidence =
          prev.avgWitnessConfidenceLevel * prev.witnessWordCount;
        const newSegmentConfidence =
          (onTranscriptUpdate?.avgWitnessConfidenceLevel ?? 0) *
          onTranscriptUpdate.witnessWordCount;

        newAvgConfidence =
          (prevTotalConfidence + newSegmentConfidence) / newWitnessWords;
      }

      return {
        avgWitnessConfidenceLevel: newAvgConfidence,
        witnessWordCount: newWitnessWords,
        investigatorWordCount: newInvestigatorWords,
        totalWordCount: newTotalWords,
      };
    });
    }
    
  }, [onTranscriptUpdate]);


  const getTranscriptSegments = useCallback((): FormattedTranscript[] => {
    return transcriptSegments;
  }, [transcriptSegments]);

 const setParticipantType = useCallback((personType: string) => {
   TranscribeService.setPersonType(personType);
 }, []);

  const stopRecording = useCallback(
    (setSessionState?: (state: RecordingStatus) => void) => {
      TranscribeService.stopRecording();

      const newStatus = TranscribeService.getRecordingStatus();
      const newAudioStatus = TranscribeService.isAudioActive();

      setRecordingStatus(newStatus);
      setAudioStatus(newAudioStatus);

      //console.log("🔍 Saving transcript, length:", fullTranscript.length); // Debug

      const transcriptionData: SaveTranscriptionRequest = {
        caseId: currentCase?.caseId || "",
        sessionId:
          currentSession?.sessionId ||
          currentCase?.caseId + "_" + crypto.randomUUID(),
        transcription: fullTranscript || "N/A",
      };

      TranscribeService.saveTranscription(transcriptionData);

      if (setSessionState) {
        setSessionState(newStatus);
      }
    },
    [fullTranscript, currentCase, currentSession]
  );

  const toggleRecordingPause = (isPaused: boolean) => {
      TranscribeService.toggleRecordingPause(isPaused);
  };

  const toggleReset =()=>{
    setFullTranscript("");
    setTranscriptSegments([]);
    setIsResetTrigger((prev) => !prev);
    setTranscriptStats({
      avgWitnessConfidenceLevel: 0,
      witnessWordCount: 0,
      investigatorWordCount: 0,
      totalWordCount: 0,
    });
  };

  const resetTrigger = isResetTrigger;

  return (
    <TranscriptionContext.Provider
      value={{
        audioStatus,
        recordingStatus,
        setParticipantType,
        startRecording,
        stopRecording,
        getFullTranscript: fullTranscript,
        getTranscriptSegments,
        toggleRecordingPause,
        toggleReset,
        resetTrigger,
        transcriptStats,
      }}
    >
      {children}
    </TranscriptionContext.Provider>
  );
};
