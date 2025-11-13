import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Sparkles,
  AlertCircle,
  MessageSquare,
  Radar,
  ChevronDown,
} from "lucide-react";
import { createPortal } from "react-dom";
import { SessionData } from "../../ProcessingView";

export interface AISuggestionsProps {
  sessionData: SessionData;
  isLoading?: boolean;
  lastUpdatedAt?: string | null;
  errorMessage?: string | null;
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

const normalizePriorityValue = (value?: string): Question["priority"] => {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "high":
    case "high priority":
    case "عالي":
    case "عالية":
    case "مرتفع":
    case "مرتفعة":
      return "High";
    case "low":
    case "low priority":
    case "منخفض":
    case "منخفضة":
      return "Low";
    case "medium":
    case "medium priority":
    case "متوسط":
    case "متوسطة":
      return "Medium";
    default:
      return "Medium";
  }
};

const AISuggestions: React.FC<AISuggestionsProps> = ({
  sessionData,
  isLoading = false,
  lastUpdatedAt = null,
  errorMessage = null,
}) => {
  const [statusMessage, setStatusMessage] = useState<string>("");
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
  const [customPriority, setCustomPriority] =
    useState<Question["priority"]>("Medium");
  const [prioritySelected, setPrioritySelected] = useState<boolean>(false);
  const [priorityMenuOpen, setPriorityMenuOpen] = useState<boolean>(false);
  const [priorityActiveIndex, setPriorityActiveIndex] = useState<number>(-1);
  const [priorityMenuStyles, setPriorityMenuStyles] = useState<{
    top: number;
    left: number;
    minWidth: number;
  }>({
    top: 0,
    left: 0,
    minWidth: 160,
  });
  const priorityMenuRef = useRef<HTMLDivElement | null>(null);
  const priorityTriggerRef = useRef<HTMLButtonElement | null>(null);
  const priorityOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const priorityOptions: Question["priority"][] = ["High", "Medium", "Low"];

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
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        priorityMenuRef.current &&
        !priorityMenuRef.current.contains(event.target as Node) &&
        !priorityTriggerRef.current?.contains(event.target as Node)
      ) {
        closePriorityMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!priorityMenuOpen) {
      return undefined;
    }

    const updatePosition = (): void => {
      const trigger = priorityTriggerRef.current;
      const menu = priorityMenuRef.current;
      if (!trigger || !menu) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const margin = 12;

      let top = triggerRect.bottom + 8;
      if (top + menuRect.height > window.innerHeight - margin) {
        top = triggerRect.top - menuRect.height - 8;
        if (top < margin) {
          top = Math.max(margin, window.innerHeight - menuRect.height - margin);
        }
      }

      let left = triggerRect.right - menuRect.width;
      if (left < margin) {
        left = margin;
      }
      if (left + menuRect.width > window.innerWidth - margin) {
        left = Math.max(
          margin,
          Math.min(
            triggerRect.left,
            window.innerWidth - margin - menuRect.width
          )
        );
      }

      setPriorityMenuStyles({
        top,
        left,
        minWidth: Math.max(triggerRect.width, 160),
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [priorityMenuOpen]);
  useEffect(() => {
    if (priorityMenuOpen && priorityActiveIndex >= 0) {
      priorityOptionRefs.current[priorityActiveIndex]?.focus();
    }
  }, [priorityMenuOpen, priorityActiveIndex]);

  const openPriorityMenu = (initialIndex?: number): void => {
    const fallbackIndex =
      initialIndex ??
      Math.max(priorityOptions.indexOf(customPriority), 0);
    setPriorityMenuOpen(true);
    setPriorityActiveIndex(fallbackIndex);
  };

  const closePriorityMenu = (focusTrigger = false): void => {
    setPriorityMenuOpen(false);
    setPriorityActiveIndex(-1);
    if (focusTrigger) {
      priorityTriggerRef.current?.focus();
    }
  };

  const selectPriority = (value: Question["priority"]): void => {
    setCustomPriority(value);
    setPrioritySelected(true);
    closePriorityMenu(true);
  };

  const handlePriorityTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>
  ): void => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!priorityMenuOpen) {
        openPriorityMenu();
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!priorityMenuOpen) {
        openPriorityMenu(priorityOptions.length - 1);
      }
    } else if (event.key === "Escape" && priorityMenuOpen) {
      event.preventDefault();
      closePriorityMenu(true);
    }
  };

  const handlePriorityOptionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setPriorityActiveIndex((index + 1) % priorityOptions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setPriorityActiveIndex(
        (index - 1 + priorityOptions.length) % priorityOptions.length
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      setPriorityActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setPriorityActiveIndex(priorityOptions.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closePriorityMenu(true);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectPriority(priorityOptions[index]);
    }
  };

  const handleGenerateQuestions = async (
    message?: string,
    successMessage?: string,
    errorMessageText?: string
  ): Promise<void> => {
    setStatusMessage(message || "Generating AI questions...");
    console.log('Calling API with:', sessionData);
    
    try {
      const response = await fetch('https://hvjlr6aa2m.execute-api.us-east-1.amazonaws.com/prod/advanced-analysis/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'test-session-001',  // Use your S3 sessionId
          witness: sessionData.witness || 'سارة محمود',
          language: 'ar'
          
        })
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', errorText);
        throw new Error('Failed to generate questions');
      }
      
      const data = await response.json();
      console.log('Received questions:', data);
      const normalizedQuestions: Question[] = (data.questions || []).map(
        (question: Question) => ({
          ...question,
          priority: normalizePriorityValue(question.priority),
        })
      );
      setQuestions(normalizedQuestions);
      setStatusMessage(successMessage || "AI questions generated!");
    } catch (error) {
      console.error('Error generating questions:', error);
      setStatusMessage(errorMessageText || "Failed to generate questions");
    }
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
        priority: customPriority,
      },
    ]);
    setCustomQuestion("");
    closePriorityMenu();
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

  const priorityRank: Record<Question["priority"], number> = {
    High: 0,
    Medium: 1,
    Low: 2,
  };

  const sortedQuestions = [...questions].sort(
    (a, b) => priorityRank[a.priority] - priorityRank[b.priority]
  );

  const severityRank: Record<Gap["severity"], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  const sortedGaps = [...gaps].sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity]
  );

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
              <MessageSquare size={20} />
              <div>
                <h3 className="tab-section-title">Suggested Questions</h3>
                <p className="ai-section-caption">
                  Generate AI targeted follow-up questions derived from the rewritten report analysis to help clarify, confirm, or expand on critical details.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="ai-cta"
              onClick={() => handleGenerateQuestions()}
              disabled={isLoading}
            >
              <Sparkles size={16} />
              Generate
            </button>
          </div>
          <div className="tab-section-content">
            <div className="ai-question-grid">
              {sortedQuestions.map((question) => (
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
              <div className="ai-priority-selector">
                <button
                  type="button"
                  ref={priorityTriggerRef}
                  className={`ai-priority-trigger ${
                    prioritySelected
                      ? `priority-${customPriority.toLowerCase()}`
                      : "priority-neutral"
                  }`}
                  aria-haspopup="listbox"
                  aria-expanded={priorityMenuOpen}
                  aria-label="Priority"
                  onClick={() =>
                    priorityMenuOpen ? closePriorityMenu(true) : openPriorityMenu()
                  }
                  onKeyDown={handlePriorityTriggerKeyDown}
                >
                  <span>{prioritySelected ? customPriority : "Priority"}</span>
                  <ChevronDown size={14} />
                </button>
              </div>
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
            {priorityMenuOpen &&
              createPortal(
                <div
                  ref={priorityMenuRef}
                  className="ai-priority-overlay"
                  role="listbox"
                  aria-label="Select priority"
                  aria-activedescendant={
                    priorityActiveIndex >= 0
                      ? `priority-option-${priorityActiveIndex}`
                      : undefined
                  }
                  tabIndex={-1}
                  style={{
                    top: `${priorityMenuStyles.top}px`,
                    left: `${priorityMenuStyles.left}px`,
                    minWidth: `${priorityMenuStyles.minWidth}px`,
                  }}
                >
                  {priorityOptions.map((option, index) => (
                    <button
                      key={option}
                      id={`priority-option-${index}`}
                      ref={(el) => {
                        priorityOptionRefs.current[index] = el;
                      }}
                      type="button"
                      className={`ai-priority-chip priority-${option.toLowerCase()}`}
                      role="option"
                      tabIndex={-1}
                      aria-selected={customPriority === option}
                      onKeyDown={(event) =>
                        handlePriorityOptionKeyDown(event, index)
                      }
                      onClick={() => selectPriority(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>,
                document.body
              )}
          </div>
        </div>

        <div className="tab-section ai-section-card">
          <div className="ai-section-header">
            <div className="ai-section-heading">
              <Radar size={20} />
              <div>
                <h3 className="tab-section-title">Key Focus Areas</h3>
                <p className="ai-section-caption">
                  Identify the most important or unclear areas that require additional attention or context.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="ai-cta"
              onClick={async () => {
                setStatusMessage("Generating Key Focus Areas...");
                try {
                  const response = await fetch('https://hvjlr6aa2m.execute-api.us-east-1.amazonaws.com/prod/advanced-analysis/focus-areas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sessionId: 'test-session-001',
                      language: 'ar'
                    })
                  });
                  if (!response.ok) throw new Error('Failed to generate focus areas');
                  const data = await response.json();
                  const mappedGaps = data.focusAreas.map((area: any, index: number) => ({
                    id: `gap-${Date.now()}-${index}`,
                    title: area.title,
                    description: area.description,
                    severity: area.priority.toLowerCase() as 'high' | 'medium' | 'low',
                    resolved: false
                  }));
                  setGaps(mappedGaps);
                  setStatusMessage("Key Focus Areas generated!");
                } catch (error) {
                  console.error('Error:', error);
                  setStatusMessage("Failed to generate Key Focus Areas");
                }
              }}
              disabled={isLoading}
            >
              <Sparkles size={16} />
              Generate
            </button>
          </div>
          <div className="tab-section-content">
            <div className="ai-gap-grid">
              {sortedGaps.map((gap) => (
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
