import React, { useState, useCallback, useMemo } from "react";
import { useCaseContext } from "../../../hooks/useCaseContext";
import ConfirmationPopup from "./ConfirmationPopup";
import { useLanguage } from "../../../context/LanguageContext";
import AttemptsCounter from "./AttemptsCounter";
import NotificationBanners from "./NotificationBanners";
import PersonPhotoUpload from "./PersonPhotoUpload";
import DocumentUploadSection from "./DocumentUploadSection";
import ImageComparisonGrid from "./ImageComparisonGrid";
import VerificationResultDetails from "./VerificationResultDetails";
import ManualOverrideForm from "./ManualOverrideForm";
import VerificationActions from "./VerificationActions";
import {
  DocumentVerificationProps,
  VerificationState,
} from "../../../types/identityVerification";
import IdentityVerificationService from "../../../services/IdentityVerification/IdentityVerificationService";

const MAX_VERIFICATION_ATTEMPTS = 3;

const validateManualOverrideInput = (
  name: string,
  cpr: string,
  nationality: string
): { valid: boolean; error?: string } => {
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

  if (!/^\d{9}$/.test(cpr.trim())) {
    return { valid: false, error: "CPR must be exactly 9 digits" };
  }

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
  documentType,
  setDocumentType,
}) => {
  const { t } = useLanguage();
  const { setCurrentPersonName, setCurrentPersonType } = useCaseContext();
  const [fileInputKey, setFileInputKey] = useState<number>(0);
  const [documentInputKey, setDocumentInputKey] = useState<number>(0);

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
    return documentType === "cpr" ? t("identity.cpr") : t("identity.passport");
  }, [documentType, t]);

  const currentDocument = useMemo(() => {
    return identityData[documentType];
  }, [identityData, documentType]);

  const validateFileSelection = useCallback(
    (file: File, field: keyof typeof identityData): boolean => {
      if (!file) return false;

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
      verificationResult: null,
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
        // Set appropriate error message based on confidence level
        let errorMessage = `Verification failed after ${MAX_VERIFICATION_ATTEMPTS} attempts. Please choose an option below.`;

        if (result.confidence === "MEDIUM") {
          errorMessage = `Face match confidence is too low (${result.similarity}%). The photos may be of the same person but image quality is insufficient. Please upload clearer, well-lit photos and try again.`;
        }

        if (currentAttempt >= MAX_VERIFICATION_ATTEMPTS) {
          console.log(
            "Maximum attempts reached, showing manual override options"
          );
          setShowManualOverride(true);
          setPreviousDocumentKey(null);
          setPreviousPersonPhotoKey(null);
          setVerificationState((prev) => ({
            ...prev,
            error: errorMessage,
          }));
        } else {
          // Show the confidence error even before max attempts
          setVerificationState((prev) => ({
            ...prev,
            error: errorMessage,
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
    setCurrentPersonType,
    documentType,
  ]);

  const handleManualOverride = useCallback(async () => {
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

      if (!documentKey || !personPhotoKey) {
        console.log(
          "No previous upload keys found, uploading files for manual override..."
        );

        try {
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
    setCurrentPersonType,
  ]);

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
    window.location.href = "/";
  }, [onIdentityDataChange]);

  const handleEndSessionCancel = useCallback(() => {
    setShowEndSessionPopup(false);
  }, []);

  const toggleDocumentType = useCallback(() => {
    const newDocumentType = documentType === "cpr" ? "passport" : "cpr";

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
    setDocumentType,
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
        <AttemptsCounter
          verificationAttempts={verificationAttempts}
          maxAttempts={MAX_VERIFICATION_ATTEMPTS}
          attemptsRemaining={attemptsRemaining}
          t={t}
        />

        <NotificationBanners
          error={verificationState.error}
          verificationResult={verificationState.verificationResult}
          t={t}
        />

        <div className="space-y-8">
          {!showManualOverride && (
            <>
              <PersonPhotoUpload
                onFileUpload={handleFileUpload}
                referencePhoto={identityData.referencePhoto}
                isVerifying={verificationState.isVerifying}
                isVerified={identityData.isVerified}
                fileInputKey={fileInputKey}
                t={t}
              />

              <DocumentUploadSection
                documentType={documentType}
                documentDisplayName={documentDisplayName}
                currentDocument={currentDocument}
                onDocumentUpload={handleDocumentUpload}
                onToggleDocumentType={toggleDocumentType}
                isVerifying={verificationState.isVerifying}
                isVerified={identityData.isVerified}
                documentInputKey={documentInputKey}
                t={t}
              />
            </>
          )}

          {(verificationState.verificationResult ||
            (showManualOverride &&
              verificationAttempts >= MAX_VERIFICATION_ATTEMPTS)) && (
            <div className="verification-result-container">
              {verificationState.verificationResult && (
                <>
                  <h3 className="result-title">
                    {t("identity.VerificationResults")}
                  </h3>

                  <ImageComparisonGrid
                    uploadedPhotoPreview={uploadedPhotoPreview}
                    comparisonPhotoPreview={comparisonPhotoPreview}
                    photoSource={
                      verificationState.verificationResult.photoSource
                    }
                    loadingReferencePhoto={loadingReferencePhoto}
                    onImageError={() => setComparisonPhotoPreview(null)}
                    t={t}
                  />

                  <VerificationResultDetails
                    verificationResult={verificationState.verificationResult}
                    t={t}
                  />
                </>
              )}

              {((!verificationState.verificationResult?.match &&
                verificationState.verificationResult &&
                !verificationState.verificationResult.manualOverride) ||
                (showManualOverride &&
                  verificationAttempts >= MAX_VERIFICATION_ATTEMPTS)) && (
                <div className="verification-actions">
                  {showManualOverride && (
                    <ManualOverrideForm
                      manualParticipantName={manualParticipantName}
                      setManualParticipantName={setManualParticipantName}
                      manualParticipantCPR={manualParticipantCPR}
                      setManualParticipantCPR={setManualParticipantCPR}
                      manualParticipantNationality={
                        manualParticipantNationality
                      }
                      setManualParticipantNationality={
                        setManualParticipantNationality
                      }
                      manualOverrideReason={manualOverrideReason}
                      setManualOverrideReason={setManualOverrideReason}
                      isVerifying={verificationState.isVerifying}
                      onManualOverride={handleManualOverride}
                      onEndSessionClick={handleEndSessionClick}
                      hasVerificationResult={
                        !!verificationState.verificationResult
                      }
                      t={t}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          <VerificationActions
            isVerified={identityData.isVerified}
            isVerifying={verificationState.isVerifying}
            verificationAttempts={verificationAttempts}
            maxAttempts={MAX_VERIFICATION_ATTEMPTS}
            attemptsRemaining={attemptsRemaining}
            isVerificationDisabled={isVerificationDisabled}
            canRetry={canRetry}
            onCompleteVerification={handleCompleteVerification}
            onRetryVerification={handleRetryVerification}
            onStartInvestigation={onStartInvestigation}
            t={t}
          />
        </div>
      </div>

      <ConfirmationPopup
        isOpen={showEndSessionPopup}
        onClose={handleEndSessionCancel}
        onConfirm={handleEndSessionConfirm}
        title={t("popup.title")}
        message={t("popup.message")}
        confirmText={t("popup.confirm")}
        cancelText={t("popup.cancel")}
        type="danger"
      />
    </div>
  );
};

export default DocumentVerification;
