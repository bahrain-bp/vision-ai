import React, { useState } from "react";
import {
  BadgeCheck, Wand2, Camera, Lightbulb, CircleAlert, UploadCloud,
} from "lucide-react";
import "./ProcessingView.css";

import Classification from "./processing-tabs/Classification";
import Rewrite from "./processing-tabs/Rewrite";
import CameraFootage from "./processing-tabs/CameraFootage";
import AISuggestions from "./processing-tabs/AISuggestions";
import Contradictions from "./processing-tabs/Contradictions";
import Outcome from "./processing-tabs/Outcome";

export interface SessionData {
  sessionId: string;
  investigator?: string;
  language?: string;
  duration?: string;
  witness?: string;
  status?: string;
}

interface ProcessingViewProps { sessionData: SessionData; }

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ComponentType<{ sessionData: SessionData }>;
}

const ProcessingView: React.FC<ProcessingViewProps> = ({ sessionData }) => {
  const [mode, setMode] = useState<"real" | "processing">("processing");
  const [activeTab, setActiveTab] = useState<string>("Rewrite");

  const tabs: Tab[] = [
    { id: "Classification", label: "Classification", icon: <BadgeCheck size={14} />, component: Classification },
    { id: "Rewrite", label: "Rewrite", icon: <Wand2 size={14} />, component: Rewrite },
    { id: "CameraFootage", label: "Camera footage", icon: <Camera size={14} />, component: CameraFootage },
    { id: "AISuggestions", label: "AI Suggestions", icon: <Lightbulb size={14} />, component: AISuggestions },
    { id: "Contradictions", label: "Contradictions", icon: <CircleAlert size={14} />, component: Contradictions },
    { id: "Outcome", label: "Outcome", icon: <UploadCloud size={14} />, component: Outcome },
  ];

  const Active = tabs.find((t) => t.id === activeTab)!.component;

  return (
    <div className="page">
      <header className="app-header">
        <h1 className="app-title">AI Audio Assistant</h1>
        <p className="app-subtitle">
          Record, transcribe, translate, summarize, and analyze your audio in real-time
        </p>
        <div className="mode-switch">
          <button className={`mode-btn ${mode === "real" ? "active" : ""}`} onClick={() => setMode("real")} type="button">
            Real-Time
          </button>
          <button className={`mode-btn ${mode === "processing" ? "active" : ""}`} onClick={() => setMode("processing")} type="button">
            Processing
          </button>
        </div>
      </header>

      <div className="pill-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`pill ${activeTab === t.id ? "selected" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span className="pill-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <section className="content-area">
        <Active sessionData={sessionData} />
      </section>
    </div>
  );
};

export default ProcessingView;
