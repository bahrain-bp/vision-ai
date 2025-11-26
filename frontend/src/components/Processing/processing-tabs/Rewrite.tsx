import React, { useState } from "react";
import MarkdownPreview from "./MarkdownPreview";
import { exportMarkdownToPDF, exportMarkdownToDocx } from "./ExportUtils";
import { Sparkles, Lock, AlertCircle } from "lucide-react";
import "./Rewrite.css";

interface SessionData {
  sessionId: string;
}

interface RewriteProps {
  sessionData: SessionData;
}

const Rewrite: React.FC<RewriteProps> = ({ sessionData }) => {
  const [rewrittenText, setRewrittenText] = useState("");
  const [caseNumber, setCaseNumber] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);



  // Function to extract case number from Arabic text
  const extractCaseNumber = (text: string): string => {
    // Collect all candidate patterns (accept / or \\)
    const candidateRegexes: RegExp[] = [
      /رقم\s*البلاغ\s*:?:?\s*([\d]{4,6}\s*[\/\\]\s*[\d]{4})/gi,
      /القضية\s*رقم\s*:?:?\s*([\d]{4,6}\s*[\/\\]\s*[\d]{4})/gi,
      /رقم\s*القضية\s*:?:?\s*([\d]{4,6}\s*[\/\\]\s*[\d]{4})/gi,
      /\b([\d]{4,6}\s*[\/\\]\s*[\d]{4})\b/gi,
    ];

    const candidates: string[] = [];
    for (const rx of candidateRegexes) {
      let m: RegExpExecArray | null;
      while ((m = rx.exec(text)) !== null) {
        const val = m[1].trim();
        candidates.push(val);
      }
    }

    if (candidates.length === 0) {
      console.log("No case number found in text");
      return "";
    }

    // Score candidates: prefer backslash, prefer 5-6 digits before separator, prefer year 2024, prefer those near 'النيابة العامة' context
    const scoreCandidate = (c: string, indexInText: number): number => {
      let score = 0;
      if (c.includes("\\")) score += 3; // backslash format preferred
      const parts = c.split(/[\/\\]/).map(s => s.trim());
      const before = parts[0] || '';
      const after = parts[1] || '';
      if (/^\d{5,6}$/.test(before)) score += 3; // 5-6 digits preferred
      if (after === '2024') score += 2; // common year
      // proximity to 'النيابة العامة'
      const window = text.substring(Math.max(0, indexInText - 80), Math.min(text.length, indexInText + 80));
      if (/النيابة\s+العامة/.test(window)) score += 2;
      return score;
    };

    // Pick best candidate by score (use first max if tie)
    let best = candidates[0];
    let bestScore = -Infinity;
    for (const c of candidates) {
      const idx = text.indexOf(c);
      const s = scoreCandidate(c, idx);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }

    const norm = best.replace(/[\/\\]/, ' \\ ').replace(/\s+/g, ' ');
    console.log("Selected case number:", norm);
    return norm;
  };

  // Function to clean and deduplicate the rewritten text
  const cleanRewrittenText = (text: string): string => {
    // Remove page numbers in all variations including bold markers
    text = text.replace(/\*?\*?رقم الصفحة:\s*\d+\*?\*?/g, '');
    text = text.replace(/\*?\*?\d+\s*\/\s*\d+\s*صفحة\s*:?\*?\*?/g, '');
    text = text.replace(/صفحة\s*:?\s*\d+\s*\/?\s*\d*/g, '');
    text = text.replace(/\*?\*?التاريخ والوقت:\*?\*?\s*\d+\s*\/\s*\d+/g, '');
    text = text.replace(/\*?\*?\d+\s*\/\s*\d+\s*صفحة\s*:?\*?\*?/g, '');
    text = text.replace(/صفحة\s*:?\s*\d+\s*\/\s*\d+/g, '');
    text = text.replace(/\*?\*?التاريخ والوقت:\*?\*?\s*\d+\s*\/\s*\d+/g, '');
    
        // Remove duplicate header blocks (keep only the first occurrence)
        // Pattern matches the full header block
        const headerPattern = /#+\s*مملكة البحرين[\s\S]*?Capital Prosecution/g;
        const headers = text.match(headerPattern);
    
        if (headers && headers.length > 1) {
          // Keep only the first header, remove all subsequent ones
          let firstHeaderFound = false;
          text = text.replace(headerPattern, (match) => {
            if (!firstHeaderFound) {
              firstHeaderFound = true;
              return match; // Keep the first one
            }
            return ''; // Remove subsequent ones
          });
        }
    
    // Split text into paragraphs
    const paragraphs = text.split(/\n\n+/);
    const seenQASignatures = new Set<string>();
    const cleanedParagraphs: string[] = [];
    
    for (const para of paragraphs) {
      if (!para.trim()) continue;
      
      // Check if this paragraph contains a Q&A (جواب or ج1:)
      const qaMatch = para.match(/(?:جواب|ج\d*)\s*:?\s*(.{200,})/s);
      
      if (qaMatch) {
        // Extract answer content for similarity comparison
        const answerText = qaMatch[1]
          .replace(/\*\*/g, '')  // Remove markdown bold
          .replace(/[^\w\s]/g, '')  // Remove punctuation
          .replace(/\s+/g, ' ')  // Normalize whitespace
          .trim();
        
        // Take first 500 chars for comparison
        const signature = answerText.substring(0, 500);
        
        // Check against all previously seen answers
        let isDuplicate = false;
        for (const seenSig of seenQASignatures) {
          const similarity = calculateSimilarity(signature, seenSig);
          if (similarity > 0.60) {  // 60% threshold - very aggressive
            console.log(`Removing duplicate paragraph (similarity: ${(similarity * 100).toFixed(1)}%)`);
            isDuplicate = true;
            break;
          }
        }
        
        if (isDuplicate) {
          continue;  // Skip this paragraph
        }
        
        seenQASignatures.add(signature);
      }
      
      cleanedParagraphs.push(para);
    }
    
    return cleanedParagraphs.join('\n\n');
  };

  // Calculate similarity between two strings (Jaccard similarity)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  };

  // Professional print view
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const htmlContent = simpleMarkdownToHtmlForExport(rewrittenText);
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const handleRewrite = async () => {
    setLoading(true);
    setError(null);

    // Set a timeout for the request (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      // Get API endpoint from environment or construct from window location
      const apiEndpoint =
        process.env.REACT_APP_API_ENDPOINT ||
        `${window.location.origin.replace("localhost", "localhost").split(":")[0]}://${window.location.hostname}:3000`;

      // For now, use mock S3 key - later will be extractedText key from Classification
      const requestBody = {
        sessionId: sessionData.sessionId,
        s3Key: "rewritten/report.txt",
      };

      const response = await fetch(`${apiEndpoint}/rewrite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `API error: ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.status === "success") {
        if (data.rewrittenText && data.rewrittenText.trim().length > 0) {
          // Clean and deduplicate the text first
          const cleanedText = cleanRewrittenText(data.rewrittenText);
          setRewrittenText(cleanedText);
          // Extract case number from the rewritten text
          console.log("Rewritten text received, extracting case number...");
          const extractedCaseNumber = extractCaseNumber(cleanedText);
          console.log("Extracted case number:", extractedCaseNumber);
          setCaseNumber(extractedCaseNumber);
          // Log S3 output path (not displayed in UI)
          if (data.outputS3Key) {
            console.log("S3 Output Path:", data.outputS3Key);
          }
        } else {
          // success but empty payload
          const msg = data.message || "No rewritten text returned from the server.";
          setError(msg);
        }
      } else {
        throw new Error(data.message || "Unknown error from API");
      }
    } catch (err) {
      clearTimeout(timeoutId);
      
      // Handle timeout specifically
      if (err instanceof Error && err.name === 'AbortError') {
        setError("Request timed out. The document may be too large. Try with a smaller document or try again.");
        console.error("Rewrite timeout");
      } else {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to rewrite report";
        setError(errorMessage);
        console.error("Rewrite error:", err);
      }
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="rewrite-container">
      <div className="rewrite-card">
        <div className="rewrite-header-row">
          <div className="rewrite-icon-circle">
            <Sparkles size={28} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="rewrite-heading">Rewrite</h2>
            <p className="rewrite-subheading">
              Rewrite and improve investigation reports
            </p>
          </div>
        </div>

        {error && (
          <div className="rewrite-error-message">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div className="rewrite-body">
          <label className="rewrite-section-label">Rewritten Report</label>
          {/* Case Number Display - Only show when case number is extracted */}
          {caseNumber && (
            <div className="case-number-banner">
              <div className="case-number-label">القضية رقم</div>
              <div className="case-number-value">{caseNumber}</div>
            </div>
          )}
          {/* Export actions */}
          {rewrittenText && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <button
                type="button"
                className="rewrite-primary-btn"
                onClick={() => {
                  exportMarkdownToPDF(simpleMarkdownToHtmlForExport(rewrittenText), `report_${caseNumber || 'case'}.pdf`);
                }}
                style={{ flex: 1 }}
              >
                <span>📄 Export PDF</span>
              </button>
              <button
                type="button"
                className="rewrite-primary-btn"
                onClick={() => {
                  exportMarkdownToDocx(rewrittenText, `report_${caseNumber || 'case'}.docx`);
                }}
                style={{ flex: 1 }}
              >
                <span>📝 Export Word</span>
              </button>
              <button
                type="button"
                className="rewrite-primary-btn"
                onClick={handlePrint}
                style={{ flex: 1 }}
              >
                <span>🖨️ Print</span>
              </button>
            </div>
          )}
          {/* Preview formatted Markdown output */}
          <div style={{
            background: '#ffffff',
            color: '#1a1a1a',
            transition: 'all 0.3s ease',
            borderRadius: 14,
            padding: 0
          }}>
            <MarkdownPreview markdown={rewrittenText} />
          </div>
        </div>

        <button
          type="button"
          className={`rewrite-primary-btn ${loading ? "loading" : ""}`}
          onClick={handleRewrite}
          disabled={loading}
        >
          <Lock size={18} className="rewrite-btn-icon" />
          <span>{loading ? "Rewriting..." : "Rewrite Report"}</span>
        </button>
      </div>
    </div>
  );
};

export default Rewrite;

// Enhanced HTML builder for PDF export with proper table and formatting support
function simpleMarkdownToHtmlForExport(md: string): string {
  let html = md;
  
  // Headers
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr />');
  
  // Tables (pipe-delimited Markdown)
  html = html.replace(/((?:^.*\|.*\n)+)/gm, (block) => {
    const lines = block.trim().split(/\n/).filter(l => l.includes('|'));
    if (lines.length < 2) return block;
    const cleanLines = lines.filter(l => !/^[-|\s]+$/.test(l));
    if (cleanLines.length < 2) return block;
    
    // Parse and normalize rows
    const rows = cleanLines.map(line => {
      let cells = line.split('|').map(cell => cell.trim());
      while (cells.length > 0 && cells[0] === '') cells.shift();
      while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
      return cells;
    });
    
    if (rows.length < 2) return block;
    const maxCols = Math.max(...rows.map(r => r.length));
    const normalizedRows = rows.map(row => {
      while (row.length < maxCols) row.push('');
      return row;
    });
    
    let table = '<table class="pdf-table"><thead><tr>';
    table += normalizedRows[0].map(cell => `<th>${cell}</th>`).join('');
    table += '</tr></thead><tbody>';
    for (let i = 1; i < normalizedRows.length; i++) {
      table += '<tr>' + normalizedRows[i].map(cell => `<td>${cell}</td>`).join('') + '</tr>';
    }
    table += '</tbody></table>';
    return table;
  });
  
  // Bullets to lists
  html = html.replace(/(?:^|\n)((?:-\s+[^\n]+\n?)+)/g, (_m, group) => {
    const items = group.trim().split(/\n/).map((line: string) => line.replace(/^\-\s+/, '').trim());
    const lis = items.map((it: string) => `<li>${it}</li>`).join('');
    return `\n<ul>${lis}</ul>`;
  });
  
  // Paragraphs
  const blocks = html.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  const rendered = blocks.map((b) => {
    if (/^<(h\d|table|div|ul|ol|hr)/.test(b)) return b;
    return `<p>${b.replace(/\n/g, '<br />')}</p>`;
  }).join('');
  
  // Wrap with styled container
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;700&family=Amiri:wght@400;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Amiri', 'Noto Naskh Arabic', 'Traditional Arabic', 'Arial', sans-serif;
      direction: rtl;
      text-align: right;
      line-height: 2;
      color: #1a1a1a;
      padding: 0;
      background: white;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px 32px;
      border-bottom: 3px solid #dc2626;
      margin-bottom: 30px;
      background: linear-gradient(to bottom, #ffffff, #f9fafb);
    }
    .header-text {
      font-size: 32px;
      font-weight: bold;
      color: #1a1a1a;
      font-family: 'Amiri', 'Noto Naskh Arabic', serif;
    }
    .header-logo {
      height: 80px;
      width: auto;
    }
    .content {
      padding: 0 32px 32px 32px;
    }
    h1 {
      font-size: 28px;
      font-weight: bold;
      color: #0f172a;
      margin: 28px 0 16px;
      border-bottom: 3px solid #dc2626;
      padding-bottom: 10px;
      font-family: 'Amiri', 'Noto Naskh Arabic', serif;
    }
    h2 {
      font-size: 24px;
      font-weight: bold;
      color: #1e293b;
      margin: 24px 0 12px;
      padding-right: 12px;
      border-right: 4px solid #dc2626;
      font-family: 'Amiri', 'Noto Naskh Arabic', serif;
    }
    h3 {
      font-size: 20px;
      font-weight: bold;
      color: #334155;
      margin: 18px 0 10px;
      font-family: 'Amiri', 'Noto Naskh Arabic', serif;
    }
    p {
      margin: 12px 0;
      line-height: 2;
      text-align: justify;
      font-family: 'Amiri', 'Noto Naskh Arabic', serif;
    }
    ul {
      list-style: none;
      padding: 0 20px 0 0;
      margin: 12px 0;
    }
    ul li {
      position: relative;
      margin: 8px 0;
      padding-right: 20px;
      line-height: 1.8;
    }
    ul li::before {
      content: '◆';
      position: absolute;
      right: 0;
      color: #dc2626;
      font-weight: bold;
      font-size: 12px;
    }
    strong {
      font-weight: bold;
      color: #0f172a;
    }
    hr {
      border: none;
      border-top: 2px solid #e5e7eb;
      margin: 24px 0;
    }
    .pdf-table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
      border: 2px solid #cbd5e1;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .pdf-table th, .pdf-table td {
      border: 1px solid #cbd5e1;
      padding: 12px 14px;
      text-align: center;
      font-size: 16px;
      font-family: 'Amiri', 'Noto Naskh Arabic', serif;
    }
    .pdf-table th {
      background: linear-gradient(to bottom, #dc2626, #b91c1c);
      font-weight: bold;
      color: white;
      font-size: 18px;
      font-family: 'Amiri', 'Noto Naskh Arabic', serif;
    }
    .pdf-table tbody tr:nth-child(odd) {
      background-color: #ffffff;
    }
    .pdf-table tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .pdf-table tbody tr:hover {
      background-color: #fee2e2;
    }
    @media print {
      .header {
        page-break-after: avoid;
      }
      h1, h2, h3 {
        page-break-after: avoid;
      }
      .pdf-table {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-text">مملكة البحرين</div>
    <img class="header-logo" src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Flag_of_Bahrain.svg/320px-Flag_of_Bahrain.svg.png" alt="Bahrain Flag">
  </div>
  <div class="content">
${rendered}
  </div>
</body>
</html>
`;
}