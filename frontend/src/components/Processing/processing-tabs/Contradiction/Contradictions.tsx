import React, { useState } from "react";
import "./Contradictions.css";

interface Contradiction {
  text: string;
  severity: "red" | "yellow" | "green";
}

interface Witness {
  name: string;
  contradictions: Contradiction[];
}

// mock data 
const witnesses: Witness[] = [
  {
    name: "Robert Johnson - Witness Statement #3",
    contradictions: [
      { text: "Subject claimed to have never been to the location, but phone GPS data shows presence at the scene.", severity: "red" },
      { text: "Subject denied knowing the complainant personally, but text messages show frequent communication.", severity: "yellow" },
      { text: "Subject mentioned being alone, but earlier stated someone else was present. This requires clarification.", severity: "yellow" },
    ],
  },
  {
    name: "Emily Smith - Witness Statement #1",
    contradictions: [
      { text: "Subject stated they were at home, but security footage shows them outside.", severity: "red" },
      { text: "Subject claimed not to know the other party, but emails indicate previous contact.", severity: "yellow" },
      { text: "Timing of the phone call conflicts with their stated location.", severity: "yellow" },
    ],
  },
  {
    name: "Michael Brown - Witness Statement #2",
    contradictions: [
      { text: "Subject reported no involvement, but credit card records show purchases at the scene.", severity: "red" },
      { text: "Subject denied seeing anyone else, but CCTV footage contradicts this.", severity: "yellow" },
      { text: "Subject claimed they were alone, and a neighbor confirms they were indeed alone.", severity: "green" },
    ],
  },
];

// severity levels
const severityIcons: { [key: string]: string } = {
  red: "❌",
  yellow: "⚠️",
  green: "✅",
};


const Contradictions: React.FC = () => {
  const [selectedWitness, setSelectedWitness] = useState<Witness | null>(witnesses[0]);
  const [showResults, setShowResults] = useState(false);

  const handleAnalyzeClick = () => {
    setShowResults(true);
  };

  return (
    <div className="contradictions-container">
      <h2>Analyze Contradictions</h2>

      <div className="dropdown-container">
        <label htmlFor="witness-select">Select Witness:</label>
        <select
          id="witness-select"
          value={selectedWitness?.name}
          onChange={(e) => {
            const witness = witnesses.find((w) => w.name === e.target.value) || null;
            setSelectedWitness(witness);
            setShowResults(false); // reset results when switching witness
          }}
        >
          {witnesses.map((w) => (
            <option key={w.name} value={w.name}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      <div className="analyze-button-container">
        <button className="analyze-btn" onClick={handleAnalyzeClick}>
          Analyze Contradictions
        </button>
      </div>

      {showResults && selectedWitness && (
        <div className="results-container">
          <h3 className="results-heading">
           Contradiction Analysis Results
          </h3>
          <div className="contradiction-cards">
            {selectedWitness.contradictions.map((c, idx) => (
              <div key={idx} className={`contradiction-card ${c.severity}`}>
                <span className="severity-icon">{severityIcons[c.severity]}</span>
                <span>{c.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Contradictions;
