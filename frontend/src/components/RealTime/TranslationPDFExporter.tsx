import React, { useState } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Download, FileText, Loader } from "lucide-react";
import "./TranslationPDFExporter.css";

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

  // Convert transcript to Markdown format
  const generateMarkdownContent = (): string => {
    if (contentType === 'report') {
      // Simple format for report/summary
      const markdown = `# ${title}

**Date:** ${sessionDate}

---

${transcript}

---

*Generated on ${new Date().toLocaleString()}*
`;
      return markdown;
    }

    // Original transcript format
    const markdown = `# ${title}

**Date:** ${sessionDate}

---

## Transcript

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

*Generated on ${new Date().toLocaleString()}*
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

  // Convert Markdown to HTML
  const markdownToHTML = (markdown: string): string => {
    let html = markdown;

    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    html = html.replace(/^&gt; (.*$)/gim, '<blockquote>$1</blockquote>');
    html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
    html = html.replace(/^---$/gim, '<hr>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    html = '<p>' + html + '</p>';

    return html;
  };

  // Generate PDF using html2canvas with proper page breaks
  const generatePDF = async () => {
    if (!transcript) return;
    
    setIsGenerating(true);
    
    try {
      // Create a temporary container for rendering
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-10000px';
      container.style.top = '0';
      container.style.zIndex = '9999';
      document.body.appendChild(container);

      // A4 dimensions at 96 DPI
      const pageWidth = 794; // pixels
      const pageHeight = 1123; // pixels
      const padding = 40;
      const contentHeight = pageHeight - (padding * 2);

      // Format the content based on type
      const lines = transcript.split('\n').filter(line => line.trim());
      
      // Create header content
      const headerHTML = `
        <div class="pdf-header">
          <h1>${title}</h1>
          <p>Date: ${sessionDate}</p>
        </div>
        ${contentType === 'transcript' ? '<div class="pdf-section-title"><h2>Transcript</h2></div>' : ''}
      `;

      // Split content into entries based on content type
      let entries: string[];
      
      if (contentType === 'report') {
        // For report/summary: plain text paragraphs without blue boxes
        entries = lines.map(line => {
          return `
            <div class="report-paragraph">
              <p>${line}</p>
            </div>
          `;
        });
      } else {
        // For transcript: original format with blue boxes
        entries = lines.map(line => {
          const match = line.match(/\[(.*?)\]\s*\[(.*?)\]:\s*(.*)/);
          if (match) {
            const [, time, speaker, text] = match;
            return `
              <div class="transcript-entry">
                <strong>[${time}] ${speaker}:</strong>
                <div class="transcript-text-box">${text}</div>
              </div>
            `;
          }
          return `
            <div class="transcript-entry">
              <div class="transcript-text-box">${line}</div>
            </div>
          `;
        });
      }

      // Function to create a page element
      const createPageElement = (content: string, isFirstPage: boolean) => {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'pdf-page';
        pageDiv.style.width = `${pageWidth}px`;
        pageDiv.style.height = `${pageHeight}px`;
        pageDiv.style.padding = `${padding}px`;
        
        pageDiv.innerHTML = (isFirstPage ? headerHTML : '') + content;
        return pageDiv;
      };

      // Function to measure content height
      const measureHeight = (htmlContent: string): number => {
        const tempDiv = document.createElement('div');
        tempDiv.className = 'measure-helper';
        tempDiv.style.width = `${pageWidth - (padding * 2)}px`;
        tempDiv.innerHTML = htmlContent;
        document.body.appendChild(tempDiv);
        const height = tempDiv.offsetHeight;
        document.body.removeChild(tempDiv);
        return height;
      };

      // Split entries into pages
      const pages: string[] = [];
      let currentPageContent = '';
      let currentPageHeight = 0;
      let isFirstPage = true;

      // Account for header height on first page
      if (isFirstPage) {
        currentPageHeight = measureHeight(headerHTML);
      }

      for (const entry of entries) {
        const entryHeight = measureHeight(entry);

        // Check if adding this entry would exceed page height
        if (currentPageHeight + entryHeight > contentHeight && currentPageContent !== '') {
          // Save current page and start a new one
          pages.push(currentPageContent);
          currentPageContent = entry;
          currentPageHeight = entryHeight;
          isFirstPage = false;
        } else {
          // Add entry to current page
          currentPageContent += entry;
          currentPageHeight += entryHeight;
        }
      }

      // Add the last page
      if (currentPageContent) {
        pages.push(currentPageContent);
      }

      // Add footer to last page
      const footerHTML = `
        <div class="pdf-footer" style="bottom: ${padding}px; left: ${padding}px; right: ${padding}px;">
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      `;

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const imgWidth = 210; // A4 width in mm
      const imgHeight = 297; // A4 height in mm

      // Render each page
      for (let i = 0; i < pages.length; i++) {
        const isFirst = i === 0;
        const isLast = i === pages.length - 1;
        
        const pageContent = pages[i] + (isLast ? footerHTML : '');
        const pageElement = createPageElement(pageContent, isFirst);
        container.appendChild(pageElement);

        // Wait for fonts and rendering
        await new Promise(resolve => setTimeout(resolve, 300));

        // Capture page as image
        const canvas = await html2canvas(pageElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: pageWidth,
          height: pageHeight,
          windowWidth: pageWidth,
          windowHeight: pageHeight,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        // Add page to PDF
        if (i > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);

        // Clean up
        container.removeChild(pageElement);
      }

      // Clean up container
      document.body.removeChild(container);

      // Save PDF
      pdf.save(`${fileName}-${sessionDate.replace(/\//g, "-")}.pdf`);
      
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('PDF generation failed. Please try Word or Markdown export instead.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate Word document from Markdown
  const generateWordFromMarkdown = () => {
    if (!transcript) return;

    const markdown = generateMarkdownContent();
    const htmlContent = markdownToHTML(markdown);

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
      font-family: 'Calibri', 'Segoe UI', 'Noto Sans', 'Noto Sans Arabic', 'Noto Sans Devanagari', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000;
      direction: auto;
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
      border-left: ${contentType === 'report' ? 'none' : '4pt solid #4A90E2'};
      font-family: inherit;
      page-break-inside: avoid;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    hr {
      border: none;
      border-top: 1pt solid #ccc;
      margin: 16pt 0;
    }
    p {
      margin: 0 0 10pt 0;
      page-break-inside: avoid;
      text-align: justify;
    }
  </style>
</head>
<body>
  ${htmlContent}
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
        title="Export as PDF"
      >
        {isGenerating ? (
          <Loader className="btn-icon animate-spin" />
        ) : (
          <Download className="btn-icon" />
        )}
        <span>{isGenerating ? "Generating..." : "Download PDF"}</span>
      </button>

      <button 
        onClick={generateWordFromMarkdown}
        disabled={!transcript}
        className="action-btn"
        title="Export as Word Document"
      >
        <Download className="btn-icon" />
        <span>Download Word</span>
      </button>

      <button 
        onClick={downloadMarkdown}
        disabled={!transcript}
        className="action-btn"
        title="Export as Markdown"
      >
        <FileText className="btn-icon" />
        <span>Markdown</span>
      </button>
    </div>
  );
};

export default TranslationPDFExporter;