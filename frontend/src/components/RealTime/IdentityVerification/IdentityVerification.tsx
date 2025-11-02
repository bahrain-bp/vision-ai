import React, { useState } from "react";
import WitnessInfo from "./WitnessInfo";
import DocumentVerification from "./DocumentVerification";

interface WitnessData {
  fullName: string;
  idNumber: string;
}

interface IdentityData {
  referencePhoto: File | null;
  cpr: File | null;
  passport: File | null;
  isVerified: boolean;
}

interface VerificationData {
  witnessData: WitnessData;
  identityData: IdentityData;
}

interface InvestigationData {
  witness: string;
  idNumber: string;
  identityData: IdentityData;
  investigator: string;
  duration: string;
  status: string;
}

interface IdentityVerificationProps {
  onBackToDashboard: () => void;
  onStartInvestigation: (data: InvestigationData) => void;
}

const IdentityVerification: React.FC<IdentityVerificationProps> = ({
  onStartInvestigation,
}) => {
  const [verificationData, setVerificationData] = useState<VerificationData>({
    witnessData: {
      fullName: "",
      idNumber: "",
    },
    identityData: {
      referencePhoto: null,
      cpr: null,
      passport: null,
      isVerified: false,
    },
  });

  const updateWitnessData = (field: keyof WitnessData, value: string) => {
    setVerificationData((prev) => ({
      ...prev,
      witnessData: {
        ...prev.witnessData,
        [field]: value,
      },
    }));
  };

  const updateIdentityData = (field: keyof IdentityData, value: any) => {
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

    if (
      !verificationData.identityData.cpr &&
      !verificationData.identityData.passport
    ) {
      alert("Please upload either a CPR or Passport document.");
      return;
    }

    const investigationData: InvestigationData = {
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