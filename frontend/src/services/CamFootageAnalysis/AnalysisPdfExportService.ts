import html2pdf from "html2pdf.js";

export const exportAnalysisResultsAsPDF = (
  videoName: string,
  sessionId: string,
  language: "en" | "ar"
) => {
  try {
    const element = document.getElementById("analysis-content");

    if (!element) {
      alert("No content to export");
      return;
    }

    // Clone the element to avoid modifying the original
    const clonedElement = element.cloneNode(true) as HTMLElement;

    // Remove buttons
    clonedElement
      .querySelectorAll(
        "button, .export-actions, .edit-actions, .language-toggle"
      )
      .forEach((btn) => btn.remove());

    // Create a temporary container with proper styling
    const container = document.createElement("div");
    container.style.padding = "20px";
    container.style.backgroundColor = "#ffffff";
    container.style.fontFamily =
      language === "ar" ? "Arial, sans-serif" : "Roboto, sans-serif";
    container.style.direction = language === "ar" ? "rtl" : "ltr";
    container.style.textAlign = language === "ar" ? "right" : "left";

    // Add header
    const header = document.createElement("div");
    header.style.borderBottom = "2px solid #0066cc";
    header.style.paddingBottom = "15px";
    header.style.marginBottom = "20px";
    header.innerHTML = `
      <h1 style="color: #0066cc; margin: 0 0 15px 0; text-align: center; font-size: 28px;">
        ${language === "ar" ? "تقرير تحليل الفيديو" : "Video Analysis Report"}
      </h1>
      <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 15px; font-size: 12px; color: #666;">
        <div><strong>${
          language === "ar" ? "الفيديو:" : "Video:"
        }</strong> ${videoName}</div>
        <div><strong>${
          language === "ar" ? "رقم الجلسة:" : "Session ID:"
        }</strong> ${sessionId}</div>
        <div><strong>${
          language === "ar" ? "تم الإنشاء:" : "Generated:"
        }</strong> ${new Date().toLocaleString()}</div>
      </div>
    `;
    container.appendChild(header);

    // Add cloned content
    container.appendChild(clonedElement);

    // Append to body temporarily
    const tempDiv = document.createElement("div");
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    tempDiv.style.width = "1200px";
    tempDiv.appendChild(container);
    document.body.appendChild(tempDiv);

    // Options optimized for tall content
    const options = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `${videoName}-${new Date().getTime()}.pdf`,
      image: { type: "png" as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: "#ffffff",
        windowHeight: 1300,
        windowWidth: 1200,
      },
      jsPDF: {
        orientation: "portrait" as const,
        unit: "mm" as const,
        format: "a4",
        compress: true,
      },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] as const },
    };

    // Generate PDF
    html2pdf()
      .set(options)
      .from(container)
      .save()
      .finally(() => {
        // Clean up
        document.body.removeChild(tempDiv);
      });
  } catch (error) {
    console.error("PDF export error:", error);
    alert("Failed to export PDF");
  }
};
