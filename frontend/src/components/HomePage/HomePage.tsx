import React, { useState, useEffect } from "react";
import {
  LogOut,
  Plus,
  Folder,
  Clock,
  User,
  Search,
  AlertCircle,
} from "lucide-react";
import authService from "../../services/authService";
import { User as UserType } from "../../types/";
import { useCaseContext } from "../../hooks/useCaseContext";
import CreateCaseModal from "./CreateCaseModal";

interface HomePageProps {
  user: UserType | null;
  onSignOut: () => void;
  onStartSession: () => void;
}

const HomePage: React.FC<HomePageProps> = ({
  user,
  onSignOut,
  onStartSession,
}) => {
  const {
    allCases,
    currentCase,
    isLoading,
    error,
    loadAllCases,
    setCurrentCaseDirectly,
    createCase,
    clearContext,
    clearError,
    updateCaseStatus,
  } = useCaseContext();

  const [showCreateCaseModal, setShowCreateCaseModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const casesPerPage = 12;

  useEffect(() => {
    loadAllCases();
  }, [loadAllCases]);

  const handleSignOut = async (): Promise<void> => {
    try {
      clearContext();
      await authService.signOut();
      onSignOut();
    } catch (error: unknown) {
      console.error("Sign out error:", error);
      alert("Error signing out. Please try again.");
    }
  };

  const handleCreateCase = async (
    title: string,
    description: string
  ): Promise<void> => {
    try {
      await createCase(title, description, user?.username || "Unknown User");
      setShowCreateCaseModal(false);
    } catch (error) {
      console.error("Error creating case:", error);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredCases = allCases.filter(
    (caseItem) =>
      caseItem.caseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.caseId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredCases.length / casesPerPage);
  const indexOfLastCase = currentPage * casesPerPage;
  const indexOfFirstCase = indexOfLastCase - casesPerPage;
  const currentCases = filteredCases.slice(indexOfFirstCase, indexOfLastCase);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handleStartSessionInCase = async (caseId: string): Promise<void> => {
    try {
      console.log("Starting session for case:", caseId);

      const selectedCase = allCases.find(
        (caseItem) => caseItem.caseId === caseId
      );

      if (!selectedCase) {
        throw new Error(`Case ${caseId} not found in local state`);
      }
      setCurrentCaseDirectly(selectedCase);
      onStartSession();
    } catch (error) {
      console.error("Error starting session:", error);
      alert(
        `Failed to start session: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleActivateCase = async (caseId: string): Promise<void> => {
    try {
      await updateCaseStatus(caseId, "active");
      console.log(`Activated case: ${caseId}`);
    } catch (error) {
      console.error("Error activating case:", error);
      alert(
        `Failed to activate case: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleDeactivateCase = async (caseId: string): Promise<void> => {
    try {
      await updateCaseStatus(caseId, "inactive");
      console.log(`Deactivated case: ${caseId}`);
    } catch (error) {
      console.error("Error deactivating case:", error);
      alert(
        `Failed to deactivate case: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  return (
    <div className="homepage-container">
      <div className="homepage-content">
        {/* Header */}
        <div className="homepage-header">
          <div className="header-top">
            <div className="header-center">
              <div className="header-text">
                <h1>Vision AI Investigation System</h1>
                <p>Welcome back, {user?.username || "User"}!</p>
              </div>
            </div>
            <button onClick={handleSignOut} className="signout-btn">
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="error-alert">
            <div className="error-content">
              <AlertCircle className="error-icon" size={20} />
              <div>
                <h3 className="error-title">Error</h3>
                <p className="error-message">{error}</p>
              </div>
            </div>
            <button onClick={clearError} className="error-close">
              <span className="sr-only">Close</span>×
            </button>
          </div>
        )}

        {/* Actions Bar */}
        <div className="actions-bar">
          <div className="search-box">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Search cases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <button
            onClick={() => setShowCreateCaseModal(true)}
            disabled={isLoading}
            className="new-case-btn"
          >
            <Plus size={20} />
            <span>New Case</span>
          </button>
        </div>

        {/* Cases List */}
        <div className="cases-container">
          <div className="cases-header">
            <Folder size={24} className="cases-icon" />
            <h2 className="cases-title">Investigation Cases</h2>
            <span className="cases-count">{filteredCases.length} cases</span>
          </div>

          {isLoading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p className="loading-text">Loading cases...</p>
            </div>
          ) : filteredCases.length === 0 ? (
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
                <button
                  onClick={() => setShowCreateCaseModal(true)}
                  className="new-case-btn"
                >
                  <Plus size={20} />
                  <span>Create Case</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="cases-grid">
                {currentCases.map((caseItem) => (
                  <div
                    key={caseItem.caseId}
                    className={`case-card ${
                      currentCase?.caseId === caseItem.caseId ? "selected" : ""
                    }`}
                  >
                    <div className="case-card-header">
                      <Folder size={20} className="case-folder-icon" />
                      <span className={`case-status ${caseItem.status}`}>
                        {caseItem.status}
                      </span>
                    </div>

                    <h3 className="case-title">{caseItem.caseTitle}</h3>
                    <p className="case-description">
                      {caseItem.caseDescription}
                    </p>

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
                          onClick={() => handleDeactivateCase(caseItem.caseId)}
                          className="deactivate-case-btn"
                          disabled={isLoading}
                        >
                          Deactivate Case
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivateCase(caseItem.caseId)}
                          className="activate-case-btn"
                          disabled={isLoading}
                        >
                          Activate Case
                        </button>
                      )}
                    </div>

                    <div className="case-card-actions">
                      {caseItem.status === "active" && (
                        <button
                          onClick={() =>
                            handleStartSessionInCase(caseItem.caseId)
                          }
                          className="start-session-card-btn"
                        >
                          <Plus size={16} />
                          <span>Start New Session</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination-container">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="pagination-btn"
                  >
                    Previous
                  </button>

                  <span className="pagination-info">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="pagination-btn"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Create Case Modal */}
        {showCreateCaseModal && (
          <CreateCaseModal
            onClose={() => setShowCreateCaseModal(false)}
            onCreateCase={handleCreateCase}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
};

export default HomePage;
