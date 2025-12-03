import React from "react";

interface MarkdownPreviewProps {
  markdown: string;
}

// Enhanced Markdown to HTML converter optimized for Arabic legal documents
function simpleMarkdownToHtml(md: string): string {
  let html = md;
  
  // Headings
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr />');

  // Table detection: Enhanced for Arabic RTL legal documents
  html = html.replace(/((?:^.*\|.*\n)+)/gm, (block) => {
    const lines = block.trim().split(/\n/).filter(l => l.includes('|'));
    if (lines.length < 2) return block;
    
    // Remove separator lines (---) but keep header and data rows
    const cleanLines = lines.filter(l => !/^[\s|\-]+$/.test(l));
    if (cleanLines.length < 2) return block;
    
    // Parse rows: split by | and trim each cell
    const rows = cleanLines.map(line => {
      let cells = line.split('|').map(cell => cell.trim());
      // Remove empty cells from start/end caused by leading/trailing pipes
      while (cells.length > 0 && cells[0] === '') cells.shift();
      while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
      return cells;
    });
    
    if (rows.length < 1) return block;
    
    // Normalize column count
    const maxCols = Math.max(...rows.map(r => r.length));
    const normalizedRows = rows.map(row => {
      while (row.length < maxCols) row.push('');
      return row;
    });
    
    const headerRow = normalizedRows[0];
    const bodyRows = normalizedRows.slice(1).filter(r => r.some(c => c.trim() !== ''));

    // Remove 'الحالة' column if all body cells are empty
    let effectiveHeader = [...headerRow];
    let effectiveBody = bodyRows.map(r => [...r]);
    
    for (let colIdx = effectiveHeader.length - 1; colIdx >= 0; colIdx--) {
      const normalizedHeader = effectiveHeader[colIdx].replace(/\s+/g, '');
      if (normalizedHeader === 'الحالة') {
        const allEmpty = effectiveBody.every(r => !r[colIdx] || r[colIdx].trim() === '');
        if (allEmpty) {
          effectiveHeader.splice(colIdx, 1);
          effectiveBody = effectiveBody.map(r => {
            r.splice(colIdx, 1);
            return r;
          });
        }
      }
    }
    
    // Build HTML table with RTL support
    let table = '<table class="markdown-table" dir="rtl"><thead><tr>';
    table += effectiveHeader.map(cell => `<th>${cell}</th>`).join('');
    table += '</tr></thead><tbody>';
    for (const r of effectiveBody) {
      table += '<tr>' + r.map(cell => `<td>${cell}</td>`).join('') + '</tr>';
    }
    table += '</tbody></table>';
    return table;
  });

  // Plain (non-piped) table detection: header line, separator (---), then rows
  // e.g. header_line\n----\nrow1\nrow2
  html = html.replace(/(^.*\n[-\s\-]+\n(?:.*\n?)+?)(?=\n|$)/gm, (block) => {
    const lines = block.trim().split(/\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 3) return block;
    const separator = lines[1];
    // If separator contains dashes only, treat as plain table
    if (!/^[-\s]+$/.test(separator)) return block;
    const dataLines = lines.slice(2);

    // Heuristic parse: try to extract columns [role, nationality, name, id, address]
    const countryKeywords = [
      'بحرين', 'بحريني', 'المملكة', 'السعودية', 'سعودي', 'سعودية', 'المملكة العربية السعودية'
    ];

    const parsedRows: string[][] = [];
    for (const line of dataLines) {
      // If the line already looks like a pipe table, skip
      if (line.includes('|')) continue;
      // Extract trailing numeric ID (assume 4+ digits)
      const idMatch = line.match(/(\d{4,})\s*$/);
      const id = idMatch ? idMatch[1] : '';
      let rest = id ? line.slice(0, line.lastIndexOf(id)).trim() : line;

      // Try to find nationality keyword
      let foundCountry = '';
      let countryIndex = -1;
      for (const kw of countryKeywords) {
        const idx = rest.indexOf(kw);
        if (idx !== -1) {
          foundCountry = kw;
          countryIndex = idx;
          break;
        }
      }

      let role = '';
      let nationality = '';
      let name = '';
      let address = '';

      if (foundCountry) {
        nationality = foundCountry;
        // Role is what comes before nationality (if any)
        const before = rest.slice(0, countryIndex).trim();
        // The remaining after nationality is the name (if any)
        name = rest.slice(countryIndex + foundCountry.length).trim();
        // Now split 'before' into role and possible leftover name pieces
        // If 'before' contains spaces, assume last token(s) are role vs name; otherwise treat all as role
        role = before;
      } else {
        // If no country found, attempt to split by Arabic/Latin transition: find first sequence of Arabic letters then name then digits
        // As fallback, split into 3 parts by rough character counts
        const approxLen = Math.max(6, Math.floor(rest.length / 3));
        role = rest.slice(0, approxLen).trim();
        name = rest.slice(approxLen, approxLen * 2).trim();
        address = rest.slice(approxLen * 2).trim();
      }

      parsedRows.push([role || '-', nationality || '-', name || '-', id || '-', address || '-']);
    }

    if (parsedRows.length === 0) return block;
    // Build HTML table
    let table = '<table class="markdown-table"><thead><tr>';
    // Build headers from header string by attempting to split camel-like words by capital letters or known words
    // As a simple fallback, use fixed headers in Arabic/English order
    const headers = ['Role', 'Nationality', 'Name', 'ID', 'Address'];
    table += headers.map(h => `<th>${h}</th>`).join('');
    table += '</tr></thead><tbody>';
    for (const r of parsedRows) {
      table += '<tr>' + r.map(cell => `<td>${cell}</td>`).join('') + '</tr>';
    }
    table += '</tbody></table>';
    return table;
  });

  // Paragraphs
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = `<p>${html}</p>`;
  return html;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ markdown }) => {
  const html = simpleMarkdownToHtml(markdown);
  return (
    <div
      className="markdown-preview"
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1.5px solid #e0e7ef',
        boxShadow: '0 1.5px 8px rgba(60,40,120,0.06)',
        padding: '32px 28px',
        marginBottom: 24,
        marginTop: 8,
        fontFamily: '"IBM Plex Sans Arabic", "Cairo", "Segoe UI", "Noto Sans Arabic", Tahoma, sans-serif',
        fontSize: '1.1rem',
        fontWeight: 500,
        color: '#1a1a1a',
        lineHeight: 2.2,
        direction: 'rtl',
        textAlign: 'right',
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
        letterSpacing: '0.01em',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

// Add table styling (inject only once)
if (typeof window !== 'undefined' && !document.head.querySelector('style.markdown-table')) {
  const style = document.createElement('style');
  style.className = 'markdown-table';
  style.innerHTML = `
.markdown-preview h1 {
  font-size: 1.85rem;
  font-weight: 800;
  color: #0f172a;
  margin: 24px 0 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e2e8f0;
}
.markdown-preview h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 20px 0 12px;
}
.markdown-preview h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #334155;
  margin: 16px 0 10px;
}
.markdown-preview p {
  margin: 12px 0;
  line-height: 2.2;
}
.markdown-preview strong {
  font-weight: 700;
  color: #0f172a;
}
/* Q&A Section Styling */
.markdown-preview p strong:first-child {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 6px;
  margin-left: 8px;
}
.markdown-preview p strong:contains('سؤال'),
.markdown-preview p strong:contains('Question') {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1e40af;
  border-right: 4px solid #3b82f6;
}
.markdown-preview p strong:contains('جواب'),
.markdown-preview p strong:contains('Answer') {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #065f46;
  border-right: 4px solid #10b981;
}
.markdown-preview hr {
  border: none;
  border-top: 2px solid #e2e8f0;
  margin: 24px 0;
}
.markdown-table {
  border-collapse: collapse;
  width: 100%;
  margin: 28px 0;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  border-radius: 10px;
  overflow: hidden;
  direction: rtl;
  font-family: 'IBM Plex Sans Arabic', 'Cairo', 'Noto Sans Arabic', sans-serif;
}
.markdown-table th, .markdown-table td {
  border: 1.5px solid #d1dce6;
  padding: 16px 20px;
  text-align: center;
  font-size: 1.08rem;
  vertical-align: middle;
}
.markdown-table th {
  background: linear-gradient(180deg, #f8fafc 0%, #e8eef5 100%);
  font-weight: 700;
  color: #0f172a;
  border-bottom: 2.5px solid #94a3b8;
  font-size: 1.12rem;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.markdown-table tbody tr:nth-child(odd) {
  background-color: #ffffff;
}
.markdown-table tbody tr:nth-child(even) {
  background-color: #f8fafc;
}
.markdown-table tbody tr:hover {
  background-color: #e8f0f7;
  transition: background-color 0.2s ease;
}
.markdown-table td {
  color: #1e293b;
  font-weight: 500;
  line-height: 1.8;
}
.markdown-table td:first-child,
.markdown-table th:first-child {
  border-right: 2px solid #cbd5e1;
}
.markdown-table td:last-child,
.markdown-table th:last-child {
  border-left: 2px solid #cbd5e1;
}
`;
  document.head.appendChild(style);
}

export default MarkdownPreview;
