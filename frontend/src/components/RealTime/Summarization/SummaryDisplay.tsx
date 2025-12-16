import React from 'react';
import { CheckCircle } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import TranslationPDFExporter from '../Translation/TranslationPDFExporter';

/*
 * SummaryDisplay
 * 
 * Purpose: Display generated AI summary with metadata and export options
 * 
 * Features: Shows summary text with RTL support for Arabic, displays
 * metadata (summary ID, case ID, language), integrates PDF/Word export
 * 
 * Integration: Receives summary data from AWS Bedrock Nova Lite,
 * uses Fatima's TranslationPDFExporter for document generation
 */

interface SummaryDisplayProps {
  summary: any;
  selectedLanguage: 'en' | 'ar';
  sessionId: string;
}

const SummaryDisplay: React.FC<SummaryDisplayProps> = ({
  summary,
  selectedLanguage,
  sessionId
}) => {
  // Bilingual support
  const { t } = useLanguage();

  // Format summary text for export
  const formatSummaryForExport = () => {
    if (!summary) return '';
    return summary.summary;
  };

  return (
    <div className="summary-results">
      
      {/* Summary Content Card */}
      <div className="summary-content-card">
        <h3 className="summary-content-header">
          <CheckCircle className="summary-success-icon" />
          {t('summarization.generatedSummary')}
        </h3>
        
        {/* Summary Text with RTL support */}
        <div className={`summary-text-container ${selectedLanguage === 'ar' ? 'rtl' : ''}`}>
          {summary.summary}
        </div>
      </div>

      {/* Summary Metadata Card */}
      <div className="session-details-card">
        <h3 className="details-title">
          {t('summarization.summaryMetadata')}
        </h3>
        
        {/* Metadata Grid */}
        <div className="metadata-grid">
          
          {/* Summary ID */}
          <div className="detail-item">
            <p className="detail-label">
              {t('summarization.summaryId')}:
            </p>
            <p className="metadata-value">
              {summary.summary_id}
            </p>
          </div>

          {/* Case ID */}
          <div className="detail-item">
            <p className="detail-label">
              {t('summarization.caseId')}:
            </p>
            <p className="detail-value">
              {summary.case_id}
            </p>
          </div>

          {/* Language */}
          <div className="detail-item">
            <p className="detail-label">
              {t('summarization.language')}:
            </p>
            <p className="detail-value">
              {selectedLanguage === 'en' ? t('summarization.english') : t('summarization.arabic')}
            </p>
          </div>
        </div>
      </div>

      {/* Export Section */}
      <div className="export-section">
        <TranslationPDFExporter
          transcript={formatSummaryForExport()}
          title="Investigation Summary Report"
          fileName={`Summary_${sessionId}`}
          sessionDate={new Date().toLocaleDateString()}
          contentType="report"
        />
      </div>
    </div>
  );
};

export default SummaryDisplay;