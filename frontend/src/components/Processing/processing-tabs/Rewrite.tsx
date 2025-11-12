import React, { useState } from "react";
import { Sparkles, Lock } from "lucide-react";
import "./Rewrite.css";

interface SessionData {
  sessionId: string;
}

interface RewriteProps {
  sessionData: SessionData;
}

const Rewrite: React.FC<RewriteProps> = ({ sessionData }) => {
  const [rewrittenText, setRewrittenText] = useState("");

  const handleRewrite = () => {
    console.log("Rewrite clicked for session:", sessionData.sessionId);
  };

  return (
    <div className="rewrite-container">
      <div className="rewrite-card">
        <div className="rewrite-header-row">
          <div className="rewrite-icon-circle">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="rewrite-heading">Rewrite</h2>
            <p className="rewrite-subheading">
              Rewrite and improve investigation reports
            </p>
          </div>
        </div>

        <div className="rewrite-body">
          <label className="rewrite-section-label">Rewritten Report</label>
          <div className="rewrite-textarea-wrapper">
            <textarea
              className="rewrite-textarea-single"
              placeholder="Rewritten report will appear here..."
              value={rewrittenText}
              onChange={(e) => setRewrittenText(e.target.value)}
            />
          </div>
        </div>

        <button
          type="button"
          className="rewrite-primary-btn"
          onClick={handleRewrite}
        >
          <Lock size={16} className="rewrite-btn-icon" />
          <span>Rewrite Report</span>
        </button>
      </div>
    </div>
  );
};

export default Rewrite;