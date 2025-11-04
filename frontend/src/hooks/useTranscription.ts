import { useContext } from "react";
import { TranscriptionContext } from "../context/TranscriptionContext";

export const useTranscription = () => {
  const context = useContext(TranscriptionContext);

  if (!context) {
    throw new Error(
      "useTranscription must be used within TranscriptionProvider"
    );
  }

  return context;
};