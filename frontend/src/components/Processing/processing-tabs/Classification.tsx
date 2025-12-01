import React, { useState, useRef } from "react";
import { Upload } from "lucide-react";
import "./Classification.css";
import { SessionData } from "../ProcessingView";
import authService from "../../../services/authService";

interface ClassificationProps {
  sessionData: SessionData;
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

const Classification: React.FC<ClassificationProps> = ({ sessionData, onExtractedKey }) => {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [loading, setLoading] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
    if (sizeMb > MAX_FILE_SIZE_MB) return `Max allowed size is ${MAX_FILE_SIZE_MB}MB`;
    if (!ALLOWED_TYPES.includes(f.type)) return "Invalid file type. Use PDF, Word, or TXT.";
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

  const getTokens = async () => {
    const sessionResult = await authService.getSession();
    const idToken = sessionResult.session?.tokens?.idToken?.toString();
    const accessToken = sessionResult.session?.tokens?.accessToken?.toString();
    if (!sessionResult.success || !idToken) {
      throw new Error("Not authenticated. Please sign in again.");
    }
    return { idToken, accessToken };
  };

  const getUploadUrl = async (file: File) => {
    if (!sessionData.sessionId) {
      throw new Error("Missing session id.");
    }

    const { idToken } = await getTokens();

    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        sessionId: sessionData.sessionId,
      }),
    });

    if (!res.ok) throw new Error("Could not get upload URL.");
    return res.json() as Promise<{ uploadUrl: string; key: string }>;
  };

  const uploadToS3 = async (url: string, file: File) => {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!res.ok) throw new Error("Upload failed.");
  };

  const extractText = async (key: string) => {
    if (!sessionData.sessionId) {
      throw new Error("Missing session id.");
    }

    const { idToken, accessToken } = await getTokens();

    const targetUrl = extractFnUrl || extractUrl;
    const tokenForThisCall = extractFnUrl ? accessToken : idToken;
    if (!tokenForThisCall) {
        throw new Error("Missing auth token for extraction.");
    }

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenForThisCall}`,
      },
      body: JSON.stringify({
        key,
        sessionId: sessionData.sessionId,
      }),
    });

    if (!res.ok) throw new Error("Extraction failed.");
    return res.json() as Promise<{ extracted_text: string; category?: string }>;
  };

  const storeExtractedText = async (textToStore: string) => {
    const { idToken } = await getTokens();

    const res = await fetch(storeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        sessionId: sessionData.sessionId,
        extracted_text: textToStore,
      }),
    });

    if (!res.ok) {
      throw new Error("Save failed.");
    }

    return res.json() as Promise<{ key: string }>;
  };

  const handleExtract = async () => {
    clearMessages();

    if (!file) {
      setError("Please select a document.");
      return;
    }

    const err = validateFile(file);
    if (err) {
      setError(err);
      return;
    }

    try {
      setLoading("upload");

      const { uploadUrl, key } = await getUploadUrl(file);
      await uploadToS3(uploadUrl, file);

      setLoading("extract");

      const result = await extractText(key);

      setText(result.extracted_text || "");
      setCategory("");
      setConfidence(null);
      setInfo("Text extracted successfully.");

      setLoading("classify");
      
      const classification = await classifyExtractedText(result.extracted_text || "");
      setCategory(classification.category || "");
      setConfidence(
        typeof classification.confidence === "number"
          ? classification.confidence
          : null
      );
      if (classification.reason) {
        setInfo(`Classified. ${classification.reason}`);
      } else {
        setInfo("Classified successfully.");
      }
      
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading("idle");
    }
  };

  const handleSave = async () => {
    clearMessages();

    if (!text) {
      setError("Nothing to save.");
      return;
    }

    try {
      setLoading("save");
      const saveResult = await storeExtractedText(text);
      if (saveResult?.key) {
        onExtractedKey?.(saveResult.key);
      }
      setInfo("Saved.");
    } catch (e: any) {
      setError(e.message || "Save failed.");
    } finally {
      setLoading("idle");
    }
  };

  const classifyExtractedText = async (textToClassify: string) => {
    const { idToken } = await getTokens();

    const res = await fetch(classifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        sessionId: sessionData.sessionId,
        extracted_text: textToClassify,
      }),
    });

    if (!res.ok) throw new Error("Classification failed.");
    return res.json() as Promise<{ category: string; confidence?: number; reason?: string }>;
  };

  const isBusy = loading !== "idle";

  return (
    <div className="classification-page">
      {/* title + description like other tabs */}
      <div className="classification-header">
        <h2>Document Classification</h2>
        <p>
          Upload an investigation document, extract the key text, and view the
          detected category for the case.
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
            {file ? "Change document" : "Upload document"}
          </p>
          <p className="upload-sub">
            PDF, Word, or TXT • up to {MAX_FILE_SIZE_MB} MB
          </p>

          <button
            className="upload-btn"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            disabled={isBusy}
          >
            {file ? "Choose another file" : "Click to browse"}
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
              Selected: <strong>{file.name}</strong>
            </p>
          )}
        </div>

        {error && <div className="msg msg-error">{error}</div>}
        {info && <div className="msg msg-success">{info}</div>}
      </div>

      {/* extraction section */}
      <div className="results-card">
        <div className="results-header">
          <h3>Text Extraction</h3>
          <span className="status-chip">
            {loading === "upload" || loading === "extract"
              ? "Processing"
              : loading === "classify"
              ? "Classifying"
              : text
              ? "Completed"
              : "Pending"}
          </span>
        </div>

        <textarea
          className="results-textarea"
          placeholder="Extracted text will appear here after processing..."
          value={text}
          readOnly
        />

        <div className="category-block">
          <p className="category-label">Detected Category</p>
          <textarea
            className="category-textarea"
            placeholder="Category will appear here."
            value={category}
            readOnly
          />
          <p className="category-label" style={{ marginTop: 8 }}>
            Confidence
          </p>
          <p className="category-textarea" style={{ minHeight: "auto", padding: "10px" }}>
            {confidence !== null ? `${(confidence * 100).toFixed(1)}%` : "Not classified yet."}
          </p>
        </div>

        <div className="actions">
          <button
            className="action-btn primary"
            onClick={handleExtract}
            disabled={isBusy}
          >
            {loading === "upload" || loading === "extract"
              ? "Processing..."
              : "Extract"}
          </button>

          <button
            className="action-btn secondary"
            onClick={handleSave}
            disabled={isBusy || !text}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default Classification;
