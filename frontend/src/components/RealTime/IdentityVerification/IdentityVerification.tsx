import React, { useState, useEffect, useCallback } from "react";
import DocumentVerification from "./DocumentVerification";
import {
  IdentityVerificationProps,
  IdentityData,
  InvestigationData,
  PersonType,
} from "../../../types/identityVerification";
import IdentityVerificationService from "../../../services/IdentityVerification/IdentityVerificationService";
import { Copy, Check } from "lucide-react";

const IdentityVerification: React.FC<IdentityVerificationProps> = ({
  onStartInvestigation,
}) => {
  const [caseId, setCaseId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [personType, setPersonType] = useState<PersonType>("witness");
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
    });
  }, []);

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
        caseId,
        sessionId,
      };

      console.log("Starting investigation with data:", investigationData);
      onStartInvestigation(investigationData);
    },
    [caseId, sessionId, identityData, onStartInvestigation]
  );

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="identity-verification-container">
      <div className="identity-verification-content">
        <div className="verification-header">
          <h1 className="verification-title">Identity Verification</h1>
          <div className="session-info-grid">
            <div className="session-info-card">
              <div className="session-info-content">
                <span className="session-label">Case ID</span>
                <div className="session-value-container">
                  <span className="session-value">{caseId}</span>
                  <button
                    onClick={() => copyToClipboard(caseId, "caseId")}
                    className="copy-button"
                    title="Copy Case ID"
                  >
                    {copiedField === "caseId" ? (
                      <Check size={16} className="text-green-500" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="session-info-card">
              <div className="session-info-content">
                <span className="session-label">Session ID</span>
                <div className="session-value-container">
                  <span className="session-value">{sessionId}</span>
                  <button
                    onClick={() => copyToClipboard(sessionId, "sessionId")}
                    className="copy-button"
                    title="Copy Session ID"
                  >
                    {copiedField === "sessionId" ? (
                      <Check size={16} className="text-green-500" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>

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
          caseId={caseId}
          sessionId={sessionId}
          personType={personType}
        />
      </div>
    </div>
  );
};

export default IdentityVerification;
