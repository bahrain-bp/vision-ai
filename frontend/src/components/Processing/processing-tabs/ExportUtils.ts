import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';

// Arabic font support for jsPDF - using built-in fonts with Unicode support
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export async function exportMarkdownToPDF(markdownHtml: string, fileName: string = 'report.pdf') {
  // Parse the HTML to extract structured content
  const parser = new DOMParser();
  const doc = parser.parseFromString(markdownHtml, 'text/html');
  
  // Initialize PDF with RTL support
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });
  
  // A4 dimensions
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const usableWidth = pageWidth - (2 * margin);
  let yPosition = margin;
  
  // Add header with Bahrain flag and title
  const addHeader = () => {
    pdf.setFillColor(220, 38, 38); // Red bar
    pdf.rect(0, 0, pageWidth, 20, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.text('مملكة البحرين', pageWidth - margin, 12, { align: 'right' });
    
    pdf.setFontSize(12);
    pdf.setTextColor(150, 150, 150);
    pdf.text('Kingdom of Bahrain', pageWidth - margin, 16, { align: 'right' });
    
    yPosition = 25;
  };
  
  addHeader();
  
  const checkPageBreak = (neededSpace: number = 10) => {
    if (yPosition + neededSpace > pageHeight - margin) {
      pdf.addPage();
      addHeader();
    }
  };
  
  // Helper to reverse text for RTL rendering
  const reverseText = (text: string): string => {
    return text.split('').reverse().join('');
  };
  
  // Process content
  const elements = doc.body.children;
  
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i] as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    
    checkPageBreak(15);
    
    if (tagName === 'h1') {
      checkPageBreak(20);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      const text = element.textContent || '';
      const reversed = reverseText(text);
      pdf.text(reversed, pageWidth - margin, yPosition, { align: 'right' });
      
      // Underline
      pdf.setDrawColor(220, 38, 38);
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPosition + 2, pageWidth - margin, yPosition + 2);
      
      yPosition += 12;
    } 
    else if (tagName === 'h2') {
      checkPageBreak(15);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      const text = element.textContent || '';
      const reversed = reverseText(text);
      pdf.text(reversed, pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 10;
    } 
    else if (tagName === 'h3') {
      checkPageBreak(12);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(51, 65, 85);
      const text = element.textContent || '';
      const reversed = reverseText(text);
      pdf.text(reversed, pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 8;
    }
    else if (tagName === 'table') {
      checkPageBreak(30);
      
      // Parse table data
      const rows: string[][] = [];
      const tableRows = element.querySelectorAll('tr');
      
      tableRows.forEach((tr) => {
        const cells = tr.querySelectorAll('th, td');
        const row: string[] = [];
        cells.forEach(cell => {
          row.push(cell.textContent || '');
        });
        rows.push(row);
      });
      
      if (rows.length > 0) {
        const headerRow = rows[0];
        const bodyRows = rows.slice(1);
        
        (pdf as any).autoTable({
          head: [headerRow],
          body: bodyRows,
          startY: yPosition,
          margin: { left: margin, right: margin },
          styles: {
            font: 'helvetica',
            fontSize: 10,
            cellPadding: 4,
            overflow: 'linebreak',
            halign: 'center',
            valign: 'middle',
            textColor: [26, 26, 26]
          },
          headStyles: {
            fillColor: [220, 38, 38],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 11,
            halign: 'center'
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          columnStyles: {
            0: { halign: 'center' },
            1: { halign: 'center' },
            2: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'center' }
          },
          theme: 'grid',
          tableLineColor: [203, 213, 225],
          tableLineWidth: 0.1
        });
        
        yPosition = (pdf as any).lastAutoTable.finalY + 8;
      }
    }
    else if (tagName === 'p') {
      const text = element.textContent || '';
      if (!text.trim()) continue;
      
      checkPageBreak(10);
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(26, 26, 26);
      
      // Split text for multi-line if needed
      const reversed = text.split('').reverse().join('');
      const lines = pdf.splitTextToSize(reversed, usableWidth);
      
      lines.forEach((line: string) => {
        checkPageBreak(6);
        pdf.text(line, pageWidth - margin, yPosition, { align: 'right' });
        yPosition += 6;
      });
      
      yPosition += 2;
    }
    else if (tagName === 'ul' || tagName === 'ol') {
      const items = element.querySelectorAll('li');
      items.forEach((li) => {
        checkPageBreak(8);
        const text = li.textContent || '';
        const reversed = text.split('').reverse().join('');
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(26, 26, 26);
        
        // Bullet
        pdf.setFillColor(220, 38, 38);
        pdf.circle(pageWidth - margin - 2, yPosition - 1.5, 1, 'F');
        
        const lines = pdf.splitTextToSize(reversed, usableWidth - 8);
        lines.forEach((line: string) => {
          checkPageBreak(5);
          pdf.text(line, pageWidth - margin - 6, yPosition, { align: 'right' });
          yPosition += 5;
        });
      });
      yPosition += 2;
    }
    else if (tagName === 'hr') {
      checkPageBreak(5);
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 5;
    }
  }
  
  // Add page numbers
  const pageCount = (pdf as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`${i} / ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }
  
  pdf.save(fileName);
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
                  alignment: TableAlignmentType.CENTER,
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
