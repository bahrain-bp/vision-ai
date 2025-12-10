import React, { useState } from "react";
import { Download, FileText, Printer } from "lucide-react";
import "./TranslationPDFExporter.css";
import { useLanguage } from "../../context/LanguageContext";

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

  // Convert transcript to Markdown format
  const generateMarkdownContent = (): string => {
    if (contentType === 'report') {
      const markdown = `# ${title}

**Date:** ${sessionDate}

---

${transcript}

---

*${language === 'ar' ? 'تم الإنشاء في' : 'Generated on'} ${new Date().toLocaleString()}*
`;
      return markdown;
    }

    const markdown = `# ${title}

**${language === 'ar' ? 'التاريخ:' : 'Date:'}** ${sessionDate}

---

${language === 'ar' ? '## النسخ' : '## Transcript'}

${transcript.split('\n').map(line => {
  if (line.trim()) {
    const match = line.match(/\[(.*?)\]\s*\[(.*?)\]:\s*(.*)/);
    if (match) {
      const [, time, speaker, text] = match;
      return `**[${time}] ${speaker}:**\n> ${text}\n`;
    }
    return `> ${line}\n`;
  }
  return '';
}).join('\n')}

---

*${language === 'ar' ? 'تم الإنشاء في' : 'Generated on'} ${new Date().toLocaleString()}*
`;

    return markdown;
  };

  // Download as Markdown file
  const downloadMarkdown = () => {
    const markdown = generateMarkdownContent();
    const blob = new Blob([markdown], { type: 'text/markdown; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}-${sessionDate.replace(/\//g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
      
      // Wait for content to load then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          // Close the window after printing
          printWindow.onafterprint = () => {
            printWindow.close();
          };
          setIsGenerating(false);
        }, 250);
      };
      
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert(language === 'ar' ? 'فشل إنشاء ملف PDF. الرجاء محاولة تصدير Word أو Markdown بدلاً من ذلك.' : 'PDF generation failed. Please try Word or Markdown export instead.');
      setIsGenerating(false);
    }
  };

  // Generate Word document from Markdown
  const generateWordFromMarkdown = () => {
    if (!transcript) return;

    const lines = transcript.split('\n').filter(line => line.trim());
    
    let contentHTML = '';
    
    if (contentType === 'report') {
      contentHTML = lines.map(line => `<p>${line}</p>`).join('');
    } else {
      contentHTML = lines.map(line => {
        const match = line.match(/\[(.*?)\]\s*\[(.*?)\]:\s*(.*)/);
        if (match) {
          const [, time, speaker, text] = match;
          return `
            <p><strong>[${time}] ${speaker}:</strong></p>
            <blockquote>${text}</blockquote>
          `;
        }
        return `<blockquote>${line}</blockquote>`;
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
      font-size: 11pt;
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
    strong {
      font-weight: bold;
      color: #000;
    }
    blockquote {
      margin: 0;
      padding: 8pt 15pt;
      background-color: ${contentType === 'report' ? 'transparent' : '#f5f5f5'};
      border-${language === 'ar' ? 'right' : 'left'}: ${contentType === 'report' ? 'none' : '4pt solid #4A90E2'};
      font-family: inherit;
      page-break-inside: avoid;
      word-wrap: break-word;
      overflow-wrap: break-word;
      direction: ${language === 'ar' ? 'rtl' : 'ltr'};
      text-align: ${language === 'ar' ? 'right' : 'left'};
    }
    hr {
      border: none;
      border-top: 1pt solid #ccc;
      margin: 16pt 0;
    }
    p {
      margin: 0 0 10pt 0;
      page-break-inside: avoid;
      text-align: ${language === 'ar' ? 'right' : 'justify'};
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p><strong>${language === 'ar' ? 'التاريخ:' : 'Date:'}</strong> ${sessionDate}</p>
  <hr>
  ${contentType === 'transcript' ? `<h2>${language === 'ar' ? 'النسخ' : 'Transcript'}</h2>` : ''}
  ${contentHTML}
  <hr>
  <p style="text-align: center; font-size: 9pt; color: #999;">
    <em>${language === 'ar' ? 'تم الإنشاء في' : 'Generated on'} ${new Date().toLocaleString()}</em>
  </p>
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
        onClick={generateWordFromMarkdown}
        disabled={!transcript}
        className="action-btn"
        title={t("pdf.exportAsWord")}
      >
        <Download className="btn-icon" />
        <span>{t("pdf.downloadWord")}</span>
      </button>

      <button 
        onClick={downloadMarkdown}
        disabled={!transcript}
        className="action-btn"
        title={t("pdf.exportAsMarkdown")}
      >
        <FileText className="btn-icon" />
        <span>{t("pdf.downloadMarkdown")}</span>
      </button>
    </div>
  );
};

export default TranslationPDFExporter;