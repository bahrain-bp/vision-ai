import React, { useRef } from "react";
import { Upload, CheckCircle } from "lucide-react";

const DocumentUpload = ({
  documentType,
  onDocumentUpload,
  uploadedDocument,
}) => {
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      onDocumentUpload(documentType, file);
    }
  };

  return (
    <div className="document-upload-section">
      <label className="form-label">{documentType} *</label>
      <p className="form-description">
        Upload {documentType.toLowerCase()} for identity verification
      </p>

      <div
        className="file-upload-area"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".jpg,.jpeg,.png,.pdf"
          className="hidden"
        />

        <div className="upload-icon">📄</div>
        <p className="upload-text">
          Upload {documentType.toLowerCase()} document
        </p>

        <button className="upload-button">Upload {documentType}</button>
        <p className="file-types">JPG, PNG, PDF</p>

        {uploadedDocument && (
          <div className="upload-success">
            <CheckCircle size={16} />
            <span>{documentType} uploaded successfully</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentUpload;
