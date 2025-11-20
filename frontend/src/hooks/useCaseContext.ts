import { useContext } from "react";
import { CaseContext } from "../context/CaseContext";

export const useCaseContext = () => {
  const context = useContext(CaseContext);
  if (!context) {
    throw new Error("useCaseContext must be used within a CaseProvider");
  }
  return context;
};
