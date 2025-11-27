import React, { useEffect, useMemo, useState } from "react";
import AmazonNovaIcon from "../../common/AmazonNovaIcon";
import { SessionData } from "../ProcessingView";

type VerdictType = "guilty" | "not-guilty";

interface OutcomeProps {
  sessionData: SessionData;
}

const getOutcomeStorageKey = (sessionId: string): string =>
  `vision-ai-outcome-${sessionId}`;

const Outcome: React.FC<OutcomeProps> = ({ sessionData }) => {
  const [confidenceScore, setConfidenceScore] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [verdict, setVerdict] = useState<VerdictType>("not-guilty");
  const [rationale, setRationale] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
  const [hasOutcome, setHasOutcome] = useState<boolean>(false);
  const circleCircumference = useMemo(() => 2 * Math.PI * 52, []);
  const strokeDashoffset = useMemo(() => circleCircumference * (1 - confidenceScore / 100), [circleCircumference, confidenceScore]);

  useEffect(() => {
    const storageKey = getOutcomeStorageKey(sessionData.sessionId);
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setConfidenceScore(parsed.confidenceScore ?? 0);
        setVerdict(parsed.verdict || "not-guilty");
        setRationale(parsed.rationale || "");
        setLastGeneratedAt(parsed.generatedAt || null);
        setHasOutcome(true);
        setStatusMessage("Loaded last outcome for this session.");
      } else {
        setStatusMessage("");
        setHasOutcome(false);
        setConfidenceScore(0);
        setRationale("");
        setLastGeneratedAt(null);
      }
    } catch (error) {
      console.error("Failed to read stored outcome:", error);
    }
  }, [sessionData.sessionId]);

  const handleGenerateOutcome = async (): Promise<void> => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    setStatusMessage("Generating outcome...");
    try {
      const response = await fetch(
        "https://hvjlr6aa2m.execute-api.us-east-1.amazonaws.com/prod/outcome/verdict",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionData.sessionId,
            caseId: sessionData.caseId || "unknown",
            language: "en",
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate verdict");
      }

      const data = await response.json();
      setConfidenceScore(data.confidenceScore);
      setVerdict(data.recommendedVerdict === "Guilty" ? "guilty" : "not-guilty");
      setRationale(data.rationale);
      const payload = {
        confidenceScore: data.confidenceScore,
        verdict: data.recommendedVerdict === "Guilty" ? "guilty" : "not-guilty",
        rationale: data.rationale,
        generatedAt: data.generatedAt || new Date().toISOString(),
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          getOutcomeStorageKey(sessionData.sessionId),
          JSON.stringify(payload)
        );
      }
      setLastGeneratedAt(payload.generatedAt);
      setHasOutcome(true);
      setStatusMessage("Outcome generated successfully.");
    } catch (error) {
      console.error("Error generating outcome:", error);
      setStatusMessage("Failed to generate outcome");
    } finally {
      setIsGenerating(false);
    }
  };

  const formattedGeneratedAt = lastGeneratedAt
    ? new Date(lastGeneratedAt).toLocaleString()
    : null;
  const shouldShowBanner =
    statusMessage || isGenerating || formattedGeneratedAt;

  const renderSkeletonLine = (width: string): JSX.Element => (
    <div
      style={{
        width,
        height: 12,
        borderRadius: 9999,
        backgroundColor: "#e5e7eb",
        marginBottom: 8,
      }}
    />
  );

  const renderConfidenceSkeleton = (): JSX.Element => (
    <div className="outcome-confidence" aria-hidden="true">
      <div className="confidence-score">
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            backgroundColor: "#f1f5f9",
          }}
        />
      </div>
      <div className="confidence-details">
        {renderSkeletonLine("80%")}
        {renderSkeletonLine("65%")}
      </div>
    </div>
  );

  const renderVerdictSkeleton = (): JSX.Element => (
    <div className="outcome-verdict" aria-hidden="true">
      {renderSkeletonLine("40%")}
      {renderSkeletonLine("30%")}
      {renderSkeletonLine("90%")}
      {renderSkeletonLine("85%")}
    </div>
  );

  return (
    <div className="ai-suggestions-view outcome-view">
      {shouldShowBanner && (
        <div className="ai-status-banner" aria-live="polite">
          {statusMessage && <span>{statusMessage}</span>}
          {isGenerating && <span className="ai-status-pulse">Processing…</span>}
          {formattedGeneratedAt && (
            <span className="ai-status-timestamp">
              Outcome updated {formattedGeneratedAt}
            </span>
          )}
        </div>
      )}
      <div className="outcome-integrated-card">
        <div className="outcome-integrated-header">
          <div>
            
            <h3 className="ai-main-title">Confidence &amp; Verdict</h3>
            <p className="ai-main-subtitle">
              Deliver a comprehensive case assessment with confidence scoring and a clear verdict explanation.
            </p>
          </div>
          <div className="outcome-integrated-actions">
            <button
              type="button"
              className={`ai-cta ai-cta-compact ${isGenerating ? "loading" : ""}`}
              onClick={handleGenerateOutcome}
              disabled={isGenerating}
            >
              <AmazonNovaIcon size={16} />
              {isGenerating ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>

        <div className="outcome-dual-grid">
          <section className="outcome-panel">
            <div className="outcome-panel-heading">
              <h4>Confidence score</h4>
            </div>
            {isGenerating ? (
              renderConfidenceSkeleton()
            ) : (
              <div className="outcome-confidence">
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
                    <span className="score-caption">Confidence</span>
                  </div>
                </div>
                <div className="confidence-details">
                  {hasOutcome ? (
                    <p>
                      Based on the combined assessment of processed session data, and contradiction analysis.
                    </p>
                  ) : (
                    <p
                      className="ai-empty-subtext"
                      style={{ color: "#6b7280", fontStyle: "italic" }}
                    >
                      Click Generate to calculate confidence using the latest investigation
                      insights.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="outcome-panel">
            <div className="outcome-panel-heading">
              <h4>Verdict explanation</h4>
            </div>
            {isGenerating ? (
              renderVerdictSkeleton()
            ) : hasOutcome ? (
              <div className="outcome-verdict">
                <div className="verdict-header">
                  <div>
                    <p className="verdict-label">Recommended Verdict</p>
                    <span className={`verdict-pill ${verdict}`}>
                      {verdict === "guilty" ? "Guilty" : "Not Guilty"}
                    </span>
                  </div>
                </div>
                <div className="verdict-rationale">
                  <h4>Rationale</h4>
                  <p style={{ whiteSpace: "pre-wrap" }}>{rationale}</p>
                </div>
              </div>
            ) : (
              <div className="ai-empty-state">
                <p className="ai-empty-title">No verdict yet</p>
                <p
                  className="ai-empty-subtext"
                  style={{ color: "#6b7280", fontStyle: "italic" }}
                >
                  Click Generate to surface the recommended verdict and summary rationale.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Outcome;
