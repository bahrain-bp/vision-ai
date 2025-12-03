import React, { createContext, useContext, useState, ReactNode } from "react";

interface TranslatedText {
  en: string;
  ar: string;
}

interface TranslatedFields {
  en: {
    description: string;
    type?: string;
    confidence?: string;
  };
  ar: {
    description: string;
    type?: string;
    confidence?: string;
  };
}

interface Event {
  id: string;
  timestamp: number;
  start_millis?: number;
  end_millis?: number;
  duration_seconds?: number;
  description: string;
  confidence?: number;
  type: string;
  risk_score?: number;
}

interface ChapterData {
  id: string;
  displayIndex: number;
  segmentIndex: number;
  timestamp: number;
  start_seconds: number;
  end_seconds: number;
  duration_seconds: number;
  summary: string;
  translations?: TranslatedText;
  risk_score?: number;
  confidence?: number;
  type: string;
  event?: {
    id: string;
    description: string;
    type: string;
    confidence: number;
    timestamp?: number;
    start_millis?: number;
    end_millis?: number;
    translations?: TranslatedFields;
  };
  person?: {
    id: string;
    description: string;
    confidence: number;
    first_seen?: number;
    last_seen?: number;
    translations?: TranslatedFields;
  };
  object?: {
    id: string;
    description: string;
    suspicious: boolean;
    risk_relevance: string;
    confidence: number;
    first_seen?: number;
    last_seen?: number;
    translations?: TranslatedFields;
  };
}

interface AnalysisResult {
  events: Event[];
  summary: string | TranslatedText;
  chapters?: ChapterData[];
  metadata?: {
    duration_seconds: number;
    frame_rate?: number;
    format?: string;
  };
  processedAt?: Date;
}

interface CameraFootageState {
  videoFile: File | null;
  videoUrl: string | null;
  isAnalyzing: boolean;
  isUploading: boolean;
  uploadError: string | null;
  analysisResult: AnalysisResult | null;
  editedResults: AnalysisResult | null;
  expandedChapter: string | null;
  videoS3Key: string;
  pollingStatus: string;
  videoDuration: number | null;
  isExporting: boolean;
  banner: {
    type: "success" | "error" | "warning" | "info";
    message: string;
  } | null;
  showResetModal: boolean;
}

interface CameraFootageContextType {
  state: CameraFootageState;
  setVideoFile: (file: File | null) => void;
  setVideoUrl: (url: string | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setIsUploading: (uploading: boolean) => void;
  setUploadError: (error: string | null) => void;
  setAnalysisResult: (result: AnalysisResult | null) => void;
  setEditedResults: (result: AnalysisResult | null) => void;
  setExpandedChapter: (chapterId: string | null) => void;
  setVideoS3Key: (key: string) => void;
  setPollingStatus: (status: string) => void;
  setVideoDuration: (duration: number | null) => void;
  setIsExporting: (exporting: boolean) => void;
  setBanner: (
    banner: {
      type: "success" | "error" | "warning" | "info";
      message: string;
    } | null
  ) => void;
  setShowResetModal: (show: boolean) => void;
  resetState: () => void;
}

const initialState: CameraFootageState = {
  videoFile: null,
  videoUrl: null,
  isAnalyzing: false,
  isUploading: false,
  uploadError: null,
  analysisResult: null,
  editedResults: null,
  expandedChapter: null,
  videoS3Key: "",
  pollingStatus: "",
  videoDuration: null,
  isExporting: false,
  banner: null,
  showResetModal: false,
};

const CameraFootageContext = createContext<CameraFootageContextType | null>(
  null
);

export const CameraFootageProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<CameraFootageState>(initialState);

  const setVideoFile = (file: File | null) => {
    setState((prev) => ({ ...prev, videoFile: file }));
  };

  const setVideoUrl = (url: string | null) => {
    setState((prev) => ({ ...prev, videoUrl: url }));
  };

  const setIsAnalyzing = (analyzing: boolean) => {
    setState((prev) => ({ ...prev, isAnalyzing: analyzing }));
  };

  const setIsUploading = (uploading: boolean) => {
    setState((prev) => ({ ...prev, isUploading: uploading }));
  };

  const setUploadError = (error: string | null) => {
    setState((prev) => ({ ...prev, uploadError: error }));
  };

  const setAnalysisResult = (result: AnalysisResult | null) => {
    setState((prev) => ({ ...prev, analysisResult: result }));
  };

  const setEditedResults = (result: AnalysisResult | null) => {
    setState((prev) => ({ ...prev, editedResults: result }));
  };

  const setExpandedChapter = (chapterId: string | null) => {
    setState((prev) => ({ ...prev, expandedChapter: chapterId }));
  };

  const setVideoS3Key = (key: string) => {
    setState((prev) => ({ ...prev, videoS3Key: key }));
  };

  const setPollingStatus = (status: string) => {
    setState((prev) => ({ ...prev, pollingStatus: status }));
  };

  const setVideoDuration = (duration: number | null) => {
    setState((prev) => ({ ...prev, videoDuration: duration }));
  };

  const setIsExporting = (exporting: boolean) => {
    setState((prev) => ({ ...prev, isExporting: exporting }));
  };

  const setBanner = (
    banner: {
      type: "success" | "error" | "warning" | "info";
      message: string;
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
    <CameraFootageContext.Provider
      value={{
        state,
        setVideoFile,
        setVideoUrl,
        setIsAnalyzing,
        setIsUploading,
        setUploadError,
        setAnalysisResult,
        setEditedResults,
        setExpandedChapter,
        setVideoS3Key,
        setPollingStatus,
        setVideoDuration,
        setIsExporting,
        setBanner,
        setShowResetModal,
        resetState,
      }}
    >
      {children}
    </CameraFootageContext.Provider>
  );
};

export const useCameraFootage = () => {
  const context = useContext(CameraFootageContext);
  if (!context) {
    throw new Error(
      "useCameraFootage must be used within a CameraFootageProvider"
    );
  }
  return context;
};

export type {
  AnalysisResult,
  ChapterData,
  TranslatedText,
  TranslatedFields,
  Event,
};
