import React, { useState } from "react";
import { Loader } from "lucide-react";
import "../../ProcessingView.css";

// import processing tab components 
import Classification from "./processing-tabs/Classification";
import Rewrite from "./processing-tabs/Rewrite";
import CameraFootage from "./processing-tabs/CameraFootage";
import AISuggestions from "./processing-tabs/AISuggestions";
import Contradictions from "./processing-tabs/Contradiction/Contradictions";
import Outcome from "./processing-tabs/Outcome";

export interface SessionData {
  sessionId: string;
  investigator?: string;
  language?: string;
  duration?: string;
  witness?: string;
  status?: string;
  // we can other fields as needed later 
}

interface ProcessingViewProps {
  sessionData: SessionData;
}

interface Tab {
  id: string; 
  label: string;
  component: React.ComponentType<{ sessionData: SessionData}>;
}


const ProcessingView: React.FC<ProcessingViewProps> = ({ sessionData }) => {
  const [activeTab, setActiveTab] = useState<string>("Classification");
  const [isProcessing, setIsProcessing] = useState<boolean>(true); // processing state 


  const tabs: Tab[] = [
    {id: "Classification", label:"Classification", component:Classification},
    {id: "Rewrite", label:"Rewrite", component:Rewrite}, 
    {id: "CameraFootage", label:"Camera Footage", component:CameraFootage},
    {id: "AISuggestions", label:"AI Suggestions", component:AISuggestions},
    {id: "Contradictions", label:"Contradictions", component:Contradictions},
    {id: "Outcome", label:"Outcome", component:Outcome }


  ]; 
   
  // logic of the cont button could be changed later when theres actual backend processing  
  const handleContinue = (): void => {
    setIsProcessing(false);
  }

  const renderTabContent = (): JSX.Element | null => {
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
  
  // dynamic tab render 
  return (
    <div className="processing-view">
      <div className="processing-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""} ${isProcessing ? "disabled" : ""}`}
            onClick={() => !isProcessing && setActiveTab(tab.id)}
            disabled={isProcessing}
          >
            {tab.label}
            {!isProcessing && activeTab === tab.id && <div className="tab-indicator" />}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {renderTabContent()}
      </div>
    </div>
  );

 
};

export default ProcessingView;
