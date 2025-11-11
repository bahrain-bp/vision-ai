import React, { useState, useEffect, useCallback } from "react";
import DocumentVerification from "./DocumentVerification";
import {
  IdentityVerificationProps,
  IdentityData,
  InvestigationData,
  PersonType,
} from "../../../types/identityVerification";
import IdentityVerificationService from "../../../services/IdentityVerification/IdentityVerificationService";

const IdentityVerification: React.FC<IdentityVerificationProps> = ({
  onStartInvestigation,
}) => {
  const [caseId, setCaseId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [personType] = useState<PersonType>("witness");

  const [identityData, setIdentityData] = useState<IdentityData>({
    referencePhoto: null,
    cpr: null,
    passport: null,
    isVerified: false,
  });

  // Generate case ID and session ID on mount
  useEffect(() => {
    const newCaseId = IdentityVerificationService.generateCaseId();
    const newSessionId = IdentityVerificationService.generateSessionId();

    setCaseId(newCaseId);
    setSessionId(newSessionId);

    console.log("Identity Verification initialized:", {
      caseId: newCaseId,
      sessionId: newSessionId,
      personType,
    });
  }, [personType]);

  const updateIdentityData = useCallback(
    (field: keyof IdentityData, value: File | boolean | null) => {
      setIdentityData((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const handleStartInvestigation = useCallback(
    (extractedPersonName?: string) => {
      if (!identityData.isVerified) {
        alert("Please complete identity verification first.");
        return;
      }

      const investigationData: InvestigationData = {
        witness: extractedPersonName || "Name to be extracted", // Will be extracted from documents
        idNumber: "To be extracted", // Will be extracted from documents
        identityData: identityData,
        investigator: "M. AlZebari",
        duration: "00:00",
        status: "Ready",
        caseId,
        sessionId,
      };

      console.log("Starting investigation with data:", investigationData);
      onStartInvestigation(investigationData);
    },
    [caseId, sessionId, identityData, onStartInvestigation]
  );

  return (
    <div className="identity-verification-container">
      <div className="identity-verification-content">
        <div className="verification-header">
          <h1 className="verification-title">Identity Verification</h1>
          <div className="session-info">
            <p className="session-detail">
              <strong>Case ID:</strong> {caseId}
            </p>
            <p className="session-detail">
              <strong>Session ID:</strong> {sessionId}
            </p>
            <p className="session-detail">
              <strong>Person Type:</strong> {personType.toUpperCase()}
            </p>
          </div>
        </div>

        <DocumentVerification
          identityData={identityData}
          onIdentityDataChange={updateIdentityData}
          onStartInvestigation={() => handleStartInvestigation()}
          caseId={caseId}
          sessionId={sessionId}
          personType={personType}
        />
      </div>
    </div>
  );
};

export default IdentityVerification;
