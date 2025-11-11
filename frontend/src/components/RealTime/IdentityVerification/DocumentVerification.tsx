import React, { useRef, useState, useCallback, useMemo } from "react";
import {
  CheckCircle,
  RefreshCw,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  DocumentVerificationProps,
  DocumentType,
  VerificationState,
} from "../../../types/identityVerification";
import IdentityVerificationService from "../../../services/IdentityVerification/IdentityVerificationService";

const DocumentVerification: React.FC<DocumentVerificationProps> = ({
  identityData,
  onIdentityDataChange,
  onStartInvestigation,
  caseId,
  sessionId,
  personType,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("cpr");

  const [verificationState, setVerificationState] = useState<VerificationState>(
    {
      isUploading: false,
      isVerifying: false,
      uploadProgress: { document: 0, photo: 0 },
      error: null,
      verificationResult: null,
    }
  );

  // Memoized document display name
  const documentDisplayName = useMemo(() => {
    return documentType === "cpr" ? "CPR" : "Passport";
  }, [documentType]);

  // Memoized current document
  const currentDocument = useMemo(() => {
    return identityData[documentType];
  }, [identityData, documentType]);

  // Memoized handler for file uploads
  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const validation = IdentityVerificationService.validateFile(file);
      if (!validation.valid) {
        alert(validation.error);
        return;
      }

      onIdentityDataChange("referencePhoto", file);
      console.log("Person photo uploaded:", file.name);
    },
    [onIdentityDataChange]
  );

  // Memoized handler for document uploads
  const handleDocumentUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const validation = IdentityVerificationService.validateFile(file);
      if (!validation.valid) {
        alert(validation.error);
        return;
      }

      onIdentityDataChange(documentType, file);
      console.log(
        `${documentType.toUpperCase()} document uploaded:`,
        file.name
      );
    },
    [documentType, onIdentityDataChange]
  );

  // Memoized handler for complete verification
  const handleCompleteVerification = useCallback(async () => {
    if (!identityData.referencePhoto) {
      alert("Please upload a person photo first.");
      return;
    }

    if (!currentDocument) {
      alert(`Please upload a ${documentDisplayName} document first.`);
      return;
    }

    setVerificationState((prev) => ({
      ...prev,
      isVerifying: true,
      error: null,
      uploadProgress: { document: 0, photo: 0 },
    }));

    try {
      console.log("Starting identity verification workflow...");

      const result =
        await IdentityVerificationService.completeIdentityVerification(
          caseId,
          sessionId,
          currentDocument,
          identityData.referencePhoto,
          personType,
          undefined 
        );

      console.log("Verification completed:", result);

      setVerificationState((prev) => ({
        ...prev,
        isVerifying: false,
        verificationResult: result,
      }));

      onIdentityDataChange("isVerified", true);


      if (result.match) {
        alert(
          `Identity Verified!\n\n` +
            `Name: ${result.personName}\n` +
            `CPR: ${result.cprNumber}\n` +
            `Nationality: ${result.nationality}\n` +
            `Similarity: ${result.similarity}%\n` +
            `Confidence: ${result.confidence}`
        );
        onStartInvestigation();
      } else {
        alert(
          `Identity Verification Failed\n\n` +
            `The person photo does not match the document.\n` +
            `Similarity: ${result.similarity}%\n\n` +
            `Please verify the documents and try again.`
        );
      }
    } catch (error) {
      console.error("Verification error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Verification failed";

      setVerificationState((prev) => ({
        ...prev,
        isVerifying: false,
        error: errorMessage,
      }));

      alert(
        `Verification Error\n\n` +
          `${errorMessage}\n\n` +
          `Please try again or contact support.`
      );
    }
  }, [
    caseId,
    sessionId,
    identityData.referencePhoto,
    currentDocument,
    documentDisplayName,
    personType,
    onIdentityDataChange,
    onStartInvestigation,
  ]);

  const toggleDocumentType = useCallback(() => {
    setDocumentType((prevType) => (prevType === "cpr" ? "passport" : "cpr"));
  }, []);

  // Memoized verification disabled state
  const isVerificationDisabled = useMemo(() => {
    return (
      !identityData.referencePhoto ||
      !currentDocument ||
      verificationState.isVerifying
    );
  }, [
    identityData.referencePhoto,
    currentDocument,
    verificationState.isVerifying,
  ]);

  return (
    <div className="identity-verification-container">
      <div className="session-card">
        <h2 className="card-title">Identity Verification</h2>

        {verificationState.error && (
          <div className="error-banner">
            <AlertCircle size={20} />
            <span>{verificationState.error}</span>
          </div>
        )}

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
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".jpg,.jpeg,.png"
                className="hidden"
                disabled={verificationState.isVerifying}
                aria-label="Upload person photo"
              />

              <div className="upload-icon">📁</div>
              <p className="upload-text">Upload a clear photo of the person</p>

              <button
                className="upload-button"
                disabled={verificationState.isVerifying}
                type="button"
              >
                Upload Person Photo
              </button>
              <p className="file-types">JPG, PNG (Max 10MB)</p>

              {identityData.referencePhoto && (
                <div className="upload-success">
                  <CheckCircle size={16} />
                  <span>
                    {identityData.referencePhoto.name} uploaded successfully
                  </span>
                </div>
              )}

              {verificationState.isVerifying &&
                verificationState.uploadProgress.photo > 0 && (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${verificationState.uploadProgress.photo}%`,
                        }}
                      />
                    </div>
                    <span>{verificationState.uploadProgress.photo}%</span>
                  </div>
                )}
            </div>
          </div>

          {/* Document Section */}
          <div className="verification-section">
            <div className="document-header">
              <label className="form-label">
                {documentDisplayName} Document *
              </label>
              <button
                onClick={toggleDocumentType}
                className="toggle-document-btn"
                type="button"
                disabled={verificationState.isVerifying}
              >
                <RefreshCw size={16} />
                Verify with {documentType === "cpr" ? "Passport" : "CPR"}{" "}
                instead
              </button>
            </div>

            <p className="form-description">
              Upload {documentDisplayName.toLowerCase()} document for identity
              verification
            </p>

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
                ref={documentInputRef}
                onChange={handleDocumentUpload}
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                disabled={verificationState.isVerifying}
                aria-label={`Upload ${documentDisplayName.toLowerCase()} document`}
              />

              <div className="upload-icon">📄</div>
              <p className="upload-text">
                Upload {documentDisplayName.toLowerCase()} document
              </p>

              <button
                className="upload-button"
                disabled={verificationState.isVerifying}
                type="button"
              >
                Upload {documentDisplayName}
              </button>
              <p className="file-types">JPG, PNG, PDF (Max 10MB)</p>

              {currentDocument && (
                <div className="upload-success">
                  <CheckCircle size={16} />
                  <span>{currentDocument.name} uploaded successfully</span>
                </div>
              )}

              {verificationState.isVerifying &&
                verificationState.uploadProgress.document > 0 && (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${verificationState.uploadProgress.document}%`,
                        }}
                      />
                    </div>
                    <span>{verificationState.uploadProgress.document}%</span>
                  </div>
                )}
            </div>
          </div>

          {/* Verification Button */}
          <button
            onClick={handleCompleteVerification}
            className="btn-success"
            disabled={isVerificationDisabled}
            type="button"
          >
            {verificationState.isVerifying ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Verifying Identity...
              </>
            ) : (
              <>
                Complete Identity Verification
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentVerification;
