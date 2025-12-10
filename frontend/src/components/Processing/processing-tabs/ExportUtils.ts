import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';
import html2pdf from 'html2pdf.js';

export async function exportMarkdownToPDF(markdownHtml: string, fileName: string = 'report.pdf') {
  // Use html2pdf.js for proper Arabic rendering
  const element = document.createElement('div');
  element.innerHTML = markdownHtml;
  element.style.fontFamily = '"Traditional Arabic", "IBM Plex Sans Arabic", "Cairo", "Noto Sans Arabic", Arial, sans-serif';
  element.style.direction = 'rtl';
  element.style.textAlign = 'right';
  element.style.padding = '20px';
  element.style.fontSize = '14px';
  element.style.lineHeight = '1.6';
  element.style.color = '#000';
  
  // Add CSS classes for better page break control
  element.style.pageBreakInside = 'auto';
  
  // Add page break prevention for headings and their following content
  const headings = element.querySelectorAll('h1, h2, h3');
  headings.forEach(heading => {
    (heading as HTMLElement).style.pageBreakAfter = 'avoid';
    (heading as HTMLElement).style.pageBreakInside = 'avoid';
  });
  
  // Prevent tables from breaking
  const tables = element.querySelectorAll('table');
  tables.forEach(table => {
    (table as HTMLElement).style.pageBreakInside = 'avoid';
  });
  
  // Allow paragraphs to break naturally
  const paragraphs = element.querySelectorAll('p');
  paragraphs.forEach(p => {
    (p as HTMLElement).style.pageBreakInside = 'auto';
  });
  
  const options: any = {
    margin: [15, 15, 15, 15],
    filename: fileName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2.5,
      useCORS: true,
      logging: false,
      letterRendering: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      windowHeight: 1200
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait',
      compress: true
    },
    pagebreak: { 
      mode: ['css', 'legacy'],
      before: '.page-break-before',
      after: '.page-break-after',
      avoid: ['h1', 'h2', 'h3', 'table']
    }
  };

  try {
    await html2pdf().set(options).from(element).save();
  } catch (error) {
    console.error('PDF export error:', error);
    alert('خطأ في تصدير PDF. يرجى المحاولة مجددا.');
  }
}

export async function exportMarkdownToDocx(markdownText: string, fileName: string = 'report.docx') {
  const lines = markdownText.split(/\n/);
  const paragraphs: Paragraph[] = [];
  
  // Add Bahrain header with logo
  const { AlignmentType, BorderStyle: HeaderBorderStyle, Table, TableRow, TableCell, WidthType } = await import('docx');
  
  // Create header table with flag and text
  const headerTable = new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              text: "مملكة البحرين",
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.RIGHT,
              spacing: { before: 200, after: 200 },
              bidirectional: true
            })],
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: HeaderBorderStyle.NONE },
              bottom: { style: HeaderBorderStyle.NONE },
              left: { style: HeaderBorderStyle.NONE },
              right: { style: HeaderBorderStyle.NONE }
            }
          }),
          new TableCell({
            children: [new Paragraph({ text: "" })],
            width: { size: 30, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: HeaderBorderStyle.NONE },
              bottom: { style: HeaderBorderStyle.NONE },
              left: { style: HeaderBorderStyle.NONE },
              right: { style: HeaderBorderStyle.NONE }
            }
          })
        ]
      })
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: HeaderBorderStyle.NONE },
      bottom: { color: "DC2626", size: 20, style: HeaderBorderStyle.SINGLE },
      left: { style: HeaderBorderStyle.NONE },
      right: { style: HeaderBorderStyle.NONE },
      insideHorizontal: { style: HeaderBorderStyle.NONE },
      insideVertical: { style: HeaderBorderStyle.NONE }
    }
  });
  
  paragraphs.push(headerTable as any);
  paragraphs.push(new Paragraph({ text: "", spacing: { after: 400 } }));
  
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Check for table (pipe-delimited)
    if (line.includes('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }

      // Parse table
      const cleanLines = tableLines.filter(l => !/^[-|\s]+$/.test(l));
      if (cleanLines.length >= 2) {
        const rows = cleanLines.map(line => {
          let cells = line.split('|').map(cell => cell.trim());
          while (cells.length > 0 && cells[0] === '') cells.shift();
          while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
          return cells;
        });

        // Normalize column count
        const maxCols = Math.max(...rows.map(r => r.length));
        const normalizedRows = rows.map(row => {
          while (row.length < maxCols) row.push('');
          return row;
        });

        // Import Table classes
        const { Table, TableRow, TableCell, WidthType, BorderStyle } = await import('docx');
        
        const { AlignmentType: TableAlignmentType } = await import('docx');
        const tableRows = normalizedRows.map((row, idx) => 
          new TableRow({
            children: row.map(cell => {
              const cleanCell = cell.replace(/\*\*/g, '');
              return new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({
                    text: cleanCell,
                    bold: idx === 0,
                    color: idx === 0 ? "FFFFFF" : "000000",
                    size: idx === 0 ? 32 : 28,
                    font: "Traditional Arabic"
                  })],
                  alignment: TableAlignmentType.RIGHT,
                  bidirectional: true,
                  spacing: { before: 150, after: 150 }
                })],
                shading: idx === 0 ? { fill: 'DC2626' } : (idx % 2 === 1 ? { fill: 'F8FAFC' } : { fill: 'FFFFFF' }),
                margins: {
                  top: 150,
                  bottom: 150,
                  left: 150,
                  right: 150
                },
                verticalAlign: 'center' as any
              });
            }),
            tableHeader: idx === 0,
            height: { value: idx === 0 ? 800 : 600, rule: 'atLeast' as any }
          })
        );

        const table = new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { size: 8, color: 'DC2626', style: BorderStyle.SINGLE },
            bottom: { size: 8, color: 'DC2626', style: BorderStyle.SINGLE },
            left: { size: 6, color: '94A3B8', style: BorderStyle.SINGLE },
            right: { size: 6, color: '94A3B8', style: BorderStyle.SINGLE },
            insideHorizontal: { size: 4, color: 'CBD5E1', style: BorderStyle.SINGLE },
            insideVertical: { size: 4, color: 'CBD5E1', style: BorderStyle.SINGLE }
          }
        });

        paragraphs.push(new Paragraph({ children: [] })); // Spacer
        paragraphs.push(table as any);
        paragraphs.push(new Paragraph({ children: [] })); // Spacer
      }
      continue;
    }

    // Headers
    const h1 = line.match(/^#\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);

    if (h1) {
      paragraphs.push(new Paragraph({ 
        children: [new TextRun({
          text: h1[1],
          bold: true,
          size: 32,
          color: "0F172A",
          font: "Traditional Arabic"
        })],
        heading: HeadingLevel.HEADING_1,
        bidirectional: true,
        spacing: { before: 300, after: 200 },
        border: {
          bottom: {
            color: "DC2626",
            space: 1,
            style: HeaderBorderStyle.SINGLE,
            size: 18
          }
        }
      }));
      i++;
      continue;
    }
    if (h2) {
      paragraphs.push(new Paragraph({ 
        children: [new TextRun({
          text: h2[1],
          bold: true,
          size: 28,
          color: "1E293B",
          font: "Traditional Arabic"
        })],
        heading: HeadingLevel.HEADING_2,
        bidirectional: true,
        spacing: { before: 250, after: 150 }
      }));
      i++;
      continue;
    }
    if (h3) {
      paragraphs.push(new Paragraph({ 
        children: [new TextRun({
          text: h3[1],
          bold: true,
          size: 26,
          color: "334155",
          font: "Traditional Arabic"
        })],
        heading: HeadingLevel.HEADING_3,
        bidirectional: true,
        spacing: { before: 200, after: 120 }
      }));
      i++;
      continue;
    }

    // Bullets
    if (line.match(/^\-\s+/)) {
      const bulletLines: string[] = [];
      while (i < lines.length && lines[i].match(/^\-\s+/)) {
        bulletLines.push(lines[i].replace(/^\-\s+/, ''));
        i++;
      }
      
      bulletLines.forEach(text => {
        const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1');
        paragraphs.push(new Paragraph({
          children: [new TextRun({
            text: cleanText,
            size: 24,
            font: "Traditional Arabic"
          })],
          bullet: { level: 0 },
          bidirectional: true,
          spacing: { before: 80, after: 80 }
        }));
      });
      continue;
    }

    // Regular paragraph with bold support
    const parts: TextRun[] = [];
    const boldRegex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    
    while ((match = boldRegex.exec(line)) !== null) {
      const pre = line.substring(lastIndex, match.index);
      if (pre) parts.push(new TextRun({ 
        text: pre,
        size: 24,
        font: "Traditional Arabic"
      }));
      parts.push(new TextRun({ 
        text: match[1], 
        bold: true,
        size: 24,
        font: "Traditional Arabic"
      }));
      lastIndex = match.index + match[0].length;
    }
    const tail = line.substring(lastIndex);
    if (tail) parts.push(new TextRun({ 
      text: tail,
      size: 24,
      font: "Traditional Arabic"
    }));

    paragraphs.push(new Paragraph({ 
      children: parts.length ? parts : [new TextRun({ 
        text: line,
        size: 24,
        font: "Traditional Arabic"
      })],
      bidirectional: true,
      spacing: { before: 100, after: 100 },
      alignment: AlignmentType.BOTH
    }));
    i++;
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720
            }
          }
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}
