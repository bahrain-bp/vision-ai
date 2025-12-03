import React, { useState, useCallback } from "react";
import DocumentVerification from "./DocumentVerification";
import { useLanguage } from "../../../context/LanguageContext";

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
  const { t } = useLanguage();
  const { currentCase, currentSession } = useCaseContext();
  const [personType, setPersonType] = useState<PersonType>("witness");
  const [documentType, setDocumentType] = useState<"cpr" | "passport">("cpr");
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
          <h1 className="verification-title">{t("identity.title")}</h1>
          <div className="session-info-grid">
            <div className="session-info-card">
              <div className="session-info-content">
                <span className="session-label">
                  {t("identity.personType")}
                </span>
                <select
                  value={personType}
                  onChange={(e) => setPersonType(e.target.value as PersonType)}
                  className="person-type-select"
                  disabled={identityData.isVerified}
                >
                  <option value="witness">{t("identity.witness")}</option>
                  <option value="accused">{t("identity.accused")}</option>
                  <option value="victim">{t("identity.victim")}</option>
                </select>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: "0.9rem", color: "#555" }}>
            {/* Disclaimer when Passport is selected */}
            {documentType === "passport" && (
              <div>{t("identity.passportWarning")}</div>
            )}
          </div>
        </div>

        <DocumentVerification
          identityData={identityData}
          onIdentityDataChange={updateIdentityData}
          onStartInvestigation={() => handleStartInvestigation()}
          caseId={currentCase?.caseId || ""}
          sessionId={currentSession?.sessionId || ""}
          personType={personType}
          documentType={documentType}
          setDocumentType={setDocumentType}
        />
      </div>
    </div>
  );
};

export default IdentityVerification;
