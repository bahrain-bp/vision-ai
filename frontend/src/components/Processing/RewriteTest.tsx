import React from "react";
import Rewrite from "./processing-tabs/Rewrite";

const RewriteTest: React.FC = () => {
  const mockSessionData = {
    sessionId: "#2025-INV-1234",
  };

  return (
    <div style={{ padding: "20px", backgroundColor: "#f9fafb", minHeight: "100vh" }}>
      <Rewrite sessionData={mockSessionData} />
    </div>
  );
};

export default RewriteTest;
