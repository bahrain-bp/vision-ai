import React from "react";
import { Folder, Plus } from "lucide-react";
import { Case } from "../../services/caseService";
import CaseCard from "./CaseCard";
import Pagination from "./Pagination";

interface CasesGridProps {
  cases: Case[];
  currentCase: Case | null;
  isLoading: boolean;
  searchTerm: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onActivateCase: (caseId: string) => void;
  onDeactivateCase: (caseId: string) => void;
  onStartSession: (caseId: string) => void;
  onCreateCase: () => void;
}

const CasesGrid: React.FC<CasesGridProps> = ({
  cases,
  currentCase,
  isLoading,
  searchTerm,
  currentPage,
  totalPages,
  onPageChange,
  onActivateCase,
  onDeactivateCase,
  onStartSession,
  onCreateCase,
}) => {
  if (isLoading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p className="loading-text">Loading cases...</p>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="empty-state">
        <Folder size={48} className="empty-icon" />
        <h3 className="empty-title">
          {searchTerm ? "No cases found" : "No cases yet"}
        </h3>
        <p className="empty-description">
          {searchTerm
            ? "Try adjusting your search terms"
            : "Create your first case to get started"}
        </p>
        {!searchTerm && (
          <button onClick={onCreateCase} className="new-case-btn">
            <Plus size={20} />
            <span>Create Case</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="cases-grid">
        {cases.map((caseItem) => (
          <CaseCard
            key={caseItem.caseId}
            caseItem={caseItem}
            isSelected={currentCase?.caseId === caseItem.caseId}
            onActivate={onActivateCase}
            onDeactivate={onDeactivateCase}
            onStartSession={onStartSession}
            isLoading={isLoading}
          />
        ))}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </>
  );
};

export default CasesGrid;
