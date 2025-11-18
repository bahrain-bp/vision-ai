import React from "react";

interface MarkdownPreviewProps {
  markdown: string;
}

// Enhanced Markdown to HTML converter for headings, bold, hr, and accurate tables
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

  // Table detection: first, handle pipe-delimited Markdown tables as before
  html = html.replace(/((?:^.*\|.*\n)+)/gm, (block) => {
    const lines = block.trim().split(/\n/).filter(l => l.includes('|'));
    if (lines.length < 2) return block;
    // Remove separator lines (---...)
    const cleanLines = lines.filter(l => !/^[-|\s]+$/.test(l));
    if (cleanLines.length < 2) return block;
    const rows = cleanLines.map(line => line.split('|').map(cell => cell.trim()).filter(Boolean));
    if (rows.length < 2) return block;
    // If header row, use <th>
    let table = '<table class="markdown-table"><thead><tr>';
    table += rows[0].map(cell => `<th>${cell}</th>`).join('');
    table += '</tr></thead><tbody>';
    for (let i = 1; i < rows.length; i++) {
      table += '<tr>' + rows[i].map(cell => `<td>${cell}</td>`).join('') + '</tr>';
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
        padding: '24px 20px',
        marginBottom: 24,
        marginTop: 8,
        fontFamily: 'Segoe UI, Noto Sans Arabic, Tahoma, Arial, sans-serif',
        fontSize: 17,
        color: '#23272f',
        lineHeight: 2.05,
        direction: 'rtl',
        textAlign: 'right',
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
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
.markdown-table {
  border-collapse: collapse;
  width: 100%;
  margin: 18px 0;
}
.markdown-table th, .markdown-table td {
  border: 1px solid #d1d5db;
  padding: 8px 12px;
  text-align: center;
  font-size: 16px;
}
.markdown-table th {
  background: #f3f4f6;
  font-weight: 700;
}
`;
  document.head.appendChild(style);
}

export default MarkdownPreview;
