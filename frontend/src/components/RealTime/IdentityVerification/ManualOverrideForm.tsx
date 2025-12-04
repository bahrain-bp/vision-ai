import React from "react";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";

interface ManualOverrideFormProps {
  manualParticipantName: string;
  setManualParticipantName: (value: string) => void;
  manualParticipantCPR: string;
  setManualParticipantCPR: (value: string) => void;
  manualParticipantNationality: string;
  setManualParticipantNationality: (value: string) => void;
  manualOverrideReason: string;
  setManualOverrideReason: (value: string) => void;
  isVerifying: boolean;
  onManualOverride: () => void;
  onEndSessionClick: () => void;
  hasVerificationResult: boolean;
  t: (key: string) => string;
}

const ManualOverrideForm: React.FC<ManualOverrideFormProps> = ({
  manualParticipantName,
  setManualParticipantName,
  manualParticipantCPR,
  setManualParticipantCPR,
  manualParticipantNationality,
  setManualParticipantNationality,
  manualOverrideReason,
  setManualOverrideReason,
  isVerifying,
  onManualOverride,
  onEndSessionClick,
  hasVerificationResult,
  t,
}) => {
  return (
    <div className="manual-override-section">
      <div className="override-warning-box">
        <AlertCircle size={20} className="warning-icon" />
        <div className="warning-content">
          <p className="warning-title">{t("identity.overrideWarning")}</p>
          <p className="warning-description">
            {hasVerificationResult
              ? t("identity.overrideWarningDescription")
              : t("identity.verificationError")}
          </p>
        </div>
      </div>

      <div className="override-options-container">
        <div className="override-option-card option-accept">
          <h4 className="option-title">
            <CheckCircle size={18} />
            {t("identity.optionOne")}
          </h4>
          <p className="option-description">
            {t("identity.optionOneDescription")}
          </p>

          <div className="form-field">
            <label className="field-label">
              {t("sessionInfo.participantName")} *
            </label>
            <input
              type="text"
              value={manualParticipantName}
              onChange={(e) => setManualParticipantName(e.target.value)}
              placeholder={t("identity.enterFullName")}
              className="field-input"
              disabled={isVerifying}
            />
          </div>

          <div className="form-field">
            <label className="field-label">{t("identity.cpr")} *</label>
            <input
              type="text"
              value={manualParticipantCPR}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 9);
                setManualParticipantCPR(value);
              }}
              placeholder={t("identity.enterCPR")}
              maxLength={9}
              className="field-input"
              disabled={isVerifying}
            />
            <p className="field-hint">{t("identity.digitsOnly")}</p>
          </div>

          <div className="form-field">
            <label className="field-label">{t("identity.nationality")} *</label>
            <input
              type="text"
              value={manualParticipantNationality}
              onChange={(e) => setManualParticipantNationality(e.target.value)}
              placeholder={t("identity.enterNationality")}
              className="field-input"
              disabled={isVerifying}
            />
          </div>

          <div className="form-field">
            <label className="field-label">
              {t("identity.reasonForManualOverride")}
            </label>
            <textarea
              value={manualOverrideReason}
              onChange={(e) => setManualOverrideReason(e.target.value)}
              placeholder={t("identity.enterReason")}
              className="field-textarea"
              rows={4}
              disabled={isVerifying}
            />
          </div>

          <button
            onClick={onManualOverride}
            className="btn-accept-override"
            type="button"
            disabled={
              !manualOverrideReason.trim() ||
              !manualParticipantName.trim() ||
              !manualParticipantCPR.trim() ||
              !manualParticipantNationality.trim() ||
              isVerifying
            }
          >
            {isVerifying ? (
              <>
                <Loader2 size={18} className="spinner-icon" />
                {t("identity.processingManualApproval")}
              </>
            ) : (
              <>
                <CheckCircle size={18} /> {t("identity.acceptAndProceed")}
              </>
            )}
          </button>
        </div>

        <div className="override-option-card option-end">
          <h4 className="option-title">
            <XCircle size={18} />
            {t("identity.opetionTwo")}
          </h4>
          <p className="option-description">
            {t("identity.optionTwoDescription")}
          </p>

          <button
            onClick={onEndSessionClick}
            className="btn-end-session"
            type="button"
            disabled={isVerifying}
          >
            <XCircle size={18} /> {t("identity.endSession")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualOverrideForm;
