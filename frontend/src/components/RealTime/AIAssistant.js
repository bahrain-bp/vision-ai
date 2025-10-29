import React from 'react';
import { Sparkles, Copy } from 'lucide-react';

const AIAssistant = ({ sessionState }) => {
  const suggestedQuestions = [
    { text: 'Can you clarify the exact date?', color: 'red' },
    { text: 'Who informed you about this?', color: 'yellow' },
    { text: 'Was it communicated in writing?', color: 'green' },
  ];

  return (
    <div className="ai-assistant-content">
      <button
        disabled={sessionState === 'ready'}
        className={`generate-questions-btn ${sessionState === 'ready' ? 'disabled' : ''}`}
      >
        <Sparkles className="btn-icon" />
        <span>Generate Questions</span>
      </button>

      {sessionState === 'recording' && (
        <div className="suggested-questions">
          <p className="suggestions-title">Suggested Questions:</p>
          {suggestedQuestions.map((question, index) => {
            const borderColor = {
              red: 'border-left-red',
              yellow: 'border-left-yellow',
              green: 'border-left-green',
            }[question.color];

            return (
              <div
                key={index}
                className={`question-card ${borderColor}`}
              >
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

      {sessionState === 'ready' && (
        <p className="ai-placeholder">
          Start recording to generate questions
        </p>
      )}
    </div>
  );
};

export default AIAssistant;