import React, { createContext, useReducer, useContext, ReactNode } from "react";

// Data interfaces
// detected event from the analysis
interface Event {
  id: string;
  timestamp: number;
  description: string;
  confidence: number; // AI confidence percentage
  type: "person" | "vehicle" | "object" | "activity";
  // optional: visually highlight events through bbox overlay
  bbox?: { x: number; y: number; width: number; height: number };
}

interface VideoMetadata {
  format: string;
  duration: number;
  width: number; // in pixels
  height: number; // in pixels
  frameRate?: number; // optional
  codec?: string; // e.g. "H.264"
  sizeMB?: number; // file size (optional)
}

interface AnalysisResult {
  events: Event[];
  summary: string;
  duration: number;
  processedAt: Date;
}

// state obj for tracking
interface VideoAnalysisState {
  videoFile: File | null;
  videoUrl: string | null;
  isAnalyzing: boolean;
  analysisResult: AnalysisResult | null;
  selectedEvent: Event | null;
  uploadProgress: number;
  error: string | null;
  metadata: VideoMetadata | null;
}

// actions to change states
type VideoAnalysisAction =
  | { type: "SET_VIDEO"; payload: { file: File; url: string } }
  | { type: "CLEAR_VIDEO" }
  | { type: "SET_ANALYZING"; payload: boolean }
  | { type: "SET_ANALYSIS_RESULT"; payload: AnalysisResult }
  | { type: "SET_SELECTED_EVENT"; payload: Event | null }
  | { type: "SET_UPLOAD_PROGRESS"; payload: number }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_METADATA"; payload: VideoMetadata | null };

const initialState: VideoAnalysisState = {
  videoFile: null,
  videoUrl: null,
  isAnalyzing: false,
  analysisResult: null,
  selectedEvent: null,
  uploadProgress: 0,
  error: null,
  metadata: null,
};

const VideoAnalysisContext = createContext<{
  state: VideoAnalysisState;
  dispatch: React.Dispatch<VideoAnalysisAction>;
} | null>(null);

// reducer function to control how each action changes states
const videoAnalysisReducer = (
  state: VideoAnalysisState,
  action: VideoAnalysisAction
): VideoAnalysisState => {
  switch (action.type) {
    case "SET_VIDEO":
      return {
        ...state,
        videoFile: action.payload.file,
        videoUrl: action.payload.url,
        error: null,
      };
    case "CLEAR_VIDEO":
      return { ...initialState };
    case "SET_ANALYZING":
      return { ...state, isAnalyzing: action.payload };
    case "SET_ANALYSIS_RESULT":
      return { ...state, analysisResult: action.payload, isAnalyzing: false };
    case "SET_SELECTED_EVENT":
      return { ...state, selectedEvent: action.payload };
    case "SET_UPLOAD_PROGRESS":
      return { ...state, uploadProgress: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_METADATA":
      return { ...state, metadata: action.payload };

    default:
      return state;
  }
};

export const VideoAnalysisProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(videoAnalysisReducer, initialState);

  return (
    <VideoAnalysisContext.Provider value={{ state, dispatch }}>
      {children}
    </VideoAnalysisContext.Provider>
  );
};

export const useVideoAnalysis = () => {
  const context = useContext(VideoAnalysisContext);
  if (!context) {
    throw new Error(
      "useVideoAnalysis must be used within a VideoAnalysisProvider"
    );
  }
  return context;
};
