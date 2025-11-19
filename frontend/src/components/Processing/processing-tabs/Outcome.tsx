import React, { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

type VerdictType = "guilty" | "not-guilty";

const Outcome: React.FC = () => {
  const [confidenceScore, setConfidenceScore] = useState<number>(85);
  const [isConfidenceGenerating, setIsConfidenceGenerating] = useState<boolean>(false);
  const [verdict, setVerdict] = useState<VerdictType>("guilty");
  const [isVerdictGenerating, setIsVerdictGenerating] = useState<boolean>(false);
  const circleCircumference = useMemo(() => 2 * Math.PI * 52, []);
  const strokeDashoffset = useMemo(() => circleCircumference * (1 - confidenceScore / 100), [circleCircumference, confidenceScore]);

  const nextRandomScore = (): number => Math.floor(Math.random() * 25) + 70;

  const handleGenerateConfidence = (): void => {
    if (isConfidenceGenerating) {
      return;
    }
    setIsConfidenceGenerating(true);
    setTimeout(() => {
      setConfidenceScore(nextRandomScore());
      setIsConfidenceGenerating(false);
    }, 900);
  };

  const handleGenerateVerdict = (): void => {
    if (isVerdictGenerating) {
      return;
    }
    setIsVerdictGenerating(true);
    setTimeout(() => {
      setVerdict((prev) => (prev === "guilty" ? "not-guilty" : "guilty"));
      setIsVerdictGenerating(false);
    }, 900);
  };


  return (
    <div className="ai-suggestions-view outcome-view">
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
              className={`ai-cta ai-cta-compact ${isConfidenceGenerating ? "loading" : ""}`}
              onClick={handleGenerateConfidence}
              disabled={isConfidenceGenerating}
            >
              <Sparkles size={16} />
              {isConfidenceGenerating ? "Generating..." : "Confidence"}
            </button>
            <button
              type="button"
              className={`ai-cta ai-cta-compact ${isVerdictGenerating ? "loading" : ""}`}
              onClick={handleGenerateVerdict}
              disabled={isVerdictGenerating}
            >
              <Sparkles size={16} />
              {isVerdictGenerating ? "Generating..." : "Verdict"}
            </button>
          </div>
        </div>

        <div className="outcome-dual-grid">
          <section className="outcome-panel">
            <div className="outcome-panel-heading">
              <h4>Confidence score</h4>
            </div>
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
                
                <p>
                  Based on the combined assessment of processed session data, and contradiction analysis.
                </p>
              </div>
            </div>
          </section>

          <section className="outcome-panel">
            <div className="outcome-panel-heading">
              <h4>Verdict explanation</h4>
            </div>
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
                <ul>
                  <li>Surveillance, biometric, and temporal signals align above operational threshold.</li>
                  <li>Contradictions resolved after cross-checking rewritten summaries.</li>
                  <li>Residual uncertainties documented for manual legal follow-up.</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Outcome;
