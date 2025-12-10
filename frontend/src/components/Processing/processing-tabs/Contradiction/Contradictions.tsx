import React, { useState, useEffect } from "react";
import "./Contradictions.css";

interface Contradiction {
  text: string;
  severity: "red" | "yellow" | "green";
}

interface ContradictionsProps {
  language: "en" | "ar";
}

interface AnalysisResponse {
  witnessId: string;
  results: Contradiction[];
  storedAt: string;
}

const priorityTags: Record<string, any> = {
  red: { en: "High Contradiction", ar: "تناقض عالي" },
  yellow: { en: "Medium Contradiction", ar: "تناقض متوسط" },
  green: { en: "No Contradiction", ar: "لا يوجد تناقض" },
};

const translations = {
  en: {
    title: "Contradiction Analysis",
    caption: "Automated analysis of contradictions based on witness statements.",
    selectWitness: "Select Witness:",
    loadingWitnesses: "Loading witnesses...",
    selectOption: "-- Select Witness --",
    analyzeBtn: "Analyze Contradictions",
    analyzing: "Analyzing...",
    results: "Results – ",
  },
  ar: {
    title: "تحليل التناقضات",
    caption: "تحليل آلي للتناقضات بناءًا على الشهادات.",
    selectWitness: "اختر الشاهد:",
    loadingWitnesses: "جاري تحميل الشهود...",
    selectOption: "-- اختر الشاهد --",
    analyzeBtn: "تحليل التناقضات",
    analyzing: "جاري التحليل...",
    results: "النتائج – ",
  },
};

const API_BASE_URL = process.env.REACT_APP_API_ENDPOINT;

const Contradictions: React.FC<ContradictionsProps> = ({ language }) => {
  const [witnesses, setWitnesses] = useState<string[]>([]);
  const [selectedWitness, setSelectedWitness] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingWitnesses, setLoadingWitnesses] = useState(false);

  useEffect(() => {
    const loadWitnesses = async () => {
      setLoadingWitnesses(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/contradictions/witnesses`
        );
        const json = await res.json();
        setWitnesses(json.witnesses || []);
      } catch (err) {
        console.error("Error loading witnesses:", err);
        setWitnesses([]);
      }
      setLoadingWitnesses(false);
    };
    loadWitnesses();
  }, []);

  const handleAnalyzeClick = async () => {
    if (!selectedWitness) return;
    setLoading(true);
    setAnalysis(null);

    try {
      const res = await fetch(`${API_BASE_URL}/contradictions/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ witnessId: selectedWitness }),
      });

      const raw = await res.json();
      let parsed: AnalysisResponse;

      if (typeof raw.body === "string") {
        parsed = JSON.parse(raw.body);
      } else if (typeof raw.body === "object") { 
        parsed = raw.body;
      } else {
        parsed = raw;
      }
      setAnalysis(parsed);
    } catch (err) {
      console.error("Error analyzing contradictions:", err);
    }
    setLoading(false);
  };

  return (
  <div
    className={`Contradictions-class ${language === "ar" ? "rtl" : ""}`}
    dir={language === "ar" ? "rtl" : "ltr"}
  >
    <h2 className="title">{translations[language].title}</h2>
    <p className="caption">{translations[language].caption}</p>

    {/* WITNESS DROPDOWN */}
    <div className="dropdown-container">
      <label>{translations[language].selectWitness}</label>

      {loadingWitnesses ? (
        <p>{translations[language].loadingWitnesses}</p>
      ) : (
        <select
          value={selectedWitness}
          onChange={(e) => setSelectedWitness(e.target.value)}
          disabled={loadingWitnesses}
        >
          <option value="">
            {translations[language].selectOption}
          </option>

          {witnesses.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      )}
    </div>

    {/* ANALYZE BUTTON */}
    <div className="analyze-button-container">
      <button
        className="analyze-btn"
        onClick={handleAnalyzeClick}
        disabled={loading || !selectedWitness}
      >
        {loading
          ? translations[language].analyzing
          : translations[language].analyzeBtn}
      </button>
    </div>

    {/* RESULTS */}
    {analysis && (
      <div className="results-container">
        <h3 className="results-heading">
          {translations[language].results}
          {analysis.witnessId}
        </h3>

        <div className="contradiction-cards">
          {analysis.results.map((item, index) => (
            <div key={index} className={`contradiction-card ${item.severity}`}>
              <span className={`priority-tag ${item.severity}`}>
                {priorityTags[item.severity][language]}
              </span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);
};

export default Contradictions;
