import React from "react";
import { AlertCircle, CheckCircle } from "lucide-react";

interface NotificationBannersProps {
  error: string | null;
  verificationResult: {
    match: boolean;
    manualOverride?: boolean;
  } | null;
  t: (key: string) => string;
}

const NotificationBanners: React.FC<NotificationBannersProps> = ({
  error,
  verificationResult,
  t,
}) => {
  return (
    <>
      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Success Banner */}
      {verificationResult?.match && (
        <div className="success-banner">
          <CheckCircle size={20} />
          <span>
            {t("identity.successAttempt")}
            {verificationResult.manualOverride && " (Manual Override)"}
          </span>
        </div>
      )}
    </>
  );
};

export default NotificationBanners;
