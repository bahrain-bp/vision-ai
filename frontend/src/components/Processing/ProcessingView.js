import React, { useState } from 'react';
import { Loader } from 'lucide-react';
import '../../ProcessingView.css';

// Import tab components
import Classification from './processing-tabs/Classification';
import Rewrite from './processing-tabs/Rewrite';
import CameraFootage from './processing-tabs/CameraFootage';
import AISuggestions from './processing-tabs/AISuggestions';
import Contradictions from './processing-tabs/Contradictions';
import Outcome from './processing-tabs/Outcome';

const ProcessingView = ({ sessionData }) => {
  const [activeTab, setActiveTab] = useState('Classification');
  const [isProcessing, setIsProcessing] = useState(true);

  const tabs = [
    { id: 'Classification', label: 'Classification', component: Classification },
    { id: 'Rewrite', label: 'Rewrite', component: Rewrite },
    { id: 'CameraFootage', label: 'Camera footage', component: CameraFootage },
    { id: 'AISuggestions', label: 'AI Suggestions', component: AISuggestions },
    { id: 'Contradictions', label: 'Contradictions', component: Contradictions },
    { id: 'Outcome', label: 'Outcome', component: Outcome }
  ];

  // Mock function to simulate processing completion
  const handleContinue = () => {
    setIsProcessing(false);
  };

  // Render tab content based on active tab
  const renderTabContent = () => {
    if (isProcessing) {
      return (
        <div className="processing-content">
          <Loader className="processing-spinner" />
          <h2 className="processing-title">Processing Session Data</h2>
          <p className="processing-description">
            Analyzing transcription and translation quality...
          </p>
          <p className="session-reference">
            Session: {sessionData.sessionId}
          </p>
          <button 
            className="continue-btn"
            onClick={handleContinue}
          >
            Continue
          </button>
        </div>
      );
    }

     const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;
    return ActiveComponent ? <ActiveComponent sessionData={sessionData} /> : null;

  };

  return (
    <div className="processing-view">
      {/* Tab Navigation */}
      <div className="processing-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''} ${isProcessing ? 'disabled' : ''}`}
            onClick={() => !isProcessing && setActiveTab(tab.id)}
            disabled={isProcessing}
          >
            {tab.label}
            {!isProcessing && activeTab === tab.id && <div className="tab-indicator" />}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default ProcessingView;