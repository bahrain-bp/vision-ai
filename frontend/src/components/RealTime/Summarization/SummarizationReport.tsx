import React, { useState, useContext } from 'react';
import { FileText } from 'lucide-react';
import { TranscriptionContext } from '../../../context/TranscriptionContext';
import { useCaseContext } from '../../../hooks/useCaseContext';
import { useLanguage } from '../../../context/LanguageContext';
import SessionDetailsCard from './SessionDetailsCard';
import CustomizationPanel from './CustomizationPanel';
import LoadingState from './LoadingState';
import ErrorDisplay from './ErrorDisplay';
import SummaryDisplay from './SummaryDisplay';
import './SummarizationReport.css';

/*
 * SummarizationReport (Main Container)
 * 
 * Purpose: Orchestrate AI-powered investigation summary generation
 * 
 * Features: Integrates all summarization sub-components, manages state,
 * handles API communication with AWS Bedrock Nova Lite, coordinates
 * real-time transcript data from Transcription context
 * 
 * Integration: Main entry point for Summarization feature, connects to
 * Identity Verification (person type), Transcription (transcript data),
 * and Language contexts for bilingual support
 */

interface SessionData {
  sessionId: string;
  participant: string;
  language: string;
  duration: string;
  status: string;
}

interface SummarizationReportProps {
  sessionData: SessionData;
}

const SummarizationReport: React.FC<SummarizationReportProps> = ({
  sessionData
}) => {
  // State Management
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ar'>('en');
  const [summaryLength, setSummaryLength] = useState<'short' | 'medium' | 'long' | 'extra-long'>('medium');

  // API Configuration
  const API_URL = 'https://yphcka81y6.execute-api.us-east-1.amazonaws.com/prod/summarize';

  // Context Integration
  const transcriptionContext = useContext(TranscriptionContext);
  const realTranscript = transcriptionContext?.getFullTranscript || '';
  
  const { currentPersonType, currentCase, currentSession } = useCaseContext();
  const participantType = currentPersonType || 'Not set';
  
  const { t } = useLanguage();

  // Demo transcript fallback
  const demoTranscript = `[00:00:15] Investigator: Please state your full name for the record.

[00:00:18] Witness: My name is Ahmed Al-Mahmood, I am the Chief Financial Officer at Gulf Trading Company.

[00:00:25] Investigator: Thank you. Can you describe what you discovered during the October audit?

[00:00:32] Witness: Yes. During our quarterly audit in October, I found unauthorized financial transactions. The total amount was approximately 75,000 Bahraini Dinars.

[00:00:45] Investigator: When did these transactions occur?

[00:00:50] Witness: Between July and September 2025. There were fifteen separate transfers, each between 3,000 and 8,000 BHD.

[00:01:05] Investigator: Do you know who authorized these transactions?

[00:01:10] Witness: They were not properly authorized. The transfers were made by Layla Hassan, our former Accounts Manager. She had access to the payment system.

[00:01:25] Investigator: What evidence supports this?

[00:01:30] Witness: We have bank statements, email correspondence, and system access logs showing she accessed the system after hours on multiple occasions. We also found forged approval documents.

[00:01:50] Investigator: Were there any other witnesses?

[00:01:55] Witness: Yes, Khalid Mohammed, our Internal Auditor, first detected the discrepancies during the compliance review. He can corroborate everything I have said.

[00:02:10] Investigator: Thank you. Is there anything else you would like to add?

[00:02:15] Witness: I recommend immediate action. The suspect should be apprehended, and we need to freeze her accounts and conduct a full forensic analysis.

[00:02:30] Investigator: Noted. This concludes the testimony. Session ended at 10:32 AM.`;

  // Generate Summary Handler
  const generateSummary = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);

    // Use real transcript if available, otherwise fallback to demo
    const transcriptToUse = realTranscript && realTranscript.trim().length > 0 
      ? realTranscript 
      : demoTranscript;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report_text: transcriptToUse,
          case_id: currentCase?.caseId || 'CASE-2025-001',
          session_id: currentSession?.sessionId || sessionData.sessionId,
          user_id: 'prosecutor-202200471',
          summary_length: summaryLength,
          language: selectedLanguage
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSummary(data);
      } else {
        setError(data.error || 'Failed to generate summary');
      }
    } catch (err: any) {
      setError('Failed to connect to API: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="summarization-container">
      
      {/* Header */}
      <div className="summarization-header">
        <FileText className="summarization-header-icon" />
        <h2 className="summarization-title">
          {t('summarization.title')}
        </h2>
      </div>

      {/* Session Details */}
      <SessionDetailsCard
        sessionId={sessionData.sessionId}
        duration={sessionData.duration}
        personType={participantType}
        status={sessionData.status}
      />

      {/* Customization Panel */}
      <CustomizationPanel
        realTranscript={realTranscript}
        selectedLanguage={selectedLanguage}
        summaryLength={summaryLength}
        loading={loading}
        onLanguageChange={setSelectedLanguage}
        onLengthChange={setSummaryLength}
        onGenerate={generateSummary}
      />

      {/* Loading State */}
      {loading && <LoadingState />}

      {/* Error Display */}
      {error && <ErrorDisplay error={error} />}

      {/* Summary Display */}
      {summary && !loading && (
        <SummaryDisplay
          summary={summary}
          selectedLanguage={selectedLanguage}
          sessionId={sessionData.sessionId}
        />
      )}
    </div>
  );
};

export default SummarizationReport;