import React, { useEffect, useState } from "react";
import { Loader } from "lucide-react";
import "../../ProcessingView.css";

// import processing tab components 
import Classification from "./processing-tabs/Classification";
import Rewrite from "./processing-tabs/Rewrite";
import CameraFootage from "./processing-tabs/CameraFootage";
import AISuggestions from "./processing-tabs/AISuggestions/AISuggestions";
import Contradictions from "./processing-tabs/Contradiction/Contradictions";
import Outcome from "./processing-tabs/Outcome";

export interface SessionData {
  sessionId: string;
  investigator?: string;
  language?: string;
  duration?: string;
  witness?: string;
  status?: string;
  extractedTextKey?: string;
}

interface ProcessingViewProps {
  sessionData: SessionData;
  selectedLanguage: "en" | "ar";
}

interface Tab {
  id: string;
  label: string;
  render: () => JSX.Element;
}


const ProcessingView: React.FC<ProcessingViewProps> = ({ sessionData, selectedLanguage }) => {
  const [activeTab, setActiveTab] = useState<string>("Classification");
  const [isProcessing, setIsProcessing] = useState<boolean>(true);
  const [extractedTextKey, setExtractedTextKey] = useState<string | undefined>(
    sessionData.extractedTextKey
  );

  useEffect(() => {
    setExtractedTextKey(sessionData.extractedTextKey);
  }, [sessionData.sessionId, sessionData.extractedTextKey]);

  const handleExtractedKey = (key: string) => {
    setExtractedTextKey(key);
  };

  const sessionWithKey: SessionData = {
    ...sessionData,
    extractedTextKey,
  };

  const tabs: Tab[] = [
    {
       id: "Classification",
       label: selectedLanguage === "en" ? "Classification" : "التصنيف",
       render: () => (
         <Classification
           sessionData={sessionWithKey}
           language={selectedLanguage}
           onExtractedKey={handleExtractedKey}
         />
       ),
       },
    { 
      id: "Rewrite",
      label: selectedLanguage === "en" ? "Rewrite" : "إعادة صياغة التقرير",
      render: () => <Rewrite sessionData={sessionWithKey} selectedLanguage={selectedLanguage} />,
     },
    { id: "AISuggestions",
     label: selectedLanguage === "en" ? "AI Suggestions" : "اقتراحات الذكاء الاصطناعي",
     render: () => <AISuggestions sessionData={sessionWithKey} />,
    },
    {
      id: "CameraFootage",
      label: "Camera Footage",
      render: () => <CameraFootage sessionData={sessionData} language={selectedLanguage} />,
    },
    {
      id: "Contradictions",
      label: "Contradictions",
      render: () => <Contradictions language={selectedLanguage} />,
    },
    {
      id: "Outcome",
      label: "Outcome",
      render: () => <Outcome />,
    },
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
    
    const activeTabConfig = tabs.find((tab) => tab.id === activeTab);
    return activeTabConfig ? activeTabConfig.render() : null;
  };
  
  const isAISuggestionsActive = !isProcessing && activeTab === "AISuggestions";

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

      <div className={`tab-content ${isAISuggestionsActive ? "ai-tab-content" : ""}`}>
        {renderTabContent()}
      </div>
    </div>
  );

 
};

export default ProcessingView;
