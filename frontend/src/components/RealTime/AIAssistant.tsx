import React from "react";
import { Sparkles, Copy } from "lucide-react";

import {RecordingStatus } from "../../types/";

interface AIAssistantProps {
  sessionState: RecordingStatus;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ sessionState }) => {
  const suggestedQuestions = [
    { text: "Can you clarify the exact date?", color: "red" as const },
    { text: "Who informed you about this?", color: "yellow" as const },
    { text: "Was it communicated in writing?", color: "green" as const },
  ];

  return (
    <div className="ai-assistant-content">
      <button
        disabled={sessionState === "off"}
        className={`generate-questions-btn ${
          sessionState === "off" ? "disabled" : ""
        }`}
      >
        <Sparkles className="btn-icon" />
        <span>Generate Questions</span>
      </button>

      {sessionState === "on" && (
        <div className="suggested-questions">
          <p className="suggestions-title">Suggested Questions:</p>
          {suggestedQuestions.map((question, index) => {
            const borderColor = {
              red: "border-left-red",
              yellow: "border-left-yellow",
              green: "border-left-green",
            }[question.color];

            return (
              <div key={index} className={`question-card ${borderColor}`}>
                <p className="question-text">{question.text}</p>
                <button className="copy-question-btn">
                  <Copy className="btn-icon" />
                  <span>Copy</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {sessionState === "off" && (
        <p className="ai-placeholder">Start recording to generate questions</p>
      )}
    </div>
  );
};

export default AIAssistant;
