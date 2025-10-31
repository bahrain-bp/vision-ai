import React, { useRef, useState } from "react";
import { Upload, CheckCircle, RefreshCw, ArrowRight } from "lucide-react";

const DocumentVerification = ({
  identityData,
  onIdentityDataChange,
  onStartInvestigation,
}) => {
  const fileInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const [documentType, setDocumentType] = useState("cpr"); // 'cpr' or 'passport'
  const [personVerified, setPersonVerified] = useState(false);
  const [documentVerified, setDocumentVerified] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      onIdentityDataChange("referencePhoto", file);
    }
  };

  const handleDocumentUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      onIdentityDataChange(documentType, file);
    }
  };

  const handlePersonVerify = () => {
    if (!identityData.referencePhoto) {
      alert("Please upload a person photo first.");
      return;
    }
    setPersonVerified(true);
    alert("Person photo verified successfully!");
  };

  const handleDocumentVerify = () => {
    if (!identityData[documentType]) {
      alert(`Please upload a ${documentType.toUpperCase()} document first.`);
      return;
    }
    setDocumentVerified(true);
    alert(`${getDocumentDisplayName()} document verified successfully!`);
  };

  const handleCompleteVerification = () => {
    if (!personVerified || !documentVerified) {
      alert("Please verify both person photo and document first.");
      return;
    }

    // Update identity verification status
    onIdentityDataChange("isVerified", true);

    // Call the investigation start function
    onStartInvestigation();
  };

  const toggleDocumentType = () => {
    setDocumentType((prevType) => (prevType === "cpr" ? "passport" : "cpr"));
    setDocumentVerified(false); // Reset document verification when switching types
  };

  const getDocumentDisplayName = () => {
    return documentType === "cpr" ? "CPR" : "Passport";
  };

  return (
    <div className="identity-verification-container">
      <div className="session-card">
        <h2 className="card-title">Identity Verification</h2>

        <div className="space-y-8">
          {/* Person Photo Section */}
          <div className="verification-section">
            <label className="form-label">Person Photo *</label>
            <p className="form-description">
              Upload a clear photo of the person for identity verification
              during the investigation
            </p>

            <div
              className="file-upload-area"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".jpg,.jpeg,.png"
                className="hidden"
              />

              <div className="upload-icon">📁</div>
              <p className="upload-text">Upload a clear photo of the person</p>

              <button className="upload-button">Upload Person Photo</button>
              <p className="file-types">JPG, PNG</p>

              {identityData.referencePhoto && (
                <div className="upload-success">
                  <CheckCircle size={16} />
                  <span>Person photo uploaded successfully</span>
                </div>
              )}
            </div>

            {/* Verify Person Photo Button */}
            {identityData.referencePhoto && !personVerified && (
              <div className="verify-section-btn">
                <button onClick={handlePersonVerify} className="btn-verify">
                  <CheckCircle size={16} />
                  Verify Person Photo
                </button>
              </div>
            )}

            {personVerified && (
              <div className="verification-complete">
                <CheckCircle size={16} />
                <span>Person photo verified</span>
              </div>
            )}
          </div>

          {/* Document Upload Section */}
          <div className="verification-section">
            <div className="document-header">
              <label className="form-label">
                {getDocumentDisplayName()} Document *
              </label>
              <button
                onClick={toggleDocumentType}
                className="toggle-document-btn"
                type="button"
              >
                <RefreshCw size={16} />
                Verify with {documentType === "cpr" ? "Passport" : "CPR"}{" "}
                instead
              </button>
            </div>

            <p className="form-description">
              Upload {getDocumentDisplayName().toLowerCase()} document for
              identity verification
            </p>

            <div
              className="file-upload-area"
              onClick={() => documentInputRef.current?.click()}
            >
              <input
                type="file"
                ref={documentInputRef}
                onChange={handleDocumentUpload}
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
              />

              <div className="upload-icon">📄</div>
              <p className="upload-text">
                Upload {getDocumentDisplayName().toLowerCase()} document
              </p>

              <button className="upload-button">
                Upload {getDocumentDisplayName()}
              </button>
              <p className="file-types">JPG, PNG, PDF</p>

              {identityData[documentType] && (
                <div className="upload-success">
                  <CheckCircle size={16} />
                  <span>{getDocumentDisplayName()} uploaded successfully</span>
                </div>
              )}
            </div>

            {/* Verify Document Button */}
            {identityData[documentType] && !documentVerified && (
              <div className="verify-section-btn">
                <button onClick={handleDocumentVerify} className="btn-verify">
                  <CheckCircle size={16} />
                  Verify {getDocumentDisplayName()} Document
                </button>
              </div>
            )}

            {documentVerified && (
              <div className="verification-complete">
                <CheckCircle size={16} />
                <span>{getDocumentDisplayName()} document verified</span>
              </div>
            )}
          </div>

          {/* Complete Verification Button */}
          <button
            onClick={handleCompleteVerification}
            className="btn-success"
            disabled={!personVerified || !documentVerified}
          >
            Complete Identity Verification
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentVerification;
