import React from "react";

const WitnessInfo = ({ witnessData, onWitnessDataChange }) => {
  return (
    <div className="session-card">
      <h2 className="card-title">Witness Information</h2>

      <div className="space-y-4">
        <div className="form-group">
          <label className="form-label">Full Name *</label>
          <input
            type="text"
            value={witnessData.fullName}
            onChange={(e) => onWitnessDataChange("fullName", e.target.value)}
            placeholder="Enter witness full name"
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">ID Number (Optional)</label>
          <input
            type="text"
            value={witnessData.idNumber}
            onChange={(e) => onWitnessDataChange("idNumber", e.target.value)}
            placeholder="e.g., BH-12345678"
            className="form-input"
          />
        </div>
      </div>
    </div>
  );
};

export default WitnessInfo;