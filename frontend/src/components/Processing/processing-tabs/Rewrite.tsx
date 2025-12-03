import React, { useState } from "react";
import MarkdownPreview from "./MarkdownPreview";
import { exportMarkdownToPDF, exportMarkdownToDocx } from "./ExportUtils";
import { Sparkles, Lock, AlertCircle } from "lucide-react";
import "./Rewrite.css";

interface SessionData {
  sessionId: string;
  extractedText?: string;  // Add extracted text field
}

interface RewriteProps {
  sessionData: SessionData;
  selectedLanguage: "en" | "ar";
}

const Rewrite: React.FC<RewriteProps> = ({ sessionData, selectedLanguage }) => {
  const [rewrittenText, setRewrittenText] = useState("");
  const [originalRewrittenText, setOriginalRewrittenText] = useState(""); // Store original Arabic
  const [caseNumber, setCaseNumber] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Helper function for bilingual text (like Classification)
  const isArabic = selectedLanguage === "ar";
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  // Simple translation function (basic word replacement for common terms)
  const translateToEnglish = (arabicText: string): string => {
    if (!arabicText) return arabicText;
    
    // Keep markdown structure intact
    let translated = arabicText;
    
    // Common translations - expand this dictionary for better coverage
    const translations: Record<string, string> = {
      // Headers and sections
      "بيانات القضية": "Case Information",
      "رقم البلاغ": "Report Number",
      "رقم القضية": "Case Number",
      "نوع القضية": "Case Type",
      "الجهة": "Authority",
      "نيابة العاصمة": "Capital Prosecution",
      "مركز شرطة الحورة": "Al Hoora Police Station",
      "تاريخ ووقت فتح المحضر": "Date and Time of Report Opening",
      "الأطراف": "Parties",
      "الصفة": "Role",
      "الاسم الكامل": "Full Name",
      "الجنسية": "Nationality",
      "الرقم الشخصي": "Personal ID Number",
      "الهاتف": "Phone Number",
      
      // Roles
      "مبلغ": "Reporter",
      "مدعى عليه": "Accused",
      "ضابط": "Officer",
      "محرر محضر": "Report Writer",
      "محرر المحضر": "Report Writer",
      "وكيل نيابة": "Prosecutor",
      "رائد": "Major",
      "عريف": "Corporal",
      "ملازم": "Lieutenant",
      "مساعد ملازم": "Assistant Lieutenant",
      "رئيس عرفاء": "Chief Corporal",
      
      // Sections
      "ملخص الحادث": "Incident Summary",
      "مسرح الحادث": "Crime Scene",
      "المضبوطات": "Seized Items",
      "الأضرار": "Damages",
      "الأقوال": "Statements",
      "أقوال المبلغ": "Reporter's Statement",
      "أقوال المدعى عليه": "Accused's Statement",
      "أقوال الشهود": "Witnesses' Statements",
      "إجراءات الشرطة": "Police Procedures",
      "التنازل أو الصلح": "Waiver or Settlement",
      "إجراءات وقرارات النيابة": "Prosecution Decisions",
      "تسليم المضبوطات": "Delivery of Seized Items",
      "التواريخ المهمة": "Important Dates",
      "التوقيعات والمحررين": "Signatures and Authors",
      "محررو المحاضر": "Report Writers",
      "الضباط المشرفين": "Supervising Officers",
      "وكلاء النيابة": "Prosecutors",
      "أخصائيي التحقيق": "Investigation Specialists",
      "ملاحق إضافية": "Additional Attachments",
      
      // Witness-related (must come before verb "saw")
      "شاهد": "Witness",
      
      // Common phrases
      "غير مذكور": "Not mentioned",
      "لا يوجد": "None",
      "في حوالي الساعة": "at approximately",
      "بتاريخ": "on date",
      "حضر": "attended",
      "أفاد": "stated",
      "قام": "did",
      "توجه": "went to",
      "وجد": "found",
      "تم": "was done",
      "يحال": "is referred",
      "للتصرف": "for action",
      "بناء على": "based on",
      "قرار": "decision",
      "إحالة": "referral",
      "حفظ": "archive",
      "توقيف": "detention",
      "إفراج": "release",
      
      // Nationalities
      "مصري": "Egyptian",
      "مصرية": "Egyptian",
      "مغربي": "Moroccan",
      "مغربية": "Moroccan",
      "بحريني": "Bahraini",
      "بحرينية": "Bahraini",
      "سعودي": "Saudi",
      "سعودية": "Saudi",
      "هندي": "Indian",
      "هندية": "Indian",
      "باكستاني": "Pakistani",
      "باكستانية": "Pakistani",
      "فلبيني": "Filipino",
      "فلبينية": "Filipino",
      
      // Places
      "مملكة البحرين": "Kingdom of Bahrain",
      "النيابة العامة": "Public Prosecution",
      "العاصمة": "Capital Governorate",
      "الحورة": "Al Hoora",
      "المنطقة": "Area",
      "المجمع": "Block",
      "الشارع": "Road",
      "طريق": "Road",
      "المبنى": "Building",
      "الشقة": "Apartment",
      "الطابق": "Floor",
      
      // Crime related
      "إتلاف": "damage",
      "إتلاف عمدا": "deliberate damage",
      "سرقة": "theft",
      "اعتداء": "assault",
      "احتيال": "fraud",
      "تهديد": "threat",
      "تزوير": "forgery",
      
      // Time
      "صباحا": "AM",
      "صباحًا": "AM",
      "مساء": "PM",
      "مساءً": "PM",
      "الساعة": "at",
      "يوم": "day",
      "الأحد": "Sunday",
      "الإثنين": "Monday",
      "الثلاثاء": "Tuesday",
      "الأربعاء": "Wednesday",
      "الخميس": "Thursday",
      "الجمعة": "Friday",
      "السبت": "Saturday",
      
      // Actions
      "فتح المحضر": "Opening the report",
      "إغلاق المحضر": "Closing the report",
      "إقفال المحضر": "Closing the report",
      "إعادة فتح المحضر": "Reopening the report",
      "تدوين الأقوال": "Recording statements",
      "المعاينة": "inspection",
      "التصوير": "photography",
      "التحقيق": "investigation",
      "الكشف": "examination",
      
      // Documents
      "المحضر": "the report",
      "البلاغ": "complaint",
      "القضية": "case",
      "التقرير": "report",
      "الإجراءات": "procedures",
      "القرار": "decision",
      
      // Common verbs in past
      "حضر إلى": "came to",
      "توجه إلى": "went to",
      "أبلغ": "informed",
      "قام بـ": "did",
      "أفاد بأن": "stated that",
      "ذكر أن": "mentioned that",
      
      // Yes/No
      "نعم": "Yes",
      "لا": "No"
    };
    
    // Replace each Arabic term with English
    Object.entries(translations).forEach(([ar, en]) => {
      const regex = new RegExp(ar, 'g');
      translated = translated.replace(regex, en);
    });
    
    return translated;
  };

  // Effect to handle language change
  React.useEffect(() => {
    if (originalRewrittenText && selectedLanguage === "en") {
      // Use dictionary-based translation
      const englishVersion = translateToEnglish(originalRewrittenText);
      setRewrittenText(englishVersion);
    } else if (originalRewrittenText && selectedLanguage === "ar") {
      // Show original Arabic
      setRewrittenText(originalRewrittenText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage, originalRewrittenText]);


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
    setStatusMessage(t("Starting rewrite job...", "جارٍ بدء عملية إعادة الكتابة..."));

    try {
      // Get API endpoint
      const apiGatewayEndpoint = process.env.REACT_APP_API_ENDPOINT ||
        `${window.location.origin.replace("localhost", "localhost").split(":")[0]}://${window.location.hostname}:3000`;

      // Prepare request body
      // Exact S3 path for the file
      const s3Key = `classification/extracted/session-20251202225417-34b3d6db/20251202-230047-5fe049bd-9142-4f73-9a30-da104eeb0771.txt`;
      
      const requestBody = {
        sessionId: sessionData.sessionId,
        s3Key: s3Key,
        language: selectedLanguage
      };

      // Step 1: Start the rewrite job
      const requestUrl = `${apiGatewayEndpoint}/rewrite`;
      console.log("Starting rewrite job:", requestUrl);
      console.log("Request body:", requestBody);
      
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `API error: ${response.statusText}`
        );
      }

      const data = await response.json();
      
      // Check if we got a jobId (async mode)
      if (data.jobId) {
        console.log("Job started with ID:", data.jobId);
        setStatusMessage(t("Job started. Checking status...", "جارٍ بدء العملية. مراجعة الحالة..."));
        
        // Step 2: Poll for status
        pollJobStatus(data.jobId, apiGatewayEndpoint);
      } 
      // Fallback: if server returns old sync format (for compatibility)
      else if (data.status === "success" && data.rewrittenText) {
        handleRewriteSuccess(data.rewrittenText);
      } else {
        throw new Error(data.message || "Unexpected response format");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("Failed to start rewrite job", "فشل في بدء عملية إعادة الكتابة");
      setError(errorMessage);
      console.error("Rewrite error:", err);
      setLoading(false);
      setStatusMessage("");
    }
  };

  // Poll job status every 10 seconds
  const pollJobStatus = async (jobId: string, apiEndpoint: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const statusUrl = `${apiEndpoint}/rewrite/status/${jobId}`;
        console.log("Polling status:", statusUrl);
        
        const response = await fetch(statusUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Status check failed: ${response.statusText}`);
        }

        const statusData = await response.json();
        console.log("Status response:", statusData);

        if (statusData.status === "COMPLETED") {
          clearInterval(pollInterval);
          setStatusMessage(t("Rewrite completed!", "تمت إعادة الكتابة بنجاح!"));
          
          if (statusData.rewrittenText) {
            handleRewriteSuccess(statusData.rewrittenText);
          } else {
            setError(t("Rewrite completed but no text returned", "تمت إعادة الكتابة ولكن لم يتم إرجاع النص"));
            setLoading(false);
          }
        } else if (statusData.status === "FAILED") {
          clearInterval(pollInterval);
          const failMsg = statusData.error || t("Rewrite job failed", "فشلت عملية إعادة الكتابة");
          setError(isArabic ? `فشلت إعادة الكتابة: ${failMsg}` : failMsg);
          setLoading(false);
          setStatusMessage("");
        } else if (statusData.status === "PROCESSING") {
          setStatusMessage(t("Processing your report... Please wait.", "جارٍ معالجة التقرير... الرجاء الانتظار."));
        } else {
          setStatusMessage(isArabic ? `الحالة: ${statusData.status}` : `Status: ${statusData.status}`);
        }
      } catch (err) {
        clearInterval(pollInterval);
        const errorMessage =
          err instanceof Error ? err.message : t("Failed to check job status", "فشل في فحص حالة العملية");
        setError(errorMessage);
        console.error("Status check error:", err);
        setLoading(false);
        setStatusMessage("");
      }
    }, 10000); // Poll every 10 seconds

    // Set a maximum timeout of 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (loading) {
        setError(t(
          "Job timeout: Processing took too long. Please try again.",
          "انتهت مهلة العملية: استغرقت وقتًا طويلاً. الرجاء المحاولة مرة أخرى."
        ));
        setLoading(false);
        setStatusMessage("");
      }
    }, 300000); // 5 minutes
  };

  // Handle successful rewrite
  const handleRewriteSuccess = (rawText: string) => {
    const cleanedText = cleanRewrittenText(rawText);
    setOriginalRewrittenText(cleanedText); // Store original Arabic
    
    // Apply language preference
    if (selectedLanguage === "en") {
      const englishVersion = translateToEnglish(cleanedText);
      setRewrittenText(englishVersion);
    } else {
      setRewrittenText(cleanedText);
    }
    
    console.log("Rewritten text received, extracting case number...");
    const extractedCaseNumber = extractCaseNumber(cleanedText);
    console.log("Extracted case number:", extractedCaseNumber);
    setCaseNumber(extractedCaseNumber);
    
    setLoading(false);
    setStatusMessage("");
  };



  return (
    <div className="rewrite-container">
      <div className="rewrite-card">
        <div className="rewrite-header-row">
          <div className="rewrite-icon-circle">
            <Sparkles size={28} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="rewrite-heading">
              {t("Rewrite", "إعادة الكتابة")}
            </h2>
            <p className="rewrite-subheading">
              {t("Rewrite and improve investigation reports", "إعادة كتابة وتحسين تقارير التحقيق")}
            </p>
          </div>
        </div>

        {error && (
          <div className="rewrite-error-message">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Status Message for async processing */}
        {statusMessage && !error && (
          <div className="rewrite-status-message">
            <div className="spinner"></div>
            <span>{statusMessage}</span>
          </div>
        )}

        <div className="rewrite-body">
          <label className="rewrite-section-label">
            {t("Rewritten Report", "التقرير المُعاد كتابته")}
          </label>
          {/* Case Number Display - Only show when case number is extracted */}
          {caseNumber && (
            <div className="case-number-banner">
              <div className="case-number-label">
                {t("Case Number", "القضية رقم")}
              </div>
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
                <span>{t("📄 Export PDF", "📄 تصدير PDF")}</span>
              </button>
              <button
                type="button"
                className="rewrite-primary-btn"
                onClick={() => {
                  exportMarkdownToDocx(rewrittenText, `report_${caseNumber || 'case'}.docx`);
                }}
                style={{ flex: 1 }}
              >
                <span>{t("📝 Export Word", "📝 تصدير Word")}</span>
              </button>
              <button
                type="button"
                className="rewrite-primary-btn"
                onClick={handlePrint}
                style={{ flex: 1 }}
              >
                <span>{t("🖨️ طباعة", "🖨️ Print")}</span>
              </button>
            </div>
          )}
          {/* Preview formatted output - clean and simple */}
          <div style={{
            background: '#ffffff',
            color: '#1a1a1a',
            transition: 'all 0.3s ease',
            borderRadius: 14,
            padding: '24px',
            minHeight: '200px'
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
          <span>
            {loading 
              ? t("Rewriting...", "جارٍ إعادة الكتابة...") 
              : t("Rewrite Report", "إعادة كتابة التقرير")}
          </span>
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
    <div class="header-text">
      <div style="margin-bottom: 8px;">مملكة البحرين</div>
      <div style="font-size: 20px; font-weight: normal; color: #4b5563;">Kingdom of Bahrain</div>
    </div>
    <img class="header-logo" src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Flag_of_Bahrain.svg/320px-Flag_of_Bahrain.svg.png" alt="Bahrain Flag">
  </div>
  <div class="content">
${rendered}
  </div>
</body>
</html>
`;
}