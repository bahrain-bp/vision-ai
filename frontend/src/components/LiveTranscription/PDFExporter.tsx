import React from "react";
import { jsPDF } from "jspdf";
import { Download } from "lucide-react";

interface PDFExporterProps {
  transcript: string;
  title:string,
  fileName:string,
  sessionDate?: string;
}

const PDFExporter: React.FC<PDFExporterProps> = ({
  transcript,
  title,
  fileName,
  sessionDate = new Date().toLocaleDateString(),
}) => {
  const generatePDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(title, 105, 15, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Date: ${sessionDate}`, 105, 25, { align: "center" });

    doc.setFontSize(12);
    const lines = doc.splitTextToSize(transcript, 180);
    doc.text(lines, 15, 35);

    doc.save(`${fileName}${sessionDate.replace(/\//g, "-")}.pdf`);
  };

  return (
    <button onClick={generatePDF} className="action-btn">
      <Download className="btn-icon" />
      <span>Download PDF</span>
    </button>
  );
};

export default PDFExporter;
