import React from "react";

interface MarkdownPreviewProps {
  markdown: string;
  direction?: "rtl" | "ltr";
}

// Comprehensive header normalization for ALL case types and PDF structures
function normalizeTableHeaders(headers: string[]): string[] {
  // Universal mapping covering all case areas (Rewrite, Classification, Contradiction, etc.)
  const headerMap: { [key: string]: string } = {
    // ===== PARTIES TABLE (الأطراف) =====
    'الصفة': 'الصفة',
    'الاسم الكامل': 'الاسم الكامل',
    'الجنسية': 'الجنسية',
    'الرقم الشخصي': 'الرقم الشخصي',
    'الهاتف': 'الهاتف',
    'ملاحظات': 'ملاحظات',
    
    // Variations for Parties
    'الحالة': 'الصفة',
    'الوظيفة': 'الصفة',
    'الصفه': 'الصفة',
    'الصفات': 'الصفة',
    'نوع الطرف': 'الصفة',
    'طبيعة الطرف': 'الصفة',
    
    'الاسم': 'الاسم الكامل',
    'اسم': 'الاسم الكامل',
    'الإسم الكامل': 'الاسم الكامل',
    'الإسم': 'الاسم الكامل',
    'الأسماء': 'الاسم الكامل',
    'اسم الشخص': 'الاسم الكامل',
    'اسم المدعى': 'الاسم الكامل',
    'اسم المشتكي': 'الاسم الكامل',
    
    'الجنسيه': 'الجنسية',
    'جنسية': 'الجنسية',
    'الدولة': 'الجنسية',
    'البلد': 'الجنسية',
    
    'رقم الهوية': 'الرقم الشخصي',
    'الهوية': 'الرقم الشخصي',
    'رقم شخصي': 'الرقم الشخصي',
    'رقم البطاقة': 'الرقم الشخصي',
    'الرقم الوطني': 'الرقم الشخصي',
    'رقم هوية': 'الرقم الشخصي',
    'رقم الإقامة': 'الرقم الشخصي',
    
    'رقم الهاتف': 'الهاتف',
    'الموبايل': 'الهاتف',
    'الجوال': 'الهاتف',
    'التلفون': 'الهاتف',
    'الهاتف المحمول': 'الهاتف',
    'هاتف': 'الهاتف',
    
    'السكن': 'ملاحظات',
    'العنوان': 'ملاحظات',
    'ملاحظه': 'ملاحظات',
    'تفاصيل': 'ملاحظات',
    'معلومات': 'ملاحظات',
    'الملاحظات': 'ملاحظات',
    'ملاحظات إضافية': 'ملاحظات',
    'موقع السكن': 'ملاحظات',
    'مقر الإقامة': 'ملاحظات',
    'الجهة': 'ملاحظات',
    'الحالة الإدارية': 'ملاحظات',
    
    // ===== PHYSICAL ITEMS TABLE (الأشياء العينية) =====
    'فرعي': 'الصنف',
    'النوع': 'الصنف',
    'نوع': 'الصنف',
    'الصنف': 'الصنف',
    'صنف': 'الصنف',
    'فئة': 'الصنف',
    'تصنيف': 'الصنف',
    'الفئة': 'الصنف',
    'نوع المضبوطات': 'الصنف',
    
    'الوصف': 'الوصف',
    'وصف': 'الوصف',
    'الوصف التفصيلي': 'الوصف',
    'وصف تفصيلي': 'الوصف',
    'الوصف الكامل': 'الوصف',
    'تفصيل': 'الوصف',
    'تفاصيل المضبوطة': 'الوصف',
    'البيان': 'الوصف',
    'المواصفات': 'الوصف',
    'الوصف الموجز': 'الوصف',
    
    'الدور': 'الحالة',
    'حالة': 'الحالة',
    'حالة المضبوطة': 'الحالة',
    'الوضع': 'الحالة',
    'الحالة القانونية': 'الحالة',
    'الحالة الجنائية': 'الحالة',
    'مسروق/متلف/محجوز': 'الحالة',
    'الصفة القانونية': 'الحالة',
    
    // ===== CONTRADICTIONS TABLE =====
    'الشاهد': 'الشاهد',
    'شاهد': 'الشاهد',
    'اسم الشاهد': 'الشاهد',
    'الشاهد الأول': 'الشاهد',
    'الشهود': 'الشاهد',
    'الشخص': 'الشاهد',
    
    'التناقض': 'التناقض',
    'تناقض': 'التناقض',
    'نوع التناقض': 'التناقض',
    'الاختلاف': 'التناقض',
    'الفرق': 'التناقض',
    'البيان المتناقض': 'التناقض',
    'الموضوع': 'التناقض',
    
    'التفاصيل': 'التفاصيل',
    'التفصيل': 'التفاصيل',
    'الشرح': 'التفاصيل',
    'الإيضاح': 'التفاصيل',
    'التوضيح': 'التفاصيل',
    'الملاحظة': 'التفاصيل',
    
    // ===== GENERIC/COMMON COLUMNS =====
    'الرقم': 'الرقم',
    'رقم': 'الرقم',
    'ت': 'الرقم',
    'الترتيب': 'الرقم',
    'الصفحة': 'الصفحة',
    'صفحة': 'الصفحة',
    'التاريخ': 'التاريخ',
    'تاريخ': 'التاريخ',
    'الوقت': 'الوقت',
    'وقت': 'الوقت',
    'ملخص': 'الملخص'
  };

  return headers.map(header => {
    const trimmed = header.trim();
    return headerMap[trimmed] || trimmed;
  });
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
    
    // Remove separator lines (---...) and clean lines
    const cleanLines = lines.filter(l => !/^[-|\s]+$/.test(l));
    if (cleanLines.length < 2) return block;
    
    // Parse rows and normalize - split by | and filter empty cells from start/end
    const rows = cleanLines.map(line => {
      // Normalize: trim, split by |, filter empty strings from edges
      let cells = line.split('|').map(cell => cell.trim());
      // Remove leading/trailing empty cells (from | at start/end of line)
      while (cells.length > 0 && cells[0] === '') cells.shift();
      while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
      return cells;
    });
    
    if (rows.length < 2) return block;
    
    // Normalize headers to standard format
    rows[0] = normalizeTableHeaders(rows[0]);
    
    // Find max column count to normalize all rows
    const maxCols = Math.max(...rows.map(r => r.length));
    
    // Pad rows to have same number of columns
    const normalizedRows = rows.map(row => {
      while (row.length < maxCols) row.push('');
      return row;
    });
    
    // Build table
    let table = '<table class="markdown-table"><thead><tr>';
    table += normalizedRows[0].map(cell => `<th>${cell}</th>`).join('');
    table += '</tr></thead><tbody>';
    for (let i = 1; i < normalizedRows.length; i++) {
      table += '<tr>' + normalizedRows[i].map(cell => `<td>${cell}</td>`).join('') + '</tr>';
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

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ markdown, direction = "rtl" }) => {
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
        direction,
        textAlign: direction === 'rtl' ? 'right' : 'left',
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
.markdown-preview hr {
  border: none;
  border-top: 2px solid #e2e8f0;
  margin: 24px 0;
}
.markdown-table {
  border-collapse: collapse;
  width: 100%;
  margin: 24px 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  border-radius: 8px;
  overflow: hidden;
}
.markdown-table th, .markdown-table td {
  border: 1px solid #e2e8f0;
  padding: 14px 16px;
  text-align: center;
  font-size: 1.05rem;
}
.markdown-table th {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  font-weight: 700;
  color: #0f172a;
  border-bottom: 2px solid #cbd5e1;
  font-size: 1.08rem;
}
.markdown-table tbody tr:nth-child(even) {
  background-color: #f9fafb;
}
.markdown-table tbody tr:hover {
  background-color: #f0f4f8;
  transition: background-color 0.2s ease;
}
.markdown-table td {
  color: #1e293b;
  font-weight: 500;
}
`;
  document.head.appendChild(style);
}

export default MarkdownPreview;
