import React from 'react';
import { Loader } from 'lucide-react';

const ProcessingView = ({ sessionData }) => {
  return (
    <div className="processing-view">
      <div className="processing-content">
        <Loader className="processing-spinner" />
        <h2 className="processing-title">Processing Session Data</h2>
        <p className="processing-description">
          Analyzing transcription and translation quality...
        </p>
        <p className="session-reference">
          Session: {sessionData.sessionId}
        </p>
      </div>
    </div>
  );
};

export default ProcessingView;