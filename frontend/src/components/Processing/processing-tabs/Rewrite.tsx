import React, { useState } from "react";
import MarkdownPreview from "./MarkdownPreview";
import { Sparkles, Lock, AlertCircle, FileText } from "lucide-react";
import "./Rewrite.css";

interface SessionData {
  sessionId: string;
}

interface RewriteProps {
  sessionData: SessionData;
}

const Rewrite: React.FC<RewriteProps> = ({ sessionData }) => {
  const [rewrittenText, setRewrittenText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [s3Key, setS3Key] = useState("");

  const handleRewrite = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get API endpoint from environment or construct from window location
      const apiEndpoint =
        process.env.REACT_APP_API_ENDPOINT ||
        `${window.location.origin.replace("localhost", "localhost").split(":")[0]}://${window.location.hostname}:3000`;

      // For now, use mock S3 key - later will be extractedText key from Classification
      const requestBody = {
        sessionId: sessionData.sessionId,
        s3Key: "rewritten/report.txt",
      };

      const response = await fetch(`${apiEndpoint}/rewrite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `API error: ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.status === "success") {
        if (data.rewrittenText && data.rewrittenText.trim().length > 0) {
          setRewrittenText(data.rewrittenText);
        } else {
          // success but empty payload
          const msg = data.message || "No rewritten text returned from the server.";
          setError(msg);
        }
      } else {
        throw new Error(data.message || "Unknown error from API");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to rewrite report";
      setError(errorMessage);
      console.error("Rewrite error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRewriteFromS3 = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiEndpoint =
        process.env.REACT_APP_API_ENDPOINT ||
        `${window.location.origin.replace("localhost", "localhost").split(":")[0]}://${window.location.hostname}:3000`;

      const requestBody = {
        sessionId: "ui-file-request",
        s3Key: s3Key,
      };

      const response = await fetch(`${apiEndpoint}/rewrite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `API error: ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.status === "success") {
        if (data.rewrittenText && data.rewrittenText.trim().length > 0) {
          setRewrittenText(data.rewrittenText);
        } else {
          const msg = data.message || "No rewritten text returned from the server.";
          setError(msg);
        }
      } else {
        throw new Error(data.message || "Unknown error from API");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to rewrite report";
      setError(errorMessage);
      console.error("Rewrite error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rewrite-container">
      <div className="rewrite-card">
        <div className="rewrite-header-row">
          <div className="rewrite-icon-circle">
            <Sparkles size={28} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="rewrite-heading">Rewrite</h2>
            <p className="rewrite-subheading">
              Rewrite and improve investigation reports
            </p>
          </div>
        </div>

        {error && (
          <div className="rewrite-error-message">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div className="rewrite-body">
          <label className="rewrite-section-label">Rewritten Report</label>
          {/* Preview formatted Markdown output */}
          <MarkdownPreview markdown={rewrittenText} />
          <div className="rewrite-textarea-wrapper">
            <textarea
              className="rewrite-textarea-single"
              placeholder="Rewritten report will appear here..."
              value={rewrittenText}
              onChange={(e) => setRewrittenText(e.target.value)}
              dir="rtl"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              style={{
                fontWeight: 400,
                fontFamily: 'Segoe UI, Noto Sans Arabic, Tahoma, Arial, sans-serif',
                background: "transparent",
                border: "none",
                boxShadow: "none",
                letterSpacing: 0.01,
                fontSize: 17,
                color: '#23272f'
              }}
            />
          </div>
        </div>

        <button
          type="button"
          className={`rewrite-primary-btn ${loading ? "loading" : ""}`}
          onClick={handleRewrite}
          disabled={loading}
        >
          <Lock size={18} className="rewrite-btn-icon" />
          <span>{loading ? "Rewriting..." : "Rewrite Report"}</span>
        </button>

        <div className="rewrite-s3-section" style={{marginTop: 32}}>
          <div style={{
            background: '#f3f4f6',
            borderRadius: 14,
            padding: '18px 18px 14px 18px',
            boxShadow: '0 1.5px 8px rgba(60,40,120,0.06)',
            border: '1.5px solid #e0e7ef',
            maxWidth: 480,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 10
          }}>
            <label className="rewrite-section-label" style={{marginBottom: 6}}>Rewrite from S3 File</label>
            <input
              type="text"
              className="rewrite-input"
              placeholder="e.g. rewritten/report.txt"
              value={s3Key}
              onChange={(e) => setS3Key(e.target.value)}
              style={{ fontSize: 15, borderRadius: 8, border: '1px solid #e5e7eb', padding: '12px 14px', width: '100%', marginBottom: 8, direction: 'ltr', textAlign: 'left', background: '#fff' }}
            />
            <button
              type="button"
              className={`rewrite-primary-btn ${loading ? "loading" : ""}`}
              onClick={handleRewriteFromS3}
              disabled={loading || !s3Key}
              style={{marginTop: 2}}
            >
              <FileText size={17} className="rewrite-btn-icon" />
              <span>{loading ? "Rewriting..." : "Rewrite from S3 File"}</span>
            </button>
            <div style={{fontSize: '13px', color: '#64748b', marginTop: 6, textAlign: 'left', opacity: 0.85}}>
              Enter the S3 file path (Key) to rewrite a previously saved report.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Rewrite;