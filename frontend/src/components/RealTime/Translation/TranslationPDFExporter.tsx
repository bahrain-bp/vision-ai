import React, { useState } from "react";
import { Download, Printer } from "lucide-react";
import "./TranslationPDFExporter.css";
import { useLanguage } from "../../../context/LanguageContext";

interface TranslationPDFExporterProps {
  transcript: string;
  title: string;
  fileName: string;
  sessionDate?: string;
  contentType?: 'transcript' | 'report'; 
}

const TranslationPDFExporter: React.FC<TranslationPDFExporterProps> = ({
  transcript,
  title,
  fileName,
  sessionDate = new Date().toLocaleDateString(),
  contentType = 'transcript', 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { t, language } = useLanguage();

  // Generate PDF using browser print
  const generatePDF = () => {
    if (!transcript) return;
    
    setIsGenerating(true);
    
    try {
      const lines = transcript.split('\n').filter(line => line.trim());
      
      const headerHTML = `
        <div class="pdf-header" dir="${language === 'ar' ? 'rtl' : 'ltr'}">
          <h1>${title}</h1>
          <p>${language === 'ar' ? 'التاريخ:' : 'Date:'} ${sessionDate}</p>
        </div>
        ${contentType === 'transcript' ? 
          `<div class="pdf-section-title" dir="${language === 'ar' ? 'rtl' : 'ltr'}">
            <h2>${language === 'ar' ? 'النسخ' : 'Transcript'}</h2>
          </div>` : ''}
      `;

      let contentHTML = '';
      
      if (contentType === 'report') {
        contentHTML = lines.map(line => {
          return `
            <div class="report-paragraph" dir="${language === 'ar' ? 'rtl' : 'ltr'}">
              <p>${line}</p>
            </div>
          `;
        }).join('');
      } else {
        contentHTML = lines.map(line => {
          const match = line.match(/\[(.*?)\]\s*\[(.*?)\]:\s*(.*)/);
          if (match) {
            const [, time, speaker, text] = match;
            return `
              <div class="transcript-entry" dir="${language === 'ar' ? 'rtl' : 'ltr'}">
                <strong>[${time}] ${speaker}:</strong>
                <div class="transcript-text-box">${text}</div>
              </div>
            `;
          }
          return `
            <div class="transcript-entry" dir="${language === 'ar' ? 'rtl' : 'ltr'}">
              <div class="transcript-text-box">${line}</div>
            </div>
          `;
        }).join('');
      }

      const footerHTML = `
        <div class="pdf-footer" dir="${language === 'ar' ? 'rtl' : 'ltr'}">
          <p>${language === 'ar' ? 'تم الإنشاء في' : 'Generated on'} ${new Date().toLocaleString()}</p>
        </div>
      `;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert(language === 'ar' ? 'الرجاء السماح بالنوافذ المنبثقة لإنشاء ملف PDF' : 'Please allow pop-ups to generate PDF');
        setIsGenerating(false);
        return;
      }

      printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4;
      margin: 40px;
    }
    
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
    }
    
    body {
      font-family: Arial, "Segoe UI", "Noto Sans", "Noto Sans Arabic", "Noto Sans Devanagari", sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #000000;
      background-color: white;
      direction: ${language === 'ar' ? 'rtl' : 'ltr'};
      text-align: ${language === 'ar' ? 'right' : 'left'};
    }
    
    .pdf-header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
    }
    
    .pdf-header h1 {
      font-size: 22px;
      margin: 0 0 8px 0;
      color: #333;
      font-weight: bold;
    }
    
    .pdf-header p {
      font-size: 11px;
      color: #666;
      margin: 0;
    }
    
    .pdf-section-title {
      margin-bottom: 20px;
    }
    
    .pdf-section-title h2 {
      font-size: 16px;
      margin: 0 0 12px 0;
      color: #444;
      font-weight: bold;
    }
    
    .transcript-entry {
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    
    .transcript-entry strong {
      font-size: 11px;
      color: #000;
      display: block;
      margin-bottom: 4px;
    }
    
    .transcript-text-box {
      margin: 0;
      padding: 8px 15px;
      background: #f5f5f5;
      border-${language === 'ar' ? 'right' : 'left'}: 4px solid #4A90E2;
      font-size: 12px;
      word-wrap: break-word;
      overflow-wrap: break-word;
      white-space: pre-wrap;
    }
    
    .report-paragraph {
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    
    .report-paragraph p {
      margin: 0;
      padding: 8px 0;
      font-size: 12px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    .pdf-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ccc;
      text-align: center;
    }
    
    .pdf-footer p {
      font-size: 10px;
      color: #999;
      margin: 0;
    }
  </style>
</head>
<body>
  ${headerHTML}
  ${contentHTML}
  ${footerHTML}
</body>
</html>
      `);

      printWindow.document.close();
      
    
      setTimeout(() => {
        printWindow.print();
        setIsGenerating(false); 
      }, 100);
      
    } catch (error) {
      console.error('PDF generation failed:', error);
      setIsGenerating(false);
    }
  };

  // Generate Word document
  const generateWord = () => {
    if (!transcript) return;

    const lines = transcript.split('\n').filter(line => line.trim());
    
    let contentHTML = '';
    
    if (contentType === 'report') {
      contentHTML = lines.map(line => `
        <div style="margin-bottom: 12pt;">
          <p style="margin: 0; padding: 8pt 0;">${line}</p>
        </div>
      `).join('');
    } else {
      contentHTML = lines.map(line => {
        const match = line.match(/\[(.*?)\]\s*\[(.*?)\]:\s*(.*)/);
        if (match) {
          const [, time, speaker, text] = match;
          return `
            <div style="margin-bottom: 12pt; page-break-inside: avoid;">
              <p style="margin: 0 0 4pt 0;"><strong style="font-size: 11pt;">[${time}] ${speaker}:</strong></p>
              <div style="margin: 0; padding: 8pt 15pt; background-color: #f5f5f5; border-${language === 'ar' ? 'right' : 'left'}: 4pt solid #4A90E2; font-size: 12pt; word-wrap: break-word;">
                ${text}
              </div>
            </div>
          `;
        }
        return `
          <div style="margin-bottom: 12pt; page-break-inside: avoid;">
            <div style="margin: 0; padding: 8pt 15pt; background-color: #f5f5f5; border-${language === 'ar' ? 'right' : 'left'}: 4pt solid #4A90E2; font-size: 12pt; word-wrap: break-word;">
              ${line}
            </div>
          </div>
        `;
      }).join('');
    }

    const wordHTML = `
<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
<head>
  <meta charset='utf-8'>
  <title>${title}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    body {
      font-family: ${language === 'ar' ? "'Noto Sans Arabic', 'Segoe UI', Arial, sans-serif" : "'Calibri', 'Segoe UI', Arial, sans-serif"};
      font-size: 12pt;
      line-height: 1.4;
      color: #000;
      direction: ${language === 'ar' ? 'rtl' : 'ltr'};
      text-align: ${language === 'ar' ? 'right' : 'left'};
    }
    h1 {
      font-size: 24pt;
      text-align: center;
      margin-bottom: 12pt;
      color: #333;
      border-bottom: 2pt solid #333;
      padding-bottom: 8pt;
    }
    h2 {
      font-size: 18pt;
      margin-top: 16pt;
      margin-bottom: 10pt;
      color: #444;
    }
    p {
      margin: 0;
    }
  </style>
</head>
<body>
  <div style="text-align: center; margin-bottom: 30pt; border-bottom: 2pt solid #333; padding-bottom: 20pt;">
    <h1 style="font-size: 22pt; margin: 0 0 8pt 0; color: #333; font-weight: bold;">${title}</h1>
    <p style="font-size: 11pt; color: #666; margin: 0;">
      <strong>${language === 'ar' ? 'التاريخ:' : 'Date:'}</strong> ${sessionDate}
    </p>
  </div>
  
  ${contentType === 'transcript' ? `
    <div style="margin-bottom: 20pt;">
      <h2 style="font-size: 16pt; margin: 0 0 12pt 0; color: #444; font-weight: bold;">
        ${language === 'ar' ? 'النسخ' : 'Transcript'}
      </h2>
    </div>
  ` : ''}
  
  ${contentHTML}
  
  <div style="margin-top: 40pt; padding-top: 20pt; border-top: 1pt solid #ccc; text-align: center;">
    <p style="font-size: 10pt; color: #999; margin: 0;">
      <em>${language === 'ar' ? 'تم الإنشاء في' : 'Generated on'} ${new Date().toLocaleString()}</em>
    </p>
  </div>
</body>
</html>`;

    const blob = new Blob(['\ufeff', wordHTML], {
      type: 'application/msword; charset=utf-8'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}-${sessionDate.replace(/\//g, "-")}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="export-buttons-container">
      <button 
        onClick={generatePDF}
        disabled={isGenerating || !transcript}
        className="action-btn"
        title={t("pdf.exportAsPdf")}
      >
        <Printer className="btn-icon" />
        <span>{t("pdf.downloadPdf")}</span>
      </button>

      <button 
        onClick={generateWord}
        disabled={!transcript}
        className="action-btn"
        title={t("pdf.exportAsWord")}
      >
        <Download className="btn-icon" />
        <span>{t("pdf.downloadWord")}</span>
      </button>
    </div>
  );
};

export default TranslationPDFExporter;