import React, { useState } from "react";
import WitnessInfo from "./WitnessInfo";
import DocumentVerification from "./DocumentVerification";

const IdentityVerification = ({ onBackToDashboard, onStartInvestigation }) => {
  const [verificationData, setVerificationData] = useState({
    witnessData: {
      fullName: "",
      idNumber: "",
    },
    identityData: {
      referencePhoto: null,
      cpr: null,
      passport: null, // Make sure passport is in the initial state
      isVerified: false,
    },
  });

  const updateWitnessData = (field, value) => {
    setVerificationData((prev) => ({
      ...prev,
      witnessData: {
        ...prev.witnessData,
        [field]: value,
      },
    }));
  };

  const updateIdentityData = (field, value) => {
    setVerificationData((prev) => ({
      ...prev,
      identityData: {
        ...prev.identityData,
        [field]: value,
      },
    }));
  };

  const handleStartInvestigation = () => {
    if (!verificationData.witnessData.fullName) {
      alert("Please enter witness full name.");
      return;
    }

    if (!verificationData.identityData.referencePhoto) {
      alert("Please upload a person photo.");
      return;
    }

    // FIX: Check for either CPR OR Passport
    if (
      !verificationData.identityData.cpr &&
      !verificationData.identityData.passport
    ) {
      alert("Please upload either a CPR or Passport document.");
      return;
    }

    const investigationData = {
      witness: verificationData.witnessData.fullName,
      idNumber: verificationData.witnessData.idNumber,
      identityData: verificationData.identityData,
      investigator: "M. AlZebari",
      duration: "00:00",
      status: "Ready",
    };

    onStartInvestigation(investigationData);
  };

  return (
    <div className="identity-verification-container">
      <div className="identity-verification-content">
        <div className="verification-header">
          <h1 className="verification-title">Identity Verification</h1>
        </div>

        <WitnessInfo
          witnessData={verificationData.witnessData}
          onWitnessDataChange={updateWitnessData}
        />

        <DocumentVerification
          identityData={verificationData.identityData}
          onIdentityDataChange={updateIdentityData}
          onStartInvestigation={handleStartInvestigation}
        />
      </div>
    </div>
  );
};

export default IdentityVerification;
