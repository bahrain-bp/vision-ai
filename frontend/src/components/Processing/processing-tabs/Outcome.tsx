import React, { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { SessionData } from "../ProcessingView";

type VerdictType = "guilty" | "not-guilty";

interface OutcomeProps {
  sessionData: SessionData;
  language?: "en" | "ar";
  persistedData?: any;
  onDataChange?: (data: any) => void;
}

const isArabicLanguage = (value?: string | null): boolean => {
  if (!value) return false;
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

const Outcome: React.FC<OutcomeProps> = ({ sessionData, language, persistedData = null, onDataChange }) => {
  const resolvedLanguage = language || sessionData.language || "en";
  const isRTL = isArabicLanguage(resolvedLanguage);
  const [confidenceScore, setConfidenceScore] = useState<number>(persistedData?.confidenceScore || 0);
  const [verdict, setVerdict] = useState<VerdictType>(persistedData?.verdict || "not-guilty");
  const [rationale, setRationale] = useState<string[]>(persistedData?.rationale || []);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  
  // Sync with persisted data when returning to tab
  React.useEffect(() => {
    if (persistedData) {
      if (persistedData.confidenceScore !== undefined) setConfidenceScore(persistedData.confidenceScore);
      if (persistedData.verdict) setVerdict(persistedData.verdict);
      if (persistedData.rationale) setRationale(persistedData.rationale);
    }
  }, [persistedData]);
  const circleCircumference = useMemo(() => 2 * Math.PI * 52, []);
  const strokeDashoffset = useMemo(() => circleCircumference * (1 - confidenceScore / 100), [circleCircumference, confidenceScore]);

  const isLoadingState = isGenerating;

  const handleGenerate = async (): Promise<void> => {
    if (isGenerating) {
      return;
    }
    setIsGenerating(true);
    setStatusMessage(
      resolvedLanguage === "en" ? "Generating outcome..." : "جارٍ إنشاء النتيجة..."
    );

    try {
      const response = await fetch(
        "https://hvjlr6aa2m.execute-api.us-east-1.amazonaws.com/prod/outcome",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
            sessionId: sessionData.sessionId,
            language: resolvedLanguage
          })
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate outcome");
      }

      const data = await response.json();
      const normalizedVerdict = (data.verdict || "not guilty")
        .toString()
        .toLowerCase()
        .replace(/\s+/g, "-") as VerdictType;

      const normalizedRationale = Array.isArray(data.rationale)
        ? data.rationale.filter(Boolean)
        : data.rationale
          ? [data.rationale]
          : [];

      const newConfidence = typeof data.confidence === "number"
          ? Math.max(0, Math.min(100, Math.round(data.confidence)))
          : 0;
      const newVerdict = normalizedVerdict === "guilty" ? "guilty" : "not-guilty";
      
      setConfidenceScore(newConfidence);
      setVerdict(newVerdict);
      setRationale(normalizedRationale);
      onDataChange?.({ confidenceScore: newConfidence, verdict: newVerdict, rationale: normalizedRationale });
      setStatusMessage(
        resolvedLanguage === "en" ? "Outcome generated!" : "تم إنشاء النتيجة!"
      );
    } catch (error) {
      console.error("Error:", error);
      setStatusMessage(
        resolvedLanguage === "en" ? "Failed to generate outcome" : "فشل إنشاء النتيجة"
      );
    } finally {
      setIsGenerating(false);
      setTimeout(() => setStatusMessage(""), 2500);
    }
  };


  return (
    <div
      className={`ai-suggestions-view outcome-view ${isRTL ? "rtl" : ""}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {statusMessage && (
        <div className="ai-status-banner" aria-live="polite">
          <span>{statusMessage}</span>
        </div>
      )}
      <div className="outcome-integrated-card">
            <div className="outcome-integrated-header">
          <div>
            
            <h3 className="ai-main-title">
              {resolvedLanguage === "en" ? "Confidence & Verdict" : "الثقة والحكم"}
            </h3>
            <p className="ai-main-subtitle">
              {resolvedLanguage === "en"
                ? "Deliver a comprehensive case assessment with confidence scoring and a clear verdict explanation."
                : "تقديم تقييم شامل للقضية مع درجة الثقة وتفسير واضح للحكم."}
            </p>
          </div>
          <button
            type="button"
            className={`ai-cta ai-cta-compact ${isGenerating ? "loading" : ""}`}
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            <Sparkles size={16} />
            {isGenerating
              ? resolvedLanguage === "en"
                ? "Generating..."
                : "جاري الإنشاء..."
              : resolvedLanguage === "en"
              ? "Generate"
              : "إنشاء"}
          </button>
        </div>

        <div className="outcome-dual-grid">
          <section className="outcome-panel">
            <div className="outcome-panel-heading">
              <h4>{resolvedLanguage === "en" ? "Confidence score" : "درجة الثقة"}</h4>
            </div>
            <div className="outcome-confidence">
              {isLoadingState ? (
                <>
                  <div className="confidence-score">
                    <div className="ai-skeleton-circle" />
                    <div className="score-label">
                      <span className="ai-skeleton-line short" />
                      <span className="ai-skeleton-line short" />
                    </div>
                  </div>
                  <div className="confidence-details">
                    <div className="ai-skeleton-line wide" />
                    <div className="ai-skeleton-line" />
                  </div>
                </>
              ) : (
                <>
                  <div className="confidence-score">
                    <svg viewBox="0 0 120 120">
                      <circle className="track" cx="60" cy="60" r="52" />
                      <circle
                        className="progress"
                        cx="60"
                        cy="60"
                        r="52"
                        strokeDasharray={circleCircumference}
                        strokeDashoffset={strokeDashoffset}
                      />
                    </svg>
                    <div className="score-label">
                      <span className="score-value">{confidenceScore}%</span>
                      <span className="score-caption">
                        {resolvedLanguage === "en" ? "Confidence" : "الثقة"}
                      </span>
                    </div>
                  </div>
                  <div className="confidence-details">
                    <p>
                      {resolvedLanguage === "en"
                        ? "Based on the combined assessment of processed session data, and contradiction analysis."
                        : "استنادًا إلى التقييم المشترك لبيانات الجلسة المعالجة وتحليل التناقضات."}
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="outcome-panel">
            <div className="outcome-panel-heading">
              <h4>{resolvedLanguage === "en" ? "Verdict explanation" : "تفسير الحكم"}</h4>
            </div>
            <div className="outcome-verdict">
              {isLoadingState ? (
                <>
                  <div className="verdict-header">
                    <div className="ai-skeleton-line short" style={{ width: "140px" }} />
                    <span className="verdict-pill skeleton-pill" style={{ width: "90px" }} />
                  </div>
                  <div className="verdict-rationale">
                    <div className="ai-skeleton-line short" style={{ width: "120px" }} />
                    <div className="ai-skeleton-line wide" />
                    <div className="ai-skeleton-line" />
                  </div>
                </>
              ) : (
                <>
                  <div className="verdict-header">
                    <div>
                      <p className="verdict-label">
                        {resolvedLanguage === "en" ? "Recommended Verdict" : "الحكم الموصى به"}
                      </p>
                      <span className={`verdict-pill ${verdict}`}>
                        {verdict === "guilty"
                          ? resolvedLanguage === "en"
                            ? "Guilty"
                            : "مذنب"
                          : resolvedLanguage === "en"
                          ? "Not Guilty"
                          : "غير مذنب"}
                      </span>
                    </div>
                  </div>
                  <div className="verdict-rationale">
                    <h4>{resolvedLanguage === "en" ? "Rationale" : "التبرير"}</h4>
                    {rationale.length === 0 ? (
                      <p className="outcome-muted">
                        {resolvedLanguage === "en"
                          ? "Click Generate to see the rationale."
                          : "انقر فوق إنشاء لعرض التبرير."}
                      </p>
                    ) : (
                      <ul>
                        {rationale.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Outcome;
