import React, { useState, useRef } from "react";
import { Upload } from "lucide-react";
import "./Classification.css";
import { SessionData } from "../ProcessingView";

interface ClassificationProps {
  sessionData: SessionData;
  language?: "en" | "ar";
  onExtractedKey?: (key: string) => void;
}

type LoadingState = "idle" | "upload" | "extract" | "classify" | "save";

const MAX_FILE_SIZE_MB = 4;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const Classification: React.FC<ClassificationProps> = ({
  sessionData,
  language = "en",
  onExtractedKey,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [loading, setLoading] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isArabic = language === "ar";
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const apiBase = process.env.REACT_APP_API_ENDPOINT || "";
  const uploadUrl = `${apiBase}/classification/upload`;
  const extractUrl = `${apiBase}/classification/extract`;
  const storeUrl = `${apiBase}/classification/store`;
  const classifyUrl = `${apiBase}/classification/categorize`;
  const extractFnUrl =
    process.env.REACT_APP_EXTRACT_FN_URL && process.env.REACT_APP_EXTRACT_FN_URL !== ""
      ? process.env.REACT_APP_EXTRACT_FN_URL
      : "https://s2dntz6phbvnsmferrtuirulfe0ziteu.lambda-url.us-east-1.on.aws/";

  const clearMessages = () => {
    setError(null);
    setInfo(null);
  };

  const validateFile = (f: File): string | null => {
    const sizeMb = f.size / 1024 / 1024;
    if (sizeMb > MAX_FILE_SIZE_MB) {
      return t(
        `Max allowed size is ${MAX_FILE_SIZE_MB}MB`,
        `الحد الأقصى للحجم هو ${MAX_FILE_SIZE_MB} ميجابايت`
      );
    }
    if (!ALLOWED_TYPES.includes(f.type)) {
      return t("Invalid file type. Use PDF, Word, or TXT.", "نوع الملف غير مسموح. استخدم PDF أو Word أو TXT.");
    }
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const selected = e.target.files[0];
    const err = validateFile(selected);

    clearMessages();

    if (err) {
      setError(err);
      setFile(null);
      setText("");
      setCategory("");
      setConfidence(null);
      return;
    }

    setFile(selected);
    setText("");
    setCategory("");
    setConfidence(null);
  };

  const getUploadUrl = async (selectedFile: File) => {
    if (!sessionData.sessionId) {
      throw new Error(t("Missing session id.", "لم يتم العثور على رقم الجلسة."));
    }

    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        sessionId: sessionData.sessionId,
      }),
    });

    if (!res.ok) throw new Error(t("Could not get upload URL.", "تعذر إنشاء رابط الرفع."));
    return res.json() as Promise<{ uploadUrl: string; key: string }>;
  };

  const uploadToS3 = async (url: string, selectedFile: File) => {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": selectedFile.type },
      body: selectedFile,
    });

    if (!res.ok) throw new Error(t("Upload failed.", "فشل رفع الملف."));
  };

  const extractText = async (key: string) => {
    if (!sessionData.sessionId) {
      throw new Error(t("Missing session id.", "لم يتم العثور على رقم الجلسة."));
    }

    const targetUrl = extractFnUrl || extractUrl;
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key,
        sessionId: sessionData.sessionId,
      }),
    });

    if (!res.ok) throw new Error(t("Extraction failed.", "فشل الاستخراج."));
    return res.json() as Promise<{ extracted_text: string; category?: string }>;
  };

  const storeExtractedText = async (textToStore: string) => {
    const res = await fetch(storeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionData.sessionId,
        extracted_text: textToStore,
      }),
    });

    if (!res.ok) {
      throw new Error(t("Save failed.", "فشل الحفظ."));
    }

    return res.json() as Promise<{ key: string }>;
  };

  const handleExtract = async () => {
    clearMessages();

    if (!file) {
      setError(t("Please select a document.", "يرجى اختيار ملف."));
      return;
    }

    const err = validateFile(file);
    if (err) {
      setError(err);
      return;
    }

    try {
      setLoading("upload");

      const { uploadUrl: presignedUrl, key } = await getUploadUrl(file);
      await uploadToS3(presignedUrl, file);

      setLoading("extract");

      const result = await extractText(key);

      setText(result.extracted_text || "");
      setCategory("");
      setConfidence(null);
      setInfo(t("Text extracted successfully.", "تم استخراج النص بنجاح."));

      setLoading("classify");

      const classification = await classifyExtractedText(result.extracted_text || "");
      setCategory(classification.category || "");
      setConfidence(
        typeof classification.confidence === "number"
          ? classification.confidence
          : null
      );
      if (classification.reason) {
        setInfo(isArabic ? `تم التصنيف. ${classification.reason}` : `Classified. ${classification.reason}`);
      } else {
        setInfo(t("Classified successfully.", "تم التصنيف بنجاح."));
      }
    } catch (e: any) {
      setError(e.message || t("Something went wrong.", "حدث خطأ ما."));
    } finally {
      setLoading("idle");
    }
  };

  const handleSave = async () => {
    clearMessages();

    if (!text) {
      setError(t("Nothing to save.", "لا يوجد نص للحفظ."));
      return;
    }

    try {
      setLoading("save");
      const saveResult = await storeExtractedText(text);
      if (saveResult?.key) {
        onExtractedKey?.(saveResult.key);
      }
      setInfo(t("Saved.", "تم الحفظ."));
    } catch (e: any) {
      setError(e.message || t("Save failed.", "فشل الحفظ."));
    } finally {
      setLoading("idle");
    }
  };

  const classifyExtractedText = async (textToClassify: string) => {
    const res = await fetch(classifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionData.sessionId,
        extracted_text: textToClassify,
      }),
    });

    if (!res.ok) throw new Error(t("Classification failed.", "فشل التصنيف."));
    return res.json() as Promise<{ category: string; confidence?: number; reason?: string }>;
  };

  const isBusy = loading !== "idle";

  return (
    <div className="classification-page">
      {/* title + description like other tabs */}
      <div className="classification-header">
        <h2>{t("Document Classification", "تصنيف المستند")}</h2>
        <p>
          {t(
            "Upload an investigation document, extract the key text, and view the detected category for the case.",
            "قم برفع مستند التحقيق لاستخراج النص كاملًا والتحقق من التصنيف."
          )}
        </p>
      </div>

      {/* upload section */}
      <div className="upload-section">
        <div
          className="upload-box"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="upload-icon">
            <Upload size={32} />
          </div>

          <p className="upload-title">
            {file ? t("Change document", "تغيير الملف") : t("Upload document", "رفع ملف")}
          </p>
          <p className="upload-sub">
            {t(
              `PDF, Word, or TXT — up to ${MAX_FILE_SIZE_MB} MB`,
              ` MB ${MAX_FILE_SIZE_MB} أقصى حجم - TXT او word او PDF ملفات `

            )}
          </p>

          <button
            className="upload-btn"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            disabled={isBusy}
          >
            {file ? t("Choose another file", "اختر ملفاً آخر") : t("Click to browse", "اضغط للاختيار")}
          </button>

          <input
            type="file"
            ref={fileInputRef}
            className="upload-input"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileChange}
          />

          {file && (
            <p className="upload-file-name">
              {t("Selected:", "الملف المختار:")} <strong>{file.name}</strong>
            </p>
          )}
        </div>

        {error && <div className="msg msg-error">{error}</div>}
        {info && <div className="msg msg-success">{info}</div>}
      </div>

      {/* extraction section */}
      <div className="results-card">
        <div className="results-header">
          <h3>{t("Extracted Text", "النص المستخرج")}</h3>
          <span className="status-chip">
            {loading === "upload" || loading === "extract"
              ? t("Processing", "جارٍ المعالجة")
              : loading === "classify"
              ? t("Classifying", "جارٍ التصنيف")
              : text
              ? t("Completed", "اكتملت المعالجة")
              : t("Pending", "قيد الانتظار")}
          </span>
        </div>

        <textarea
          className="results-textarea"
          placeholder={t("Extracted text will appear here after processing...", "سيظهر النص المستخرج هنا بعد المعالجة...")}
          value={text}
          readOnly
        />

        <div className="category-block">
          <p className="category-label">{t("Detected Category", "الفئة المكتشفة")}</p>
          <textarea
            className="category-textarea"
            placeholder={t("Category will appear here.", "سيظهر التصنيف هنا.")}
            value={category}
            readOnly
          />
          <p className="category-label" style={{ marginTop: 8 }}>
            {t("Confidence", "درجة الثقة")}
          </p>
          <p className="category-textarea" style={{ minHeight: "auto", padding: "10px" }}>
            {confidence !== null ? `${(confidence * 100).toFixed(1)}%` : t("Not classified yet.", "لم يتم التصنيف بعد.")}
          </p>
        </div>

        <div className="actions">
          <button
            className="action-btn primary"
            onClick={handleExtract}
            disabled={isBusy}
          >
            {loading === "upload" || loading === "extract"
              ? t("Processing...", "جارٍ المعالجة...")
              : t("Extract", "استخراج")}
          </button>

          <button
            className="action-btn secondary"
            onClick={handleSave}
            disabled={isBusy || !text}
          >
            {t("Save", "حفظ")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Classification;


