import React, { createContext, useContext, useState, ReactNode } from "react";

interface TranscriptionResult {
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  transcription?: string;
  originalLanguage?: string;
  error?: string;
}

interface AnalysisResult {
  summary: string;
}

interface AudioAnalysisState {
  audioFile: File | null;
  audioUrl: string | null;
  isUploading: boolean;
  uploadedS3Key: string | null;
  isTranscribing: boolean;
  transcriptionResult: TranscriptionResult | null;
  resultKey: string | null;
  isAnalyzing: boolean;
  analysisResult: AnalysisResult | null;
  banner: {
    type: "success" | "error" | "warning" | "info";
    message: string | { en: string; ar: string };
  } | null;
  showResetModal: boolean;
}

interface AudioAnalysisContextType {
  state: AudioAnalysisState;
  setAudioFile: (file: File | null) => void;
  setAudioUrl: (url: string | null) => void;
  setIsUploading: (uploading: boolean) => void;
  setUploadedS3Key: (key: string | null) => void;
  setIsTranscribing: (transcribing: boolean) => void;
  setTranscriptionResult: (result: TranscriptionResult | null) => void;
  setResultKey: (key: string | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setAnalysisResult: (result: AnalysisResult | null) => void;
  setBanner: (
    banner: {
      type: "success" | "error" | "warning" | "info";
      message: string | { en: string; ar: string };
    } | null
  ) => void;
  setShowResetModal: (show: boolean) => void;
  resetState: () => void;
}

const initialState: AudioAnalysisState = {
  audioFile: null,
  audioUrl: null,
  isUploading: false,
  uploadedS3Key: null,
  isTranscribing: false,
  transcriptionResult: null,
  resultKey: null,
  isAnalyzing: false,
  analysisResult: null,
  banner: null,
  showResetModal: false,
};

const AudioAnalysisContext = createContext<AudioAnalysisContextType | null>(
  null
);

export const AudioAnalysisProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AudioAnalysisState>(initialState);

  const setAudioFile = (file: File | null) => {
    setState((prev) => ({ ...prev, audioFile: file }));
  };

  const setAudioUrl = (url: string | null) => {
    setState((prev) => ({ ...prev, audioUrl: url }));
  };

  const setIsUploading = (uploading: boolean) => {
    setState((prev) => ({ ...prev, isUploading: uploading }));
  };

  const setUploadedS3Key = (key: string | null) => {
    setState((prev) => ({ ...prev, uploadedS3Key: key }));
  };

  const setIsTranscribing = (transcribing: boolean) => {
    setState((prev) => ({ ...prev, isTranscribing: transcribing }));
  };

  const setTranscriptionResult = (result: TranscriptionResult | null) => {
    setState((prev) => ({ ...prev, transcriptionResult: result }));
  };

  const setResultKey = (key: string | null) => {
    setState((prev) => ({ ...prev, resultKey: key }));
  };

  const setIsAnalyzing = (analyzing: boolean) => {
    setState((prev) => ({ ...prev, isAnalyzing: analyzing }));
  };

  const setAnalysisResult = (result: AnalysisResult | null) => {
    setState((prev) => ({ ...prev, analysisResult: result }));
  };

  const setBanner = (
    banner: {
      type: "success" | "error" | "warning" | "info";
      message: string | { en: string; ar: string };
    } | null
  ) => {
    setState((prev) => ({ ...prev, banner: banner }));
  };

  const setShowResetModal = (show: boolean) => {
    setState((prev) => ({ ...prev, showResetModal: show }));
  };

  const resetState = () => {
    setState(initialState);
  };

  return (
    <AudioAnalysisContext.Provider
      value={{
        state,
        setAudioFile,
        setAudioUrl,
        setIsUploading,
        setUploadedS3Key,
        setIsTranscribing,
        setTranscriptionResult,
        setResultKey,
        setIsAnalyzing,
        setAnalysisResult,
        setBanner,
        setShowResetModal,
        resetState,
      }}
    >
      {children}
    </AudioAnalysisContext.Provider>
  );
};

export const useAudioAnalysis = () => {
  const context = useContext(AudioAnalysisContext);
  if (!context) {
    throw new Error(
      "useAudioAnalysis must be used within an AudioAnalysisProvider"
    );
  }
  return context;
};

export type { AnalysisResult, TranscriptionResult };
