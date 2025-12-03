import React from "react";
import { Folder, User, Clock, Plus } from "lucide-react";
import { Case } from "../../services/caseService";

interface CaseCardProps {
  caseItem: Case;
  isSelected: boolean;
  onActivate: (caseId: string) => void;
  onDeactivate: (caseId: string) => void;
  onStartSession: (caseId: string) => void;
  isLoading: boolean;
  t: (key: string) => string;
}

const CaseCard: React.FC<CaseCardProps> = ({
  caseItem,
  isSelected,
  onActivate,
  onDeactivate,
  onStartSession,
  isLoading,
  t,
}) => {
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className={`case-card ${isSelected ? "selected" : ""}`}>
      <div className="case-card-header">
        <Folder size={20} className="case-folder-icon" />
        <span className={`case-status ${caseItem.status}`}>
          {t(`home.${caseItem.status}`)}
        </span>
      </div>

      <h3 className="case-title">{caseItem.caseTitle}</h3>
      <p className="case-description">{caseItem.caseDescription}</p>

      <div className="case-meta">
        <div className="case-meta-item">
          <User size={14} />
          <span>{caseItem.createdBy}</span>
        </div>
        <div className="case-meta-item">
          <Clock size={14} />
          <span>{formatDate(caseItem.createdAt)}</span>
        </div>
      </div>

      <div className="case-footer">
        <span className="case-id">{caseItem.caseId}</span>
      </div>

      <div className="case-status-actions">
        {caseItem.status === "active" ? (
          <button
            onClick={() => onDeactivate(caseItem.caseId)}
            className="deactivate-case-btn"
            disabled={isLoading}
          >
            {t("home.deactivateCase")}
          </button>
        ) : (
          <button
            onClick={() => onActivate(caseItem.caseId)}
            className="activate-case-btn"
            disabled={isLoading}
          >
            {t("home.activateCase")}
          </button>
        )}
      </div>

      <div className="case-card-actions">
        {caseItem.status === "active" && (
          <button
            onClick={() => onStartSession(caseItem.caseId)}
            className="start-session-card-btn"
          >
            <Plus size={16} />
            <span>{t("home.startNewSession")}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default CaseCard;
