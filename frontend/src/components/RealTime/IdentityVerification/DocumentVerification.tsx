import React, { useRef, useState, useCallback, useMemo } from "react";
import { useCaseContext } from "../../../hooks/useCaseContext";
import ConfirmationPopup from "./ConfirmationPopup";
import {
  CheckCircle,
  RefreshCw,
  ArrowRight,
  Loader2,
  AlertCircle,
  XCircle,
  ImageIcon,
} from "lucide-react";
import {
  DocumentVerificationProps,
  DocumentType,
  VerificationState,
} from "../../../types/identityVerification";
import IdentityVerificationService from "../../../services/IdentityVerification/IdentityVerificationService";

const MAX_VERIFICATION_ATTEMPTS = 3;

const validateManualOverrideInput = (
  name: string,
  cpr: string,
  nationality: string
): { valid: boolean; error?: string } => {
  // Validate name - must be at least 2 words, no numbers
  const nameTrimmed = name.trim();
  const nameWords = nameTrimmed.split(/\s+/);

  if (nameWords.length < 2) {
    return {
      valid: false,
      error: "Full name must contain at least 2 words (first and last name)",
    };
  }

  if (/\d/.test(nameTrimmed)) {
    return { valid: false, error: "Name cannot contain numbers" };
  }

  if (nameTrimmed.length < 3) {
    return { valid: false, error: "Name must be at least 3 characters long" };
  }

  // Validate CPR - must be exactly 9 digits
  if (!/^\d{9}$/.test(cpr.trim())) {
    return { valid: false, error: "CPR must be exactly 9 digits" };
  }

  // Validate nationality - no numbers, at least 3 characters
  const nationalityTrimmed = nationality.trim();

  if (/\d/.test(nationalityTrimmed)) {
    return { valid: false, error: "Nationality cannot contain numbers" };
  }

  if (nationalityTrimmed.length < 3) {
    return {
      valid: false,
      error: "Nationality must be at least 3 characters long",
    };
  }

  return { valid: true };
};
const DocumentVerification: React.FC<DocumentVerificationProps> = ({
  identityData,
  onIdentityDataChange,
  onStartInvestigation,
  caseId,
  sessionId,
  personType,
}) => {
  const { setCurrentPersonName, setCurrentPersonType } = useCaseContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [fileInputKey, setFileInputKey] = useState<number>(0);
  const [documentInputKey, setDocumentInputKey] = useState<number>(0);
  const [documentType, setDocumentType] = useState<DocumentType>("cpr");
  const [verificationAttempts, setVerificationAttempts] = useState<number>(0);
  const [manualOverrideReason, setManualOverrideReason] = useState<string>("");
  const [manualParticipantName, setManualParticipantName] =
    useState<string>("");
  const [manualParticipantNationality, setManualParticipantNationality] =
    useState<string>("");
  const [manualParticipantCPR, setManualParticipantCPR] = useState<string>("");
  const [showManualOverride, setShowManualOverride] = useState<boolean>(false);
  const [uploadedPhotoPreview, setUploadedPhotoPreview] = useState<
    string | null
  >(null);
  const [comparisonPhotoPreview, setComparisonPhotoPreview] = useState<
    string | null
  >(null);
  const [loadingReferencePhoto, setLoadingReferencePhoto] =
    useState<boolean>(false);
  const [previousDocumentKey, setPreviousDocumentKey] = useState<string | null>(
    null
  );
  const [previousPersonPhotoKey, setPreviousPersonPhotoKey] = useState<
    string | null
  >(null);

  const [verificationState, setVerificationState] = useState<VerificationState>(
    {
      isUploading: false,
      isVerifying: false,
      uploadProgress: { document: 0, photo: 0 },
      error: null,
      verificationResult: null,
    }
  );

  const [showEndSessionPopup, setShowEndSessionPopup] =
    useState<boolean>(false);

  const documentDisplayName = useMemo(() => {
    return documentType === "cpr" ? "CPR" : "Passport";
  }, [documentType]);

  const currentDocument = useMemo(() => {
    return identityData[documentType];
  }, [identityData, documentType]);

  // Validate that uploaded files are not the same as the other upload to avoid backend failure
  const validateFileSelection = useCallback(
    (file: File, field: keyof typeof identityData): boolean => {
      if (!file) return false;

      // Determine the other field to compare with
      let otherField: keyof typeof identityData | null = null;
      if (field === "referencePhoto") {
        otherField = identityData.cpr
          ? "cpr"
          : identityData.passport
          ? "passport"
          : null;
      } else if (field === "cpr" || field === "passport") {
        otherField = "referencePhoto";
      }

      if (otherField) {
        const otherFile = identityData[otherField];
        if (
          otherFile &&
          otherFile.name === file.name &&
          otherFile.size === file.size
        ) {
          setVerificationState((prev) => ({
            ...prev,
            error:
              "Cannot upload the same file for both document and person photo. Please select different files.",
          }));
          return false;
        }
      }
      return true;
    },
    [identityData]
  );

  const handleDocumentUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setVerificationState((prev) => ({ ...prev, error: null }));

      const file = event.target.files?.[0];

      if (!file) {
        setDocumentInputKey((prev) => prev + 1);
        return;
      }

      const validation = IdentityVerificationService.validateFile(file);
      if (!validation.valid) {
        setVerificationState((prev) => ({
          ...prev,
          error: validation.error || "Invalid file",
        }));
        setDocumentInputKey((prev) => prev + 1);
        return;
      }

      if (!validateFileSelection(file, documentType)) {
        onIdentityDataChange(documentType, null);
        setDocumentInputKey((prev) => prev + 1);
        return;
      }

      onIdentityDataChange(documentType, file);
      setVerificationState((prev) => ({ ...prev, error: null }));
      console.log(
        `${documentType.toUpperCase()} document uploaded:`,
        file.name
      );
      setDocumentInputKey((prev) => prev + 1);
    },
    [documentType, onIdentityDataChange, validateFileSelection]
  );

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setVerificationState((prev) => ({ ...prev, error: null }));
      const file = event.target.files?.[0];
      if (!file) {
        setFileInputKey((prev) => prev + 1);
        return;
      }

      const validation = IdentityVerificationService.validateFile(file);
      if (!validation.valid) {
        setVerificationState((prev) => ({
          ...prev,
          error: validation.error || "Invalid file",
        }));
        setFileInputKey((prev) => prev + 1);
        return;
      }

      if (file.type === "application/pdf") {
        setVerificationState((prev) => ({
          ...prev,
          error:
            "Person photo must be an image (JPG or PNG), not a PDF document. Please upload a photo.",
        }));
        setFileInputKey((prev) => prev + 1);
        return;
      }

      if (!validateFileSelection(file, "referencePhoto")) {
        onIdentityDataChange("referencePhoto", null);
        setFileInputKey((prev) => prev + 1);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      onIdentityDataChange("referencePhoto", file);
      setVerificationState((prev) => ({ ...prev, error: null }));

      setFileInputKey((prev) => prev + 1);
    },
    [onIdentityDataChange, validateFileSelection]
  );

  const handleCompleteVerification = useCallback(async () => {
    if (!identityData.referencePhoto) {
      setVerificationState((prev) => ({
        ...prev,
        error: "Please upload a person photo first.",
      }));
      return;
    }

    if (!currentDocument) {
      setVerificationState((prev) => ({
        ...prev,
        error: `Please upload a ${documentDisplayName} document first.`,
      }));
      return;
    }

    if (verificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
      setVerificationState((prev) => ({
        ...prev,
        error: `Maximum verification attempts (${MAX_VERIFICATION_ATTEMPTS}) reached. Please use manual override or end session.`,
      }));
      setShowManualOverride(true);
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

      const currentAttempt = verificationAttempts + 1;

      const result =
        await IdentityVerificationService.completeIdentityVerification(
          caseId,
          sessionId,
          currentDocument,
          identityData.referencePhoto,
          personType,
          documentType,
          undefined,
          undefined,
          undefined,
          currentAttempt
        );

      setPreviousDocumentKey(result.verificationSummaryKey);
      setPreviousPersonPhotoKey(result.verificationSummaryKey);

      const photoReader = new FileReader();
      photoReader.onloadend = () => {
        setUploadedPhotoPreview(photoReader.result as string);
      };
      photoReader.readAsDataURL(identityData.referencePhoto);

      if (result.photoSource === "global-assets") {
        setLoadingReferencePhoto(true);
        if (result.referencePhotoUrl) {
          console.log(
            "Using presigned reference photo URL from orchestrator:",
            result.referencePhotoUrl
          );
          setComparisonPhotoPreview(result.referencePhotoUrl);
        } else {
          console.log("No reference photo URL available");
          setComparisonPhotoPreview(null);
        }
        setLoadingReferencePhoto(false);
      } else {
        const docReader = new FileReader();
        docReader.onloadend = () => {
          setComparisonPhotoPreview(docReader.result as string);
        };
        docReader.readAsDataURL(currentDocument);
      }

      setVerificationState((prev) => ({
        ...prev,
        isVerifying: false,
        verificationResult: result,
      }));

      setVerificationAttempts(currentAttempt);

      if (result.match) {
        onIdentityDataChange("isVerified", true);
        if (result.personName) {
          setCurrentPersonName(result.personName);
          setCurrentPersonType(personType);
          console.log("Person name stored in context:", result.personName);
        }
        setShowManualOverride(false);
      } else {
        if (currentAttempt >= MAX_VERIFICATION_ATTEMPTS) {
          console.log(
            "Maximum attempts reached, showing manual override options"
          );
          setShowManualOverride(true);
          setVerificationState((prev) => ({
            ...prev,
            error: `Verification failed after ${MAX_VERIFICATION_ATTEMPTS} attempts. Please choose an option below.`,
          }));
        }
      }
    } catch (error) {
      console.error("Verification error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Verification failed";

      const currentAttempt = verificationAttempts + 1;
      setVerificationAttempts(currentAttempt);

      setVerificationState((prev) => ({
        ...prev,
        isVerifying: false,
        error: errorMessage,
      }));

      if (currentAttempt >= MAX_VERIFICATION_ATTEMPTS) {
        console.log(
          "Maximum attempts reached (error case), showing manual override options"
        );
        setShowManualOverride(true);
        setVerificationState((prev) => ({
          ...prev,
          error: `${errorMessage}. Maximum attempts (${MAX_VERIFICATION_ATTEMPTS}) reached. Please choose an option below.`,
        }));
      }
    }
  }, [
    caseId,
    sessionId,
    identityData.referencePhoto,
    currentDocument,
    documentDisplayName,
    personType,
    onIdentityDataChange,
    verificationAttempts,
    setCurrentPersonName,
  ]);

  const handleManualOverride = useCallback(async () => {
    // Validate manual override form inputs using the validation helper
    const validation = validateManualOverrideInput(
      manualParticipantName,
      manualParticipantCPR,
      manualParticipantNationality
    );

    if (!validation.valid) {
      setVerificationState((prev) => ({
        ...prev,
        error: validation.error || "Validation failed",
      }));
      return;
    }

    if (!manualOverrideReason.trim()) {
      setVerificationState((prev) => ({
        ...prev,
        error: "Please provide a reason for manual verification override.",
      }));
      return;
    }

    // For manual override, don't validate the document content
    // Just check that files exist
    if (!identityData.referencePhoto || !currentDocument) {
      setVerificationState((prev) => ({
        ...prev,
        error:
          "Please upload both a person photo and document to proceed with manual override.",
      }));
      return;
    }

    setVerificationState((prev) => ({
      ...prev,
      isVerifying: true,
      error: null,
    }));

    try {
      console.log("Processing manual verification override:", {
        caseId,
        sessionId,
        personType,
        reason: manualOverrideReason,
        participantName: manualParticipantName,
        participantCPR: manualParticipantCPR,
        attempts: verificationAttempts,
      });

      let documentKey = previousDocumentKey;
      let personPhotoKey = previousPersonPhotoKey;

      // For manual override, upload files without content validation
      if (!documentKey || !personPhotoKey) {
        console.log(
          "No previous upload keys found, uploading files for manual override..."
        );

        try {
          // Use direct upload without validation for manual override
          documentKey = await IdentityVerificationService.uploadDocument(
            caseId,
            sessionId,
            currentDocument
          );
          console.log("Document uploaded for manual override:", documentKey);
        } catch (uploadError) {
          console.warn(
            "Document upload failed for manual override:",
            uploadError
          );
          // For manual override, continue with placeholder keys
          documentKey = `manual-override-document-${Date.now()}`;
        }

        try {
          personPhotoKey = await IdentityVerificationService.uploadPersonPhoto(
            caseId,
            sessionId,
            identityData.referencePhoto,
            personType
          );
          console.log(
            "Person photo uploaded for manual override:",
            personPhotoKey
          );
        } catch (uploadError) {
          console.warn(
            "Person photo upload failed for manual override:",
            uploadError
          );
          personPhotoKey = `manual-override-photo-${Date.now()}`;
        }
      }

      // Call verifyIdentity with manualOverride=true
      const result = await IdentityVerificationService.verifyIdentity({
        caseId,
        sessionId,
        documentKey,
        personPhotoKey,
        personType,
        manualOverride: true,
        overrideReason: manualOverrideReason,
        participantName: manualParticipantName.trim(),
        participantCPR: manualParticipantCPR.trim(),
        participantNationality: manualParticipantNationality.trim(),
        attemptNumber: verificationAttempts || MAX_VERIFICATION_ATTEMPTS,
      });

      console.log("Manual override completed:", result);

      setCurrentPersonName(manualParticipantName.trim());
      setCurrentPersonType(personType);
      onIdentityDataChange("isVerified", true);

      setVerificationState((prev) => ({
        ...prev,
        isVerifying: false,
        verificationResult: {
          ...result,
          personName: manualParticipantName.trim(),
          cprNumber: manualParticipantCPR.trim(),
        },
      }));

      setShowManualOverride(false);

      onStartInvestigation();
    } catch (error) {
      console.error("Manual override error:", error);
      setVerificationState((prev) => ({
        ...prev,
        isVerifying: false,
        error:
          error instanceof Error
            ? error.message
            : "Manual override failed. Please try again.",
      }));
    }
  }, [
    manualOverrideReason,
    manualParticipantName,
    manualParticipantCPR,
    manualParticipantNationality,
    caseId,
    sessionId,
    personType,
    verificationAttempts,
    previousDocumentKey,
    previousPersonPhotoKey,
    identityData.referencePhoto,
    currentDocument,
    onIdentityDataChange,
    onStartInvestigation,
    setCurrentPersonName,
  ]);
  // Handler to retry verification after failure
  const handleRetryVerification = useCallback(async () => {
    if (verificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
      setVerificationState((prev) => ({
        ...prev,
        error: `Maximum verification attempts (${MAX_VERIFICATION_ATTEMPTS}) reached. Please choose an option below.`,
      }));
      setShowManualOverride(true);
      return;
    }

    if (previousDocumentKey || previousPersonPhotoKey) {
      try {
        await IdentityVerificationService.deletePreviousVerificationFiles(
          caseId,
          sessionId,
          personType,
          verificationAttempts
        );
        console.log("Previous verification files deleted.");
      } catch (error) {
        console.error("Failed to delete previous verification files:", error);
      }
    }

    setVerificationState((prev) => ({
      ...prev,
      error: null,
      verificationResult: null,
    }));

    setManualOverrideReason("");
    setComparisonPhotoPreview(null);
    setShowManualOverride(false);
  }, [
    caseId,
    sessionId,
    personType,
    verificationAttempts,
    previousDocumentKey,
    previousPersonPhotoKey,
  ]);
  const handleEndSessionClick = useCallback(() => {
    setShowEndSessionPopup(true);
  }, []);

  const handleEndSessionConfirm = useCallback(() => {
    // Reset all state
    setVerificationAttempts(0);
    setShowManualOverride(false);
    setManualOverrideReason("");
    setManualParticipantName("");
    setManualParticipantCPR("");
    setManualParticipantNationality("");
    setUploadedPhotoPreview(null);
    setComparisonPhotoPreview(null);
    setPreviousDocumentKey(null);
    setPreviousPersonPhotoKey(null);
    setShowEndSessionPopup(false);

    onIdentityDataChange("referencePhoto", null);
    onIdentityDataChange("cpr", null);
    onIdentityDataChange("passport", null);
    onIdentityDataChange("isVerified", false);

    setVerificationState({
      isUploading: false,
      isVerifying: false,
      uploadProgress: { document: 0, photo: 0 },
      error: null,
      verificationResult: null,
    });

    console.log("Session ended by user - navigating to homepage");

    // Navigate to homepage
    window.location.href = "/";
  }, [onIdentityDataChange]);

  const handleEndSessionCancel = useCallback(() => {
    setShowEndSessionPopup(false);
  }, []);
  const toggleDocumentType = useCallback(() => {
    const newDocumentType = documentType === "cpr" ? "passport" : "cpr";

    // Only clear the OLD document type if it exists
    if (documentType === "cpr" && identityData.cpr) {
      onIdentityDataChange("cpr", null);
    } else if (documentType === "passport" && identityData.passport) {
      onIdentityDataChange("passport", null);
    }

    setDocumentType(newDocumentType);
  }, [
    documentType,
    identityData.cpr,
    identityData.passport,
    onIdentityDataChange,
  ]);

  const isVerificationDisabled = useMemo(() => {
    return (
      !identityData.referencePhoto ||
      !currentDocument ||
      verificationState.isVerifying ||
      identityData.isVerified ||
      verificationAttempts >= MAX_VERIFICATION_ATTEMPTS
    );
  }, [
    identityData.referencePhoto,
    currentDocument,
    verificationState.isVerifying,
    identityData.isVerified,
    verificationAttempts,
  ]);

  const canRetry = useMemo(() => {
    return (
      verificationAttempts < MAX_VERIFICATION_ATTEMPTS &&
      !identityData.isVerified
    );
  }, [verificationAttempts, identityData.isVerified]);

  const attemptsRemaining = useMemo(
    () => Math.max(0, MAX_VERIFICATION_ATTEMPTS - verificationAttempts),
    [verificationAttempts]
  );

  return (
    <div className="identity-verification-container">
      <div className="session-card">
        <h2 className="card-title">Identity Verification</h2>

        {/* Attempts Counter */}
        {verificationAttempts > 0 && (
          <div className="verification-attempts">
            <span className="attempts-label">Verification Attempts:</span>
            <span
              className={`attempts-count ${
                verificationAttempts >= MAX_VERIFICATION_ATTEMPTS
                  ? "text-red-600 font-bold"
                  : ""
              }`}
            >
              {verificationAttempts} / {MAX_VERIFICATION_ATTEMPTS}
            </span>
            {attemptsRemaining > 0 && (
              <span className="attempts-remaining text-sm text-gray-600 ml-2">
                ({attemptsRemaining} remaining)
              </span>
            )}
            {verificationAttempts >= MAX_VERIFICATION_ATTEMPTS && (
              <span className="text-sm text-red-600 ml-2 font-semibold">
                - Maximum attempts reached
              </span>
            )}
          </div>
        )}

        {/* Error Banner */}
        {verificationState.error && (
          <div className="error-banner">
            <AlertCircle size={20} />
            <span>{verificationState.error}</span>
          </div>
        )}

        {/* Success Banner */}
        {verificationState.verificationResult?.match && (
          <div className="success-banner">
            <CheckCircle size={20} />
            <span>
              Identity Verified Successfully!
              {verificationState.verificationResult.manualOverride &&
                " (Manual Override)"}
            </span>
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
                key={fileInputKey}
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".jpg,.jpeg,.png"
                className="hidden"
                disabled={
                  verificationState.isVerifying || identityData.isVerified
                }
                aria-label="Upload person photo"
              />

              <div className="upload-icon">📁</div>
              <p className="upload-text">Upload a clear photo of the person</p>

              <button
                className="upload-button"
                disabled={
                  verificationState.isVerifying || identityData.isVerified
                }
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
                {documentType === "passport" && (
                  <div className="passport-disclaimer text-sm text-yellow-700 bg-yellow-100 p-2 rounded mb-4">
                    Note: Passport verification is currently optimized for
                    Bahraini passports only. For other nationalities, we
                    recommend using CPR card for best results.
                  </div>
                )}
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
                key={documentInputKey}
                ref={documentInputRef}
                onChange={handleDocumentUpload}
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                disabled={
                  verificationState.isVerifying || identityData.isVerified
                }
                aria-label={`Upload ${documentDisplayName.toLowerCase()} document`}
              />

              <div className="upload-icon">📄</div>
              <p className="upload-text">
                Upload {documentDisplayName.toLowerCase()} document
              </p>

              <button
                className="upload-button"
                disabled={
                  verificationState.isVerifying || identityData.isVerified
                }
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
            </div>
          </div>

          {/* Verification Results or Manual Override Section */}
          {(verificationState.verificationResult ||
            (showManualOverride &&
              verificationAttempts >= MAX_VERIFICATION_ATTEMPTS)) && (
            <div className="verification-result-container">
              {verificationState.verificationResult && (
                <>
                  <h3 className="result-title">Verification Results</h3>

                  <div className="image-comparison-grid">
                    <div className="comparison-image-card">
                      <div className="image-label">Uploaded Photo</div>
                      {uploadedPhotoPreview ? (
                        <img
                          src={uploadedPhotoPreview}
                          alt="Uploaded person for verification"
                          className="comparison-image"
                        />
                      ) : (
                        <div className="image-placeholder">
                          <ImageIcon size={48} />
                          <span>No preview available</span>
                        </div>
                      )}
                    </div>

                    <div className="comparison-image-card">
                      <div className="image-label">
                        Comparison Source (
                        {verificationState.verificationResult.photoSource})
                      </div>
                      {verificationState.verificationResult.photoSource ===
                      "global-assets" ? (
                        loadingReferencePhoto ? (
                          <div className="image-placeholder">
                            <Loader2 size={48} className="animate-spin" />
                            <span>Loading reference photo...</span>
                          </div>
                        ) : comparisonPhotoPreview ? (
                          <img
                            src={comparisonPhotoPreview}
                            alt="Reference from database"
                            className="comparison-image"
                            onError={() => setComparisonPhotoPreview(null)}
                          />
                        ) : (
                          <div className="image-placeholder">
                            <ImageIcon size={48} />
                            <span>Reference photo from database</span>
                          </div>
                        )
                      ) : comparisonPhotoPreview ? (
                        <img
                          src={comparisonPhotoPreview}
                          alt="Comparison source from document"
                          className="comparison-image"
                        />
                      ) : (
                        <div className="image-placeholder">
                          <ImageIcon size={48} />
                          <span>Loading document photo...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="result-details">
                    <div className="result-row">
                      <span className="result-label">Name:</span>
                      <span className="result-value">
                        {verificationState.verificationResult.personName}
                      </span>
                    </div>
                    <div className="result-row">
                      <span className="result-label">CPR Number:</span>
                      <span className="result-value">
                        {verificationState.verificationResult.cprNumber}
                      </span>
                    </div>
                    <div className="result-row">
                      <span className="result-label">Nationality:</span>
                      <span className="result-value">
                        {verificationState.verificationResult.nationality}
                      </span>
                    </div>
                    <div className="result-row">
                      <span className="result-label">Similarity Score:</span>
                      <span className="result-value">
                        {verificationState.verificationResult.similarity}%
                      </span>
                    </div>
                    <div className="result-row">
                      <span className="result-label">Confidence:</span>
                      <span className="result-value">
                        {verificationState.verificationResult.confidence}
                      </span>
                    </div>
                    <div className="result-row">
                      <span className="result-label">Status:</span>
                      <span
                        className={`result-value ${
                          verificationState.verificationResult.match
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {verificationState.verificationResult.match
                          ? "✓ VERIFIED"
                          : "✗ NOT VERIFIED"}
                      </span>
                    </div>
                    {verificationState.verificationResult.manualOverride && (
                      <div className="result-row">
                        <span className="result-label">Override Reason:</span>
                        <span className="result-value text-orange-600">
                          {verificationState.verificationResult.overrideReason}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {((!verificationState.verificationResult?.match &&
                verificationState.verificationResult &&
                !verificationState.verificationResult.manualOverride) ||
                (showManualOverride &&
                  verificationAttempts >= MAX_VERIFICATION_ATTEMPTS)) && (
                <div className="verification-actions">
                  {canRetry && !showManualOverride && (
                    <button
                      onClick={handleRetryVerification}
                      className="btn-secondary"
                      type="button"
                    >
                      <RefreshCw size={18} />
                      Retry Verification ({attemptsRemaining}{" "}
                      {attemptsRemaining === 1 ? "attempt" : "attempts"} left)
                    </button>
                  )}

                  {showManualOverride && (
                    <div className="manual-override-section">
                      <div className="override-warning-box">
                        <AlertCircle size={20} className="warning-icon" />
                        <div className="warning-content">
                          <p className="warning-title">
                            Maximum verification attempts (
                            {MAX_VERIFICATION_ATTEMPTS}) reached.
                          </p>
                          <p className="warning-description">
                            {verificationState.verificationResult
                              ? "The automated verification has failed. Choose one of the following options to proceed:"
                              : "An error occurred during verification. Choose one of the following options to proceed:"}
                          </p>
                        </div>
                      </div>

                      <div className="override-options-container">
                        <div className="override-option-card option-accept">
                          <h4 className="option-title">
                            <CheckCircle size={18} />
                            Option 1: Accept Verification with Manual Entry
                          </h4>
                          <p className="option-description">
                            If you believe the identity is correct despite the
                            failed automated verification, manually enter the
                            participant's details and provide a detailed reason
                            for approval.
                          </p>

                          <div className="form-field">
                            <label className="field-label">
                              Participant Full Name *
                            </label>
                            <input
                              type="text"
                              value={manualParticipantName}
                              onChange={(e) =>
                                setManualParticipantName(e.target.value)
                              }
                              placeholder="Enter full name as shown on document"
                              className="field-input"
                              disabled={verificationState.isVerifying}
                            />
                          </div>

                          <div className="form-field">
                            <label className="field-label">CPR Number *</label>
                            <input
                              type="text"
                              value={manualParticipantCPR}
                              onChange={(e) => {
                                const value = e.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 9);
                                setManualParticipantCPR(value);
                              }}
                              placeholder="Enter 9-digit CPR number"
                              maxLength={9}
                              className="field-input"
                              disabled={verificationState.isVerifying}
                            />
                            <p className="field-hint">9 digits only</p>
                          </div>

                          <div className="form-field">
                            <label className="field-label">Nationality *</label>
                            <input
                              type="text"
                              value={manualParticipantNationality}
                              onChange={(e) =>
                                setManualParticipantNationality(e.target.value)
                              }
                              placeholder="Enter nationality (e.g., Bahraini, Indian, etc.)"
                              className="field-input"
                              disabled={verificationState.isVerifying}
                            />
                          </div>

                          <div className="form-field">
                            <label className="field-label">
                              Reason for Manual Override *
                            </label>
                            <textarea
                              value={manualOverrideReason}
                              onChange={(e) =>
                                setManualOverrideReason(e.target.value)
                              }
                              placeholder="Enter detailed reason for manual approval"
                              className="field-textarea"
                              rows={4}
                              disabled={verificationState.isVerifying}
                            />
                          </div>

                          <button
                            onClick={handleManualOverride}
                            className="btn-accept-override"
                            type="button"
                            disabled={
                              !manualOverrideReason.trim() ||
                              !manualParticipantName.trim() ||
                              !manualParticipantCPR.trim() ||
                              !manualParticipantNationality.trim() ||
                              verificationState.isVerifying
                            }
                          >
                            {verificationState.isVerifying ? (
                              <>
                                <Loader2 size={18} className="spinner-icon" />{" "}
                                Processing Manual Approval...
                              </>
                            ) : (
                              <>
                                <CheckCircle size={18} /> Accept and Proceed to
                                Investigation
                              </>
                            )}
                          </button>
                        </div>

                        <div className="override-option-card option-end">
                          <h4 className="option-title">
                            <XCircle size={18} />
                            Option 2: End This Session
                          </h4>
                          <p className="option-description">
                            If you cannot verify the identity or believe the
                            verification has failed legitimately, you can end
                            this session. All data will be reset.
                          </p>

                          <button
                            onClick={handleEndSessionClick}
                            className="btn-end-session"
                            type="button"
                            disabled={verificationState.isVerifying}
                          >
                            <XCircle size={18} /> End Session and Start Over
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!identityData.isVerified && (
            <button
              onClick={handleCompleteVerification}
              className="btn-success"
              disabled={isVerificationDisabled}
              type="button"
            >
              {verificationState.isVerifying ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Verifying
                  Identity...
                </>
              ) : verificationAttempts >= MAX_VERIFICATION_ATTEMPTS ? (
                <>
                  <AlertCircle size={18} /> Maximum Attempts Reached
                </>
              ) : (
                <>
                  Complete Identity Verification <ArrowRight size={18} />
                </>
              )}
            </button>
          )}

          {identityData.isVerified && (
            <button
              onClick={onStartInvestigation}
              className="btn-primary"
              type="button"
            >
              Proceed to Investigation <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
      {/* End Session Confirmation Popup */}
      <ConfirmationPopup
        isOpen={showEndSessionPopup}
        onClose={handleEndSessionCancel}
        onConfirm={handleEndSessionConfirm}
        title="End Session"
        message="Are you sure you want to end this session? All verification data will be lost and you'll be redirected to the homepage. This action cannot be undone."
        confirmText="End Session"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};

export default DocumentVerification;
