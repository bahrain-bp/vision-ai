import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Sparkles, AlertCircle, ChevronDown, Plus } from "lucide-react";
import { createPortal } from "react-dom";
import { SessionData } from "../../ProcessingView";

export interface AISuggestionsProps {
  sessionData: SessionData;
  language?: "en" | "ar";
  isLoading?: boolean;
  lastUpdatedAt?: string | null;
  errorMessage?: string | null;
  persistedData?: any;
  onDataChange?: (data: any) => void;
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

const isArabicLanguage = (value?: string | null): boolean => {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "ar" ||
    normalized.startsWith("ar") ||
    normalized.includes("arab") ||
    normalized.includes("عرب") ||
    normalized.includes("عربي") ||
    normalized.includes("العربية")
  );
};

const AISuggestions: React.FC<AISuggestionsProps> = ({
  sessionData,
  language = "en",
  isLoading = false,
  lastUpdatedAt = null,
  errorMessage = null,
  persistedData = null,
  onDataChange,
}) => {
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>(persistedData?.questions || []);
  const [gaps, setGaps] = useState<Gap[]>(persistedData?.gaps || []);
  const [focusAreas, setFocusAreas] = useState<string[]>(persistedData?.focusAreas || []);
  
  // Sync with persisted data when returning to tab
  useEffect(() => {
    if (persistedData) {
      if (persistedData.questions) setQuestions(persistedData.questions);
      if (persistedData.gaps) setGaps(persistedData.gaps);
      if (persistedData.focusAreas) setFocusAreas(persistedData.focusAreas);
    }
  }, [persistedData]);
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
    arrowLeft: number;
  }>({
    top: 0,
    left: 0,
    minWidth: 160,
    arrowLeft: 24,
  });
  const [isQuestionGenerating, setIsQuestionGenerating] =
    useState<boolean>(false);
  const [isFocusGenerating, setIsFocusGenerating] = useState<boolean>(false);
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
      const verticalOffset = 2;

      let top = triggerRect.bottom + verticalOffset;
      if (top + menuRect.height > window.innerHeight - margin) {
        top = triggerRect.top - menuRect.height - verticalOffset;
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

      const minWidth = Math.max(triggerRect.width, 160);
      const triggerCenter = triggerRect.left + triggerRect.width / 2;
      const arrowLeft = Math.min(
        Math.max(triggerCenter - left - 6, 12),
        minWidth - 18
      );

      setPriorityMenuStyles({
        top,
        left,
        minWidth,
        arrowLeft,
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
    const generatingText =
      message ||
      (language === "en"
        ? "Generating AI questions..."
        : "جارٍ إنشاء أسئلة بالذكاء الاصطناعي...");
    const successText =
      successMessage ||
      (language === "en"
        ? "AI questions generated!"
        : "تم إنشاء الأسئلة بنجاح!");
    const errorText =
      errorMessageText ||
      (language === "en"
        ? "Failed to generate questions"
        : "فشل إنشاء الأسئلة");

    if (isQuestionGenerating) {
      return;
    }
    setIsQuestionGenerating(true);
    setStatusMessage(generatingText);

    try {
      const response = await fetch(
        "https://hvjlr6aa2m.execute-api.us-east-1.amazonaws.com/prod/advanced-analysis/questions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionData.sessionId,
            witness: sessionData.witness || "Unknown",
            language: language,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error:", errorText);
        throw new Error("Failed to generate questions");
      }

      const data = await response.json();
      const normalizedQuestions: Question[] = (data.questions || []).map(
        (question: Question) => ({
          ...question,
          priority: normalizePriorityValue(question.priority),
        })
      );
      setQuestions(normalizedQuestions);
      onDataChange?.({ questions: normalizedQuestions, gaps, focusAreas });
      setStatusMessage(successText);
    } catch (error) {
      console.error("Error generating questions:", error);
      setStatusMessage(errorText);
    } finally {
      setIsQuestionGenerating(false);
    }
  };

  const handleGenerateFocusAreas = async (): Promise<void> => {
    if (isFocusGenerating) {
      return;
    }
    setIsFocusGenerating(true);
    setStatusMessage(
      language === "en"
        ? "Generating Key Focus Areas..."
        : "جارٍ إنشاء مجالات التركيز الرئيسية..."
    );
    try {
      const response = await fetch(
        "https://hvjlr6aa2m.execute-api.us-east-1.amazonaws.com/prod/advanced-analysis/focus-areas",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionData.sessionId,
            language: language,
          }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to generate focus areas");
      }
      const data = await response.json();
      const mappedGaps = data.focusAreas.map((area: any, index: number) => ({
        id: `gap-${Date.now()}-${index}`,
        title: area.title,
        description: area.description,
        severity: area.priority.toLowerCase() as "high" | "medium" | "low",
        resolved: false,
      }));
      const resolvedGaps = gaps.filter(gap => gap.resolved);
      const allGaps = [...mappedGaps, ...resolvedGaps];
      setGaps(allGaps);
      onDataChange?.({ questions, gaps: allGaps, focusAreas });
      setStatusMessage("Key Focus Areas generated!");
    } catch (error) {
      console.error("Error:", error);
      setStatusMessage("Failed to generate Key Focus Areas");
    } finally {
      setIsFocusGenerating(false);
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
    setFocusAreas((prev) => {
      const updated = prev.includes(label) ? prev : [...prev, label];
      onDataChange?.({ questions, gaps, focusAreas: updated });
      return updated;
    });
    setStatusMessage(`Focus area added: ${label}`);
  };

  const handleToggleGapResolved = (id: string): void => {
    setGaps((prev) => {
      const updated = prev.map((gap) =>
        gap.id === id ? { ...gap, resolved: !gap.resolved } : gap
      );
      onDataChange?.({ questions, gaps: updated, focusAreas });
      return updated;
    });
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
  const activeGaps = sortedGaps.filter((gap) => !gap.resolved);
  const resolvedGaps = sortedGaps.filter((gap) => gap.resolved);

  const isRTLContent = isArabicLanguage(language);

  const renderQuestionSkeletons = (): JSX.Element => (
    <div className="ai-question-grid">
      {[1, 2, 3].map((index) => (
        <div key={index} className="ai-question-card skeleton">
          <div className="ai-question-header">
            <span className="ai-priority-chip skeleton-pill" />
            <span className="ai-focus-add skeleton-chip" />
          </div>
          <div className="ai-skeleton-line wide" />
          <div className="ai-skeleton-line" />
        </div>
      ))}
    </div>
  );

  const renderFocusSkeletons = (): JSX.Element => (
    <div className="ai-gap-grid">
      {[1, 2].map((index) => (
        <div key={index} className="ai-gap-card skeleton">
          <div className="ai-gap-top">
            <div className="ai-gap-title-row">
              <span className="ai-skeleton-line short" />
              <span className="ai-gap-severity skeleton-pill" />
            </div>
            <span className="ai-cta subtle skeleton-chip" />
          </div>
          <div className="ai-skeleton-line wide" />
          <div className="ai-skeleton-line" />
        </div>
      ))}
    </div>
  );

  return (
    <div className={`ai-suggestions-view ${language === "ar" ? "rtl" : ""}`}>
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

      <div className={`ai-suggestions-card ${language === "ar" ? "rtl" : ""}`}>
        <div className="ai-suggestions-header">
          <div>
            
            <h3 className="ai-main-title">{language === "en" ? "AI Suggestions" : "اقتراحات الذكاء الاصطناعي"}</h3>
            <p className="ai-main-subtitle">
              {language === "en" 
                ? "Generate AI targeted follow-up questions derived from the rewritten report analysis to help clarify, confirm, or expand on critical details."
                : "إنشاء أسئلة متابعة مستهدفة بالذكاء الاصطناعي مستمدة من تحليل التقرير المعاد صياغته للمساعدة في توضيح أو تأكيد أو توسيع التفاصيل الحرجة."}
            </p>
          </div>
        </div>

        <div className="ai-suggestions-grid">
          <section className="ai-suggestions-panel">
            <div className="ai-panel-header">
              <h4 className="ai-panel-title">{language === "en" ? "Suggested Questions" : "الأسئلة المقترحة"}</h4>
              <button
                type="button"
                className={`ai-cta ai-cta-compact ${isQuestionGenerating ? "loading" : ""}`}
                onClick={() => handleGenerateQuestions()}
                disabled={isLoading || isQuestionGenerating}
              >
                <Sparkles size={16} />
                {isQuestionGenerating ? (language === "en" ? "Generating..." : "جاري الإنشاء...") : (language === "en" ? "Generate" : "إنشاء")}
              </button>
            </div>
            <div className="ai-panel-body">
              {isQuestionGenerating ? (
                renderQuestionSkeletons()
              ) : sortedQuestions.length === 0 ? (
                <div className="ai-empty-state">
                  <p className="ai-empty-title">{language === "en" ? "No questions yet" : "لا توجد أسئلة بعد"}</p>
                  <p className="ai-empty-subtitle">
                    {language === "en" 
                      ? "Click Generate to create AI-powered questions based on the session data."
                      : "انقر فوق إنشاء لإنشاء أسئلة مدعومة بالذكاء الاصطناعي بناءً على بيانات الجلسة."}
                  </p>
                </div>
              ) : (
                <div className="ai-question-grid">
                  {sortedQuestions.map((question) => (
                    <div
                      key={question.id}
                      className={`ai-question-card priority-${question.priority.toLowerCase()} ${
                        isRTLContent ? "rtl" : ""
                      }`}
                    >
                      <div className="ai-question-header">
                        <span
                          className={`ai-priority-chip priority-${question.priority.toLowerCase()}`}
                        >
                          {question.priority}
                        </span>
                        <button
                          type="button"
                          className="ai-focus-add"
                          onClick={() => handleAddFocusArea(question.text)}
                        >
                          {language === "en" ? "Add focus" : "إضافة سؤال"}
                        </button>
                      </div>
                      <p className="ai-question-text">{question.text}</p>
                      <p className="ai-question-context">{question.context}</p>
                    </div>
                  ))}
                </div>
              )}
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
                  placeholder={language === "en" ? "Add a custom question" : "إضافة سؤال مخصص"}
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
                    <span>{prioritySelected ? customPriority : (language === "en" ? "Priority" : "الأولوية")}</span>
                    <ChevronDown size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  className="ai-cta"
                  onClick={handleAddCustomQuestion}
                >
                  <Plus size={16} />
                  {language === "en" ? "Add" : "إضافة"}
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
                      "--ai-priority-arrow-left": `${priorityMenuStyles.arrowLeft}px`,
                    } as React.CSSProperties}
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
          </section>

          <section className="ai-suggestions-panel">
            <div className="ai-panel-header">
              <h4 className="ai-panel-title">{language === "en" ? "Key Focus Areas" : "مجالات التركيز الرئيسية"}</h4>
              <button
                type="button"
                className={`ai-cta ai-cta-compact ${isFocusGenerating ? "loading" : ""}`}
                onClick={handleGenerateFocusAreas}
                disabled={isLoading || isFocusGenerating}
              >
                <Sparkles size={16} />
                {isFocusGenerating ? (language === "en" ? "Generating..." : "جاري الإنشاء...") : (language === "en" ? "Generate" : "إنشاء")}
              </button>
            </div>
            <div className="ai-panel-body">
              {isFocusGenerating ? (
                renderFocusSkeletons()
              ) : (
                <>
                  {activeGaps.length === 0 && resolvedGaps.length === 0 && (
                    <div className="ai-empty-state">
                      <p className="ai-empty-title">{language === "en" ? "No focus areas yet" : "لا توجد مجالات تركيز بعد"}</p>
                      <p className="ai-empty-subtitle">
                        {language === "en" 
                          ? "Click Generate to identify key investigation focus areas based on the session data."
                          : "انقر فوق إنشاء لتحديد مجالات التركيز الرئيسية للتحقيق بناءً على بيانات الجلسة."}
                      </p>
                    </div>
                  )}
                  {activeGaps.length > 0 && (
                    <div className="ai-gap-grid">
                      {activeGaps.map((gap) => (
                        <div
                          key={gap.id}
                          className={`ai-gap-card ${gap.resolved ? "ai-gap-resolved" : ""} severity-${gap.severity}`}
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
                              {language === "en" ? "Mark resolved" : "وضع علامة كمحلول"}
                            </button>
                          </div>
                          <p className="ai-gap-description">{gap.description}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {resolvedGaps.length > 0 && (
                    <div
                      className="ai-gap-resolved-section"
                      dir={isRTLContent ? "rtl" : "ltr"}
                    >
                      <div className="ai-gap-resolved-header">
                        <div>
                          <p className="ai-gap-resolved-label">{language === "en" ? "Resolved" : "محلول"}</p>
                          <p className="ai-gap-resolved-subtext">
                            {language === "en" 
                              ? "Completed focus areas appear here for quick reference."
                              : "تظهر مجالات التركيز المكتملة هنا للرجوع السريع."}
                          </p>
                        </div>
                      </div>
                      <div className="ai-gap-grid">
                        {resolvedGaps.map((gap) => (
                          <div
                            key={gap.id}
                            className="ai-gap-card ai-gap-resolved"
                          >
                            <div className="ai-gap-top">
                              <div className="ai-gap-title-row">
                                <h4>{gap.title}</h4>
                              </div>
                              <button
                                type="button"
                                className="ai-cta subtle"
                                onClick={() => handleToggleGapResolved(gap.id)}
                              >
                                {language === "en" ? "Mark unresolved" : "وضع علامة كغير محلول"}
                              </button>
                            </div>
                            <p className="ai-gap-description">{gap.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AISuggestions;
