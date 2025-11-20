import React, { useState, useRef } from "react";
import { Upload } from "lucide-react";
import "./Classification.css";

type LoadingState = "idle" | "upload" | "extract" | "save";

const MAX_FILE_SIZE_MB = 25;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const Classification: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [loading, setLoading] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const apiBase = process.env.REACT_APP_API_ENDPOINT || "";

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
      return;
    }

    setFile(selected);
    setText("");
    setCategory("");
  };

  const getUploadUrl = async (file: File) => {
    const res = await fetch(`${apiBase}/classification/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
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
    const res = await fetch(`${apiBase}/classification/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });

    if (!res.ok) throw new Error("Extraction failed.");
    return res.json() as Promise<{ extracted_text: string; category?: string }>;
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
      setCategory(result.category || "");
      setInfo("Text extracted successfully.");
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading("idle");
    }
  };

  const handleSave = () => {
    clearMessages();

    if (!text) {
      setError("Nothing to save.");
      return;
    }

    setLoading("save");
    setTimeout(() => {
      setLoading("idle");
      setInfo("Saved.");
    }, 400);
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
