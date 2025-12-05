import React from "react";

interface VerificationResult {
  personName: string;
  cprNumber: string;
  nationality: string;
  similarity: number;
  confidence: string;
  match: boolean;
  manualOverride?: boolean;
  overrideReason?: string;
}

interface VerificationResultDetailsProps {
  verificationResult: VerificationResult;
  t: (key: string) => string;
}

const VerificationResultDetails: React.FC<VerificationResultDetailsProps> = ({
  verificationResult,
  t,
}) => {
  return (
    <div className="result-details">
      <div className="result-row">
        <span className="result-label">
          {t("sessionInfo.participantName")}:
        </span>
        <span className="result-value">{verificationResult.personName}</span>
      </div>
      <div className="result-row">
        <span className="result-label">{t("identity.cprNumber")}:</span>
        <span className="result-value">{verificationResult.cprNumber}</span>
      </div>
      <div className="result-row">
        <span className="result-label">{t("identity.nationality")}:</span>
        <span className="result-value">{verificationResult.nationality}</span>
      </div>
      <div className="result-row">
        <span className="result-label">{t("identity.similarityScore")}:</span>
        <span className="result-value">{verificationResult.similarity}%</span>
      </div>
      <div className="result-row">
        <span className="result-label">{t("identity.confidence")}:</span>
        <span className="result-value">{verificationResult.confidence}</span>
      </div>
      <div className="result-row">
        <span className="result-label">{t("identity.status")}:</span>
        <span
          className={`result-value ${
            verificationResult.match ? "text-green-600" : "text-red-600"
          }`}
        >
          {verificationResult.match
            ? t("identity.verified")
            : t("identity.notVerified")}
        </span>
      </div>
      {verificationResult.manualOverride && (
        <div className="result-row">
          <span className="result-label">{t("identity.overrideReason")}:</span>
          <span className="result-value text-orange-600">
            {verificationResult.overrideReason}
          </span>
        </div>
      )}
    </div>
  );
};

export default VerificationResultDetails;
