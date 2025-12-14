import React, { createContext, useState, useCallback } from "react";
import caseService, { Case, Session } from "../services/caseService";

export interface CaseContextType {
  // Current state
  currentCase: Case | null;
  currentSession: Session | null;
  allCases: Case[];

  //current participant name
  currentPersonName: string | null;
  setCurrentPersonName: (name: string | null) => void;

  currentPersonType: string | null;
  setCurrentPersonType: (type: string | null) => void;

  // Loading states
  isLoading: boolean;

  // Error state
  error: string | null;

  // Actions
  loadAllCases: () => Promise<void>;
  selectCase: (caseId: string) => Promise<void>;
  createCase: (
    title: string,
    description: string,
    createdBy: string
  ) => Promise<Case>;
  createSession: (caseId: string, investigator: string) => Promise<Session>;
  setCurrentSession: (session: Session | null) => void;
  clearContext: () => void;
  clearError: () => void;

  updateSessionStatus: (
    caseId: string,
    sessionId: string,
    status: "pending" | "in-progress" | "completed"
  ) => Promise<void>;

  updateCaseStatus: (
    caseId: string,
    status: "active" | "inactive"
  ) => Promise<void>;

  setCurrentCaseDirectly: (caseItem: Case) => void;
}

const CaseContext = createContext<CaseContextType | undefined>(undefined);

export const CaseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [allCases, setAllCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPersonName, setCurrentPersonName] = useState<string | null>(
    null
  );
  const [currentPersonType, setCurrentPersonType] = useState<string | null>(
    null
  );
  /**
   * Load all available cases
   */
  const loadAllCases = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const cases = await caseService.getAllCases();
      setAllCases(cases);
      console.log(`Loaded ${cases.length} cases`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load cases";
      console.error("Error loading cases:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Select a case by ID
   */
  const selectCase = useCallback(async (caseId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const caseWithSessions = await caseService.getCaseById(caseId);
      setCurrentCase(caseWithSessions);
      console.log(`Selected case: ${caseId}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to select case";
      console.error("Error selecting case:", errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create a new case
   */
  const createCase = useCallback(
    async (
      title: string,
      description: string,
      createdBy: string
    ): Promise<Case> => {
      setIsLoading(true);
      setError(null);
      try {
        const newCase = await caseService.createCase(
          title,
          description,
          createdBy
        );

        // Add to the beginning of the list
        setAllCases((prev) => [newCase, ...prev]);
        setCurrentCase(newCase);

        console.log(`Created new case: ${newCase.caseId}`);
        return newCase;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create case";
        console.error("Error creating case:", errorMessage);
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Update case status
   */
  const updateCaseStatus = useCallback(
    async (caseId: string, status: "active" | "inactive"): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const updatedCase = await caseService.updateCaseStatus(caseId, status);

        // Update case in local state with backend response
        setAllCases((prevCases) =>
          prevCases.map((caseItem) =>
            caseItem.caseId === caseId ? updatedCase : caseItem
          )
        );

        // Update current case if it matches
        if (currentCase && currentCase.caseId === caseId) {
          setCurrentCase(updatedCase);
        }

        console.log(`Updated case ${caseId} status to ${status}`);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update case status";
        console.error("Error updating case status:", errorMessage);
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [currentCase]
  );

  /**
   * Create a new session within a case
   */
  const createSession = useCallback(
    async (caseId: string, investigator: string): Promise<Session> => {
      setIsLoading(true);
      setError(null);
      try {
        const newSession = await caseService.createSession(
          caseId,
          investigator
        );

        setCurrentSession(newSession);

        console.log(`Created new session: ${newSession.sessionId}`);
        return newSession;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create session";
        console.error("Error creating session:", errorMessage);
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Set current case directly
   */
  const setCurrentCaseDirectly = useCallback((caseItem: Case) => {
    setCurrentCase(caseItem);
    console.log(`Set current case directly: ${caseItem.caseId}`);
  }, []);

  /**
   * Update session status
   */
  const updateSessionStatus = useCallback(
    async (
      caseId: string,
      sessionId: string,
      status: "pending" | "in-progress" | "completed"
    ): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        await caseService.updateSessionStatus(caseId, sessionId, status);

        // Update current session status if it matches
        if (currentSession && currentSession.sessionId === sessionId) {
          setCurrentSession({
            ...currentSession,
            status,
          });
        }

        console.log(`Updated session ${sessionId} status to ${status}`);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to update session status";
        console.error("Error updating session status:", errorMessage);
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [currentSession]
  );

  /**
   * Set current session manually
   */
  const setCurrentSessionManually = useCallback((session: Session | null) => {
    setCurrentSession(session);
    if (session) {
      console.log(`Set current session: ${session.sessionId}`);
    } else {
      console.log("Cleared current session");
    }
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Clear all context (on logout or reset)
   */
  const clearContext = useCallback(() => {
    setCurrentCase(null);
    setCurrentSession(null);
    setAllCases([]);
    setError(null);
    setCurrentPersonName(null);
    setCurrentPersonType(null);
    console.log("Cleared case context");
  }, []);

  const value: CaseContextType = {
    currentCase,
    currentSession,
    currentPersonName,
    currentPersonType,
    allCases,
    isLoading,
    error,
    loadAllCases,
    selectCase,
    createCase,
    createSession,
    setCurrentSession: setCurrentSessionManually,
    clearContext,
    clearError,
    updateSessionStatus,
    updateCaseStatus,
    setCurrentCaseDirectly,
    setCurrentPersonName,
    setCurrentPersonType,
  };

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>;
};

export { CaseContext };