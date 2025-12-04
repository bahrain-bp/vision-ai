import React, { useRef } from "react";
import { CheckCircle, RefreshCw } from "lucide-react";
import { DocumentType } from "../../../types/identityVerification";

interface DocumentUploadSectionProps {
  documentType: DocumentType;
  documentDisplayName: string;
  currentDocument: File | null;
  onDocumentUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleDocumentType: () => void;
  isVerifying: boolean;
  isVerified: boolean;
  documentInputKey: number;
  t: (key: string) => string;
}

const DocumentUploadSection: React.FC<DocumentUploadSectionProps> = ({
  documentType,
  documentDisplayName,
  currentDocument,
  onDocumentUpload,
  onToggleDocumentType,
  isVerifying,
  isVerified,
  documentInputKey,
  t,
}) => {
  const documentInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="verification-section">
      <div className="document-header">
        <label className="form-label">{documentDisplayName}</label>
        <button
          onClick={onToggleDocumentType}
          className="toggle-document-btn"
          type="button"
          disabled={isVerifying}
        >
          {documentType === "passport" && (
            <div className="passport-disclaimer text-sm text-yellow-700 bg-yellow-100 p-2 rounded mb-4">
              {t("identity.passportWarning")}
            </div>
          )}
          <RefreshCw size={16} />
          {t("identity.verifyWith")}{" "}
          {documentType === "cpr" ? t("identity.passport") : t("identity.cpr")}
        </button>
      </div>

      <p className="form-description">{t("identity.uploadDocument")}</p>

      <div
        className="file-upload-area"
        onClick={() => documentInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            documentInputRef.current?.click();
          }
        }}
      >
        <input
          type="file"
          key={documentInputKey}
          ref={documentInputRef}
          onChange={onDocumentUpload}
          accept=".jpg,.jpeg,.png,.pdf"
          className="hidden"
          disabled={isVerifying || isVerified}
          aria-label={`Upload ${documentDisplayName.toLowerCase()} document`}
        />

        <div className="upload-icon">📄</div>
        <p className="upload-text">
          {t("identity.uploadDocumentDescription")}{" "}
          {documentDisplayName.toLowerCase()}
        </p>

        <button
          className="upload-button"
          disabled={isVerifying || isVerified}
          type="button"
        >
          {t("identity.uploadButton")}
        </button>
        <p className="file-types">JPG, PNG, PDF (Max 10MB)</p>

        {currentDocument && (
          <div className="upload-success">
            <CheckCircle size={16} />
            <span>
              {currentDocument.name} {t("identity.uploadSuccess")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentUploadSection;
