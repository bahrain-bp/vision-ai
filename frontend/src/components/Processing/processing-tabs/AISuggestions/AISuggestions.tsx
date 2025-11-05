import React, { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  MessageSquare,
  Radar,
} from "lucide-react";
import { SessionData } from "../../ProcessingView";

export type SummaryFormat = "executive" | "detailed" | "bullet";
export type SummaryLength = "short" | "medium" | "long";

export interface SummaryRequestPayload {
  sessionId: string;
  format: SummaryFormat;
  length: SummaryLength;
  focusAreas: string[];
  language: string;
  includeActionItems: boolean;
}

export interface SummaryResult {
  summaryId: string;
  content: string;
  format: SummaryFormat;
  length: SummaryLength;
  focusAreas: string[];
  language: string;
  createdAt: string;
  createdBy: string;
  version: number;
}

export interface AISuggestionsProps {
  sessionData: SessionData;
  onGenerate?: (payload: SummaryRequestPayload) => Promise<SummaryResult>;
  onSave?: (result: SummaryResult) => Promise<void>;
  initialSummary?: SummaryResult | null;
  isLoading?: boolean;
  lastUpdatedAt?: string | null;
  errorMessage?: string | null;
}

interface Guideline {
  id: string;
  title: string;
  detail: string;
  completed: boolean;
}

interface Question {
  id: string;
  text: string;
  context: string;
  priority: "High" | "Medium" | "Low";
}

interface Gap {
  id: string;
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  resolved: boolean;
}

const defaultFocusAreas = ["Timeline", "Witnesses", "Evidence", "Contradictions"];

const AISuggestions: React.FC<AISuggestionsProps> = ({
  sessionData,
  onGenerate,
  isLoading = false,
  lastUpdatedAt = null,
  errorMessage = null,
}) => {
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [guidelines, setGuidelines] = useState<Guideline[]>([
    {
      id: "g1",
      title: "Establish Rapport",
      detail:
        "Open with case context and calm tone to encourage detailed, confident responses.",
      completed: false,
    },
    {
      id: "g2",
      title: "Anchor to Evidence",
      detail:
        "Cross-reference questions with documented reports to keep the interview grounded.",
      completed: false,
    },
    {
      id: "g3",
      title: "Surface Contradictions",
      detail:
        "Listen for timeline drift and flag inconsistencies for immediate clarification.",
      completed: false,
    },
  ]);
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: "q1",
      text: "Walk me through the sequence of events leading to the incident.",
      context: "Clarify timeline and causal links",
      priority: "High",
    },
    {
      id: "q2",
      text: "Who else was present, and what did they observe?",
      context: "Identify corroborating witnesses",
      priority: "High",
    },
    {
      id: "q3",
      text: "What supporting evidence should we review to validate your account?",
      context: "Connect testimony to available artefacts",
      priority: "Medium",
    },
  ]);
  const [gaps, setGaps] = useState<Gap[]>([
    {
      id: "gap1",
      title: "Timeline Precision",
      description:
        "Multiple statements diverge on when the confrontation began. Pin down exact timestamps.",
      severity: "high",
      resolved: false,
    },
    {
      id: "gap2",
      title: "Witness Roles",
      description:
        "Witness identities are mentioned without clarifying involvement or relation to the case.",
      severity: "medium",
      resolved: false,
    },
    {
      id: "gap3",
      title: "Environmental Details",
      description:
        "Weather and lighting conditions are missing, making it hard to validate visibility claims.",
      severity: "low",
      resolved: false,
    },
  ]);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [customQuestion, setCustomQuestion] = useState<string>("");

  useEffect(() => {
    if (errorMessage) {
      setStatusMessage(errorMessage);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (!statusMessage) {
      return undefined;
    }

    const timer = window.setTimeout(() => setStatusMessage(""), 2500);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  const basePayload = useMemo<SummaryRequestPayload>(
    () => ({
      sessionId: sessionData.sessionId,
      format: "executive",
      length: "medium",
      focusAreas: focusAreas.length ? focusAreas : defaultFocusAreas,
      language: sessionData.language || "en",
      includeActionItems: true,
    }),
    [focusAreas, sessionData.language, sessionData.sessionId]
  );

  const invokeGenerate = async (label: string): Promise<void> => {
    if (!onGenerate) {
      setStatusMessage(`${label} ready`);
      return;
    }

    try {
      await onGenerate(basePayload);
      setStatusMessage(`${label} updated`);
    } catch (generationError) {
      console.error("Generate request failed", generationError);
      setStatusMessage(`Unable to refresh ${label.toLowerCase()}`);
    }
  };

  const handleGuidelineToggle = (id: string): void => {
    setGuidelines((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const handleGenerateGuidelines = (): void => {
    setStatusMessage("Generating interview preparation guidance...");
    void invokeGenerate("Guidelines");
  };

  const handleGenerateQuestions = (): void => {
    setStatusMessage("Generating recommended questions...");
    void invokeGenerate("Questions");
  };

  const handleAddCustomQuestion = (): void => {
    const trimmed = customQuestion.trim();
    if (!trimmed) {
      return;
    }

    setQuestions((prev) => [
      ...prev,
      {
        id: `q-${Date.now()}`,
        text: trimmed,
        context: "Analyst-defined focus",
        priority: "Medium",
      },
    ]);
    setCustomQuestion("");
    setStatusMessage("Custom question added");
  };

  const handleAddFocusArea = (label: string): void => {
    setFocusAreas((prev) =>
      prev.includes(label) ? prev : [...prev, label]
    );
    setStatusMessage(`Focus area added: ${label}`);
  };

  const handleToggleGapResolved = (id: string): void => {
    setGaps((prev) =>
      prev.map((gap) =>
        gap.id === id ? { ...gap, resolved: !gap.resolved } : gap
      )
    );
  };

  return (
    <div className="ai-suggestions-view">
      {(statusMessage || lastUpdatedAt || isLoading) && (
        <div className="ai-status-banner" aria-live="polite">
          {statusMessage && <span>{statusMessage}</span>}
          {isLoading && <span className="ai-status-pulse">Processing…</span>}
          {lastUpdatedAt && (
            <span className="ai-status-timestamp">
              Last synced {new Date(lastUpdatedAt).toLocaleString()}
            </span>
          )}
        </div>
      )}

      <div className="ai-sections-grid">
        <div className="tab-section ai-section-card">
          <div className="ai-section-header">
            <div className="ai-section-heading">
              <ShieldCheck size={20} />
              <div>
                <h3 className="tab-section-title">Interview Preparation</h3>
                <p className="ai-section-caption">
                  Guidelines tailored to the current case and transcript.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="ai-cta"
              onClick={handleGenerateGuidelines}
              disabled={isLoading}
            >
              <Sparkles size={16} />
              Generate
            </button>
          </div>
          <div className="tab-section-content">
            <div className="ai-guideline-list">
              {guidelines.map((guideline) => (
                <div
                  key={guideline.id}
                  className={`ai-guideline-card ${
                    guideline.completed ? "ai-guideline-complete" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="ai-guideline-toggle"
                    onClick={() => handleGuidelineToggle(guideline.id)}
                    aria-label={
                      guideline.completed
                        ? "Mark guideline incomplete"
                        : "Mark guideline complete"
                    }
                  >
                    {guideline.completed ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <div className="ai-guideline-indicator" />
                    )}
                  </button>
                  <div className="ai-guideline-body">
                    <h4>{guideline.title}</h4>
                    <p>{guideline.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="tab-section ai-section-card">
          <div className="ai-section-header">
            <div className="ai-section-heading">
              <MessageSquare size={20} />
              <div>
                <h3 className="tab-section-title">Suggested Questions</h3>
                <p className="ai-section-caption">
                  AI-powered suggestions and recommendations.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="ai-cta"
              onClick={handleGenerateQuestions}
              disabled={isLoading}
            >
              <Sparkles size={16} />
              Generate
            </button>
          </div>
          <div className="tab-section-content">
            <div className="ai-question-grid">
              {questions.map((question) => (
                <div key={question.id} className="ai-question-card">
                  <div className="ai-question-header">
                    <span
                      className={`ai-priority-chip priority-${question.priority.toLowerCase()}`}
                    >
                      {question.priority}
                    </span>
                    <button
                      type="button"
                      className="ai-focus-add"
                      onClick={() => handleAddFocusArea(question.context)}
                    >
                      Add focus
                    </button>
                  </div>
                  <p className="ai-question-text">{question.text}</p>
                  <p className="ai-question-context">{question.context}</p>
                </div>
              ))}
            </div>
            <div className="ai-question-input-row">
              <input
                type="text"
                value={customQuestion}
                onChange={(event) => setCustomQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddCustomQuestion();
                  }
                }}
                placeholder="Add a custom question"
                className="ai-question-input"
              />
              <button
                type="button"
                className="ai-cta"
                onClick={handleAddCustomQuestion}
              >
                <Sparkles size={16} />
                Add
              </button>
            </div>
            {focusAreas.length > 0 && (
              <div className="ai-focus-chips">
                {focusAreas.map((focus) => (
                  <span key={focus} className="ai-focus-chip">
                    {focus}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="tab-section ai-section-card">
          <div className="ai-section-header">
            <div className="ai-section-heading">
              <Radar size={20} />
              <div>
                <h3 className="tab-section-title">Case Gap Analysis</h3>
                <p className="ai-section-caption">
                  Identify missing or unclear areas needing attention.
                </p>
              </div>
            </div>
          </div>
          <div className="tab-section-content">
            <div className="ai-gap-grid">
              {gaps.map((gap) => (
                <div
                  key={gap.id}
                  className={`ai-gap-card ${gap.resolved ? "ai-gap-resolved" : ""}`}
                >
                  <div className="ai-gap-top">
                    <div className="ai-gap-title-row">
                      <h4>{gap.title}</h4>
                      <span
                        className={`ai-gap-severity severity-${gap.severity}`}
                      >
                        <AlertCircle size={14} />
                        {gap.severity.toUpperCase()}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="ai-cta subtle"
                      onClick={() => handleToggleGapResolved(gap.id)}
                    >
                      {gap.resolved ? "Mark unresolved" : "Mark resolved"}
                    </button>
                  </div>
                  <p className="ai-gap-description">{gap.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISuggestions;
