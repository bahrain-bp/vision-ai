import React, { useRef } from "react";
import { CheckCircle } from "lucide-react";

interface PersonPhotoUploadProps {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  referencePhoto: File | null;
  isVerifying: boolean;
  isVerified: boolean;
  fileInputKey: number;
  t: (key: string) => string;
}

const PersonPhotoUpload: React.FC<PersonPhotoUploadProps> = ({
  onFileUpload,
  referencePhoto,
  isVerifying,
  isVerified,
  fileInputKey,
  t,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="verification-section">
      <label className="form-label">{t("identity.referencePhoto")}</label>
      <p className="form-description">{t("identity.uploadPhoto")}</p>

      <div
        className="file-upload-area"
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            fileInputRef.current?.click();
          }
        }}
      >
        <input
          type="file"
          key={fileInputKey}
          ref={fileInputRef}
          onChange={onFileUpload}
          accept=".jpg,.jpeg,.png"
          className="hidden"
          disabled={isVerifying || isVerified}
          aria-label="Upload person photo"
        />

        <div className="upload-icon">📁</div>
        <p className="upload-text">{t("identity.uploadPhotoDescription")}</p>

        <button
          className="upload-button"
          disabled={isVerifying || isVerified}
          type="button"
        >
          {t("identity.uploadPhotoBtn")}
        </button>
        <p className="file-types">JPG, PNG (Max 10MB)</p>

        {referencePhoto && (
          <div className="upload-success">
            <CheckCircle size={16} />
            <span>
              {referencePhoto.name} {t("identity.uploadSuccess")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonPhotoUpload;
