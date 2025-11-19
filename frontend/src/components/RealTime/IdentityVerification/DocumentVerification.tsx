import React, { useRef, useState, useCallback, useMemo } from "react";
import { useCaseContext } from "../../../hooks/useCaseContext";
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

const DocumentVerification: React.FC<DocumentVerificationProps> = ({
  identityData,
  onIdentityDataChange,
  onStartInvestigation,
  caseId,
  sessionId,
  personType,
}) => {
  const { setCurrentPersonName } = useCaseContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
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

  const documentDisplayName = useMemo(() => {
    return documentType === "cpr" ? "CPR" : "Passport";
  }, [documentType]);

  const currentDocument = useMemo(() => {
    return identityData[documentType];
  }, [identityData, documentType]);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const validation = IdentityVerificationService.validateFile(file);
      if (!validation.valid) {
        setVerificationState((prev) => ({
          ...prev,
          error: validation.error || "Invalid file",
        }));
        return;
      }

      // Validate it's an image (not a PDF document)
      if (file.type === "application/pdf") {
        setVerificationState((prev) => ({
          ...prev,
          error:
            "Person photo must be an image (JPG or PNG), not a PDF document. Please upload a photo.",
        }));
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      onIdentityDataChange("referencePhoto", file);
      setVerificationState((prev) => ({
        ...prev,
        error: null,
      }));
      console.log("Person photo uploaded:", file.name);
    },
    [onIdentityDataChange]
  );

  const handleDocumentUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const validation = IdentityVerificationService.validateFile(file);
      if (!validation.valid) {
        setVerificationState((prev) => ({
          ...prev,
          error: validation.error || "Invalid file",
        }));
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

    // Check if max attempts reached
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

      // Increment attempt number BEFORE sending request
      const currentAttempt = verificationAttempts + 1;

      const result =
        await IdentityVerificationService.completeIdentityVerification(
          caseId,
          sessionId,
          currentDocument,
          identityData.referencePhoto,
          personType,
          undefined,
          undefined,
          undefined,
          currentAttempt // Pass current attempt number
        );

      console.log("Verification completed:", result);

      // Store the keys for potential cleanup on retry
      setPreviousDocumentKey(result.verificationSummaryKey);
      setPreviousPersonPhotoKey(result.verificationSummaryKey);

      // Always create preview for uploaded photo
      const photoReader = new FileReader();
      photoReader.onloadend = () => {
        setUploadedPhotoPreview(photoReader.result as string);
      };
      photoReader.readAsDataURL(identityData.referencePhoto);

      // Create preview based on photo source
      if (result.photoSource === "global-assets") {
        // Use the presigned URL from the orchestrator response
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
        // For citizen-id-document, show the document preview
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

      // Update attempt counter AFTER successful request
      setVerificationAttempts(currentAttempt);

      if (result.match) {
        onIdentityDataChange("isVerified", true);
        if (result.personName) {
          setCurrentPersonName(result.personName);
          console.log("Person name stored in context:", result.personName);
        }
        setShowManualOverride(false);
      } else {
        // Show manual override option immediately after 3rd attempt
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

      // Increment attempt counter even on error
      const currentAttempt = verificationAttempts + 1;
      setVerificationAttempts(currentAttempt);

      setVerificationState((prev) => ({
        ...prev,
        isVerifying: false,
        error: errorMessage,
      }));

      // Show manual override option immediately after 3rd attempt
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
    // Validate reason
    if (!manualOverrideReason.trim()) {
      setVerificationState((prev) => ({
        ...prev,
        error: "Please provide a reason for manual verification override.",
      }));
      return;
    }

    //  Validate participant name
    if (!manualParticipantName.trim()) {
      setVerificationState((prev) => ({
        ...prev,
        error: "Please enter the participant's full name.",
      }));
      return;
    }

    // Validate participant CPR
    if (!manualParticipantCPR.trim()) {
      setVerificationState((prev) => ({
        ...prev,
        error: "Please enter the participant's CPR number.",
      }));
      return;
    }

    if (!manualParticipantNationality.trim()) {
      setVerificationState((prev) => ({
        ...prev,
        error: "Please enter the participant's nationality.",
      }));
      return;
    }

    //  Validate CPR format (Bahrain CPR is 9 digits)
    const cprRegex = /^\d{9}$/;
    if (!cprRegex.test(manualParticipantCPR.trim())) {
      setVerificationState((prev) => ({
        ...prev,
        error: "Please enter a valid 9-digit CPR number.",
      }));
      return;
    }

    if (!identityData.referencePhoto || !currentDocument) {
      setVerificationState((prev) => ({
        ...prev,
        error: "Missing required files for manual override.",
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

      // If we have previous keys from a failed attempt, use those
      // Otherwise, upload the files now
      let documentKey = previousDocumentKey;
      let personPhotoKey = previousPersonPhotoKey;

      if (!documentKey || !personPhotoKey) {
        console.log("No previous upload keys found, uploading files now...");

        // Upload document
        documentKey = await IdentityVerificationService.uploadDocument(
          caseId,
          sessionId,
          currentDocument
        );
        console.log("Document uploaded for manual override:", documentKey);

        // Upload person photo
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
      }

      // Send verification request with manual override flag AND participant details
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

      // Store the manually entered participant name in context
      setCurrentPersonName(manualParticipantName.trim());
      console.log(
        "Manually entered participant name stored:",
        manualParticipantName
      );

      // Mark as verified
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

      // Proceed to investigation
      setTimeout(() => {
        onStartInvestigation();
      }, 500);
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
  const handleRetryVerification = useCallback(async () => {
    // Check if max attempts reached before allowing retry
    if (verificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
      console.log("Cannot retry - max attempts reached");
      setVerificationState((prev) => ({
        ...prev,
        error: `Maximum verification attempts (${MAX_VERIFICATION_ATTEMPTS}) reached. Please choose an option below.`,
      }));
      setShowManualOverride(true);
      return;
    }

    console.log("Retrying verification, clearing previous state");

    // Delete previous verification files if they exist
    if (previousDocumentKey || previousPersonPhotoKey) {
      try {
        await IdentityVerificationService.deletePreviousVerificationFiles(
          caseId,
          sessionId,
          personType,
          verificationAttempts
        );
        console.log("Previous verification files deleted successfully");
      } catch (error) {
        console.error("Error deleting previous verification files:", error);
        // Continue with retry even if deletion fails
      }
    }

    setVerificationState((prev) => ({
      ...prev,
      error: null,
      verificationResult: null,
    }));
    setManualOverrideReason("");
    setComparisonPhotoPreview(null);
    setShowManualOverride(false); // Hide manual override on retry
  }, [
    caseId,
    sessionId,
    personType,
    verificationAttempts,
    previousDocumentKey,
    previousPersonPhotoKey,
  ]);

  const handleEndSession = useCallback(() => {
    const confirmEnd = window.confirm(
      "Are you sure you want to end this session? All verification data will be lost."
    );

    if (confirmEnd) {
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

      // Reset identity data
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

      console.log("Session ended by user");
    }
  }, [onIdentityDataChange, setCurrentPersonName]);

  const toggleDocumentType = useCallback(() => {
    setDocumentType((prevType) => (prevType === "cpr" ? "passport" : "cpr"));
  }, []);

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
    const canRetryResult =
      verificationAttempts < MAX_VERIFICATION_ATTEMPTS &&
      !identityData.isVerified;
    console.log("canRetry calculation:", {
      verificationAttempts,
      MAX_VERIFICATION_ATTEMPTS,
      isVerified: identityData.isVerified,
      canRetry: canRetryResult,
      showManualOverride,
    });
    return canRetryResult;
  }, [verificationAttempts, identityData.isVerified, showManualOverride]);

  const attemptsRemaining = useMemo(() => {
    return Math.max(0, MAX_VERIFICATION_ATTEMPTS - verificationAttempts);
  }, [verificationAttempts]);

  React.useEffect(() => {
    console.log("State Update:", {
      verificationAttempts,
      showManualOverride,
      canRetry,
      attemptsRemaining,
      hasVerificationResult: !!verificationState.verificationResult,
      isMatch: verificationState.verificationResult?.match,
    });
  }, [
    verificationAttempts,
    showManualOverride,
    canRetry,
    attemptsRemaining,
    verificationState.verificationResult,
  ]);

  return (
    <div className="identity-verification-container">
      <div className="session-card">
        <h2 className="card-title">Identity Verification</h2>

        {/* Verification Attempts Counter */}
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
                disabled={
                  verificationState.isVerifying || identityData.isVerified
                }
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

          {/* Verification Result Display OR Manual Override After Max Attempts */}
          {(verificationState.verificationResult ||
            (showManualOverride &&
              verificationAttempts >= MAX_VERIFICATION_ATTEMPTS)) && (
            <div className="verification-result-container">
              {verificationState.verificationResult && (
                <>
                  <h3 className="result-title">Verification Results</h3>

                  {/* Image Comparison */}
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
                            onError={(e) => {
                              console.error(
                                "Failed to load reference photo" + e
                              );
                              setComparisonPhotoPreview(null);
                            }}
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

                  {/* Results Text Area */}
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

              {/* Action Buttons for Failed Verification or Max Attempts Reached */}
              {((!verificationState.verificationResult?.match &&
                verificationState.verificationResult &&
                !verificationState.verificationResult.manualOverride) ||
                (showManualOverride &&
                  verificationAttempts >= MAX_VERIFICATION_ATTEMPTS)) && (
                <div className="verification-actions">
                  {/* Show Retry button only if attempts remaining */}
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

                  {/* Show Manual Override section after 3 attempts */}
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
                        {/* Option 1: Accept with Manual Entry */}
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
                              placeholder="Enter detailed reason for manual approval (e.g., 'Photo quality issues due to lighting but identity confirmed through additional documentation', 'Technical difficulties with facial recognition but documents are authentic and verified manually')..."
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
                                <Loader2 size={18} className="spinner-icon" />
                                Processing Manual Approval...
                              </>
                            ) : (
                              <>
                                <CheckCircle size={18} />
                                Accept and Proceed to Investigation
                              </>
                            )}
                          </button>
                        </div>

                        {/* Option 2: End Session */}
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
                            onClick={handleEndSession}
                            className="btn-end-session"
                            type="button"
                            disabled={verificationState.isVerifying}
                          >
                            <XCircle size={18} />
                            End Session and Start Over
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Verification Button */}
          {!identityData.isVerified && (
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
              ) : verificationAttempts >= MAX_VERIFICATION_ATTEMPTS ? (
                <>
                  <AlertCircle size={18} />
                  Maximum Attempts Reached
                </>
              ) : (
                <>
                  Complete Identity Verification
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          )}

          {/* Start Investigation Button */}
          {identityData.isVerified && (
            <button
              onClick={onStartInvestigation}
              className="btn-primary"
              type="button"
            >
              Proceed to Investigation
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentVerification;
