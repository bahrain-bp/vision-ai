import React, { useRef } from "react";
import { Upload, CheckCircle } from "lucide-react";

const IdentityVerification = ({
  identityData,
  onIdentityDataChange,
  onVerifyIdentity,
}) => {
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      onIdentityDataChange("referencePhoto", file);
    }
  };

  const handleVerifyClick = () => {
    if (identityData.referencePhoto) {
      onVerifyIdentity();
    } else {
      alert("Please upload a reference photo first.");
    }
  };

  return (
    <div className="session-card">
      <h2 className="card-title">Identity Verification</h2>

      <div className="space-y-4">
        <div>
          <label className="form-label">Reference Photo *</label>
          <p className="form-description">
            Upload official ID photo for real-time identity verification during
            the investigation
          </p>

          <div
            className="file-upload-area"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".jpg,.jpeg,.png"
              className="hidden"
            />

            <div className="upload-icon">📁</div>
            <p className="upload-text">
              Upload a reference photo and enter witness name to verify identity
            </p>

            <button className="upload-button">Upload Photo</button>
            <p className="file-types">JPG, PNG</p>

            {identityData.referencePhoto && (
              <div className="upload-success">
                <CheckCircle size={16} />
                <span>Photo uploaded successfully</span>
              </div>
            )}
          </div>
        </div>

        <button onClick={handleVerifyClick} className="btn-success">
          Verify Identity
        </button>
      </div>
    </div>
  );
};

export default IdentityVerification;