import React, { useState, useCallback } from "react";
import DocumentVerification from "./DocumentVerification";
import {
  IdentityVerificationProps,
  IdentityData,
  InvestigationData,
  PersonType,
} from "../../../types/identityVerification";
import { useCaseContext } from "../../../hooks/useCaseContext";

const IdentityVerification: React.FC<IdentityVerificationProps> = ({
  onStartInvestigation,
}) => {
  const { currentCase, currentSession } = useCaseContext();
  const [personType, setPersonType] = useState<PersonType>("witness");

  const [identityData, setIdentityData] = useState<IdentityData>({
    referencePhoto: null,
    cpr: null,
    passport: null,
    isVerified: false,
  });

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
        witness: extractedPersonName || "Name to be extracted",
        idNumber: "To be extracted",
        identityData: identityData,
        investigator: "M. AlZebari",
        duration: "00:00",
        status: "Ready",
        caseId: currentCase?.caseId || "",
        sessionId: currentSession?.sessionId || "",
      };

      console.log("Starting investigation with data:", investigationData);
      onStartInvestigation(investigationData);
    },
    [identityData, onStartInvestigation, currentCase, currentSession]
  );

  return (
    <div className="identity-verification-container">
      <div className="identity-verification-content">
        <div className="verification-header">
          <h1 className="verification-title">Identity Verification</h1>
          <div className="session-info-grid">
            <div className="session-info-card">
              <div className="session-info-content">
                <span className="session-label">Person Type</span>
                <select
                  value={personType}
                  onChange={(e) => setPersonType(e.target.value as PersonType)}
                  className="person-type-select"
                  disabled={identityData.isVerified}
                >
                  <option value="witness">Witness</option>
                  <option value="accused">Accused</option>
                  <option value="victim">Victim</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <DocumentVerification
          identityData={identityData}
          onIdentityDataChange={updateIdentityData}
          onStartInvestigation={() => handleStartInvestigation()}
          caseId={currentCase?.caseId || ""}
          sessionId={currentSession?.sessionId || ""}
          personType={personType}
        />
      </div>
    </div>
  );
};

export default IdentityVerification;
