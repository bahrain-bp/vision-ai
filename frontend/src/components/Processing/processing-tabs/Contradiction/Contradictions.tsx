import React, { useState, useEffect } from "react";
import "./Contradictions.css";

interface Contradiction {
  text: string;
  severity: "red" | "yellow" | "green";
}

interface AnalysisResponse {
  caseId: string;
  witnessId: string;
  results: Contradiction[];
  storedAt: string;
}

const severityIcons: Record<string, string> = {
  red: "❌",
  yellow: "⚠️",
  green: "✅",
};

const API_BASE_URL = "https://hvjlr6aa2m.execute-api.us-east-1.amazonaws.com/prod";

const BUCKET_NAME = "vision-investigation-system-052904446370";

const Contradictions: React.FC = () => {
  const [caseId, setCaseId] = useState("CASE-001");
  const [witnesses, setWitnesses] = useState<string[]>([]);
  const [selectedWitness, setSelectedWitness] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingWitnesses, setLoadingWitnesses] = useState(false);

  useEffect(() => {
    const loadWitnesses = async () => {
      if (!caseId.trim()) return;
      setLoadingWitnesses(true);

      try {
        const res = await fetch(
          `${API_BASE_URL}/contradictions/witnesses?caseId=${caseId}`
        );
        const json = await res.json();
        if (json.witnesses) {
          setWitnesses(json.witnesses);
        } else {
          setWitnesses([]);
        }
      } catch (err) {
        console.error("Error loading witnesses:", err);
        setWitnesses([]);
      }

      setLoadingWitnesses(false);
    };

    loadWitnesses();
  }, [caseId]);

  // ============================================================
  // ANALYZE CONTRADICTIONS
  // ============================================================
  const handleAnalyzeClick = async () => {
    if (!selectedWitness) return;

    setLoading(true);
    setAnalysis(null);

    try {
      const res = await fetch(`${API_BASE_URL}/contradictions/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, witnessId: selectedWitness }),
      });

      const raw = await res.json();
      console.log("Raw response:", raw);

      // Handle both wrapped and unwrapped responses
      let parsed: AnalysisResponse;
      if (typeof raw.body === "string") {
        parsed = JSON.parse(raw.body);
      } else if (typeof raw.body === "object") {
        parsed = raw.body;
      } else {
        parsed = raw;
      }

      console.log("Parsed analysis:", parsed);
      setAnalysis(parsed);
    } catch (err) {
      console.error("Error analyzing contradictions:", err);
    }

    setLoading(false);
  };

  return (
    <div className="contradictions-container">
      <h2>Contradiction Analysis</h2>

      {/* CASE ID INPUT */}
      <div className="case-id-container">
        <label>Case ID:</label>
        <input
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          placeholder="CASE-001"
        />
      </div>

      {/* WITNESS DROPDOWN */}
      <div className="dropdown-container">
        <label>Select Witness:</label>
        {loadingWitnesses ? (
          <p>Loading witnesses...</p>
        ) : (
          <select
            value={selectedWitness}
            onChange={(e) => setSelectedWitness(e.target.value)}
          >
            <option value="">-- Select Witness --</option>
            {witnesses.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* BUTTON */}
      <div className="analyze-button-container">
        <button
          className="analyze-btn"
          onClick={handleAnalyzeClick}
          disabled={loading || !selectedWitness}
        >
          {loading ? "Analyzing..." : "Analyze Contradictions"}
        </button>
      </div>

      {/* RESULTS */}
      {analysis && (
        <div className="results-container">
          <h3 className="results-heading">
            Results – {analysis.witnessId}
          </h3>

          <div className="contradiction-cards">
            {analysis.results.map((item, index) => (
              <div key={index} className={`contradiction-card ${item.severity}`}>
                <span className="severity-icon">
                  {severityIcons[item.severity]}
                </span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>

          {/* TO Show the full S3 path */}
          <div className="save-path">
            <p>
              <strong>Saved S3 Path:</strong>{" "}
              s3://{BUCKET_NAME}/{analysis.storedAt}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contradictions;
