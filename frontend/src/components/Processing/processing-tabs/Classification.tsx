import React, { useState } from "react";
import { Upload } from "lucide-react";

const Classification: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string>("");
  const [category, setCategory] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setText("");
      setCategory("");
    }
  };

  const handleExtract = () => {
    if (!file) {
      alert("Please choose a document first!");
      return;
    }
    setText(`✅ Text successfully extracted from: ${file.name}`);
    const detectedCategory = "Violation"; // sample
    setCategory(detectedCategory);
  };

  const handleSave = () => {
    if (!text) {
      alert("Please Extract data first!");
      return;
    }
    alert("The extracted text saved successfully");
  };

  return (
    <div className="classification-full">
      <div className="classification-full-header">
        <h2>Classification</h2>
        <p>Upload and classify investigation documents</p>
      </div>

      <div className="classification-full-body">
        <div className="upload-box">
          <Upload className="upload-icon" />
          <p className="upload-title">Upload Document</p>
          <p className="upload-subtitle">
            Support for PDF, Word, TXT and other formats
          </p>

          <input
            type="file"
            id="fileInput"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            className="upload-btn"
            onClick={() => document.getElementById("fileInput")?.click()}
          >
            Choose Document
          </button>

          {file && (
            <p className="upload-success">
              ✅ Uploaded: <strong>{file.name}</strong>
            </p>
          )}
        </div>

        <div className="extraction-section">
          <h3>Text Extraction</h3>
          <textarea
            className="extraction-textarea"
            readOnly
            value={
              text || "Extracted text will appear here after processing..."
            }
          />
          <div className="category-row">
            <h3>Category</h3>
            <textarea 
              className="category-textarea"
              readOnly
              value={category || ""}
            />
          </div>
          <div className="actions">
            <button className="extract-btn" onClick={handleExtract}>Extract</button>
            <button className="extract-btn" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Classification;
