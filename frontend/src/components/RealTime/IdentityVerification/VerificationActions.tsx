import React from "react";
import { Loader2, ArrowRight, AlertCircle } from "lucide-react";

interface VerificationActionsProps {
  isVerified: boolean;
  isVerifying: boolean;
  verificationAttempts: number;
  maxAttempts: number;
  attemptsRemaining: number;
  isVerificationDisabled: boolean;
  canRetry: boolean;
  onCompleteVerification: () => void;
  onRetryVerification: () => void;
  onStartInvestigation: () => void;
  t: (key: string) => string;
}

const VerificationActions: React.FC<VerificationActionsProps> = ({
  isVerified,
  isVerifying,
  verificationAttempts,
  maxAttempts,
  isVerificationDisabled,
  onCompleteVerification,
  onStartInvestigation,
  t,
}) => {
  return (
    <>
      {!isVerified && (
        <button
          onClick={onCompleteVerification}
          className="btn-success"
          disabled={isVerificationDisabled}
          type="button"
        >
          {isVerifying ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {t("identity.verifyingIdentity")}
            </>
          ) : verificationAttempts >= maxAttempts ? (
            <>
              <AlertCircle size={18} /> Maximum Attempts Reached
            </>
          ) : (
            <>{t("identity.completeVerification")}</>
          )}
        </button>
      )}

      {isVerified && (
        <button
          onClick={onStartInvestigation}
          className="btn-primary"
          type="button"
        >
          {t("identity.startInvestigation")} <ArrowRight size={18} />
        </button>
      )}
    </>
  );
};

export default VerificationActions;
