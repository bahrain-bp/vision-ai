import React from "react";

interface AttemptsCounterProps {
  verificationAttempts: number;
  maxAttempts: number;
  attemptsRemaining: number;
  t: (key: string) => string;
}

const AttemptsCounter: React.FC<AttemptsCounterProps> = ({
  verificationAttempts,
  maxAttempts,
  attemptsRemaining,
  t,
}) => {
  if (verificationAttempts === 0) return null;

  return (
    <div className="verification-attempts">
      <span className="attempts-label">
        {t("identity.verificationAttempts")}
      </span>
      <span
        className={`attempts-count ${
          verificationAttempts >= maxAttempts ? "text-red-600 font-bold" : ""
        }`}
      >
        {verificationAttempts} / {maxAttempts}
      </span>
      {attemptsRemaining > 0 && (
        <span className="attempts-remaining text-sm text-gray-600 ml-2">
          ({attemptsRemaining} {t("identity.remainingAttempts")})
        </span>
      )}
      {verificationAttempts >= maxAttempts && (
        <span className="text-sm text-red-600 ml-2 font-semibold">
          {t("identity.maximumAttempts")}
        </span>
      )}
    </div>
  );
};

export default AttemptsCounter;
