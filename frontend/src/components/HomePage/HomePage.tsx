import React, { useState, useEffect } from "react";
import { LogOut, Folder, AlertCircle } from "lucide-react";
import authService from "../../services/authService";
import { User as UserType } from "../../types/";
import { useCaseContext } from "../../hooks/useCaseContext";
import CreateCaseModal from "./CreateCaseModal";
import ActionBar from "./ActionBar";
import CasesGrid from "./CasesGrid";
import { useLanguage } from "../../context/LanguageContext";
import LanguageToggle from "../common/LanguageToggle";

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

  const { t } = useLanguage();

  const [showCreateCaseModal, setShowCreateCaseModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const casesPerPage = 12;
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

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

  const filteredCases = allCases
    .filter((caseItem) => {
      // Search filter
      const matchesSearch =
        caseItem.caseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        caseItem.caseId.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === "all" || caseItem.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // Sort by date
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();

      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

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
                <h1>{t("home.title")}</h1>
                <p>
                  {t("home.welcome")}, {user?.username || "User"}!
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <LanguageToggle />
              <button onClick={handleSignOut} className="signout-btn">
                <LogOut size={18} />
                <span>{t("home.signOut")}</span>
              </button>
            </div>
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
        <ActionBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          onCreateCase={() => setShowCreateCaseModal(true)}
          isLoading={isLoading}
          t={t}
        />

        {/* Cases List */}
        <div className="cases-container">
          <div className="cases-header">
            <Folder size={24} className="cases-icon" />
            <h2 className="cases-title">{t("home.investigationCases")}</h2>
            <span className="cases-count">
              {filteredCases.length} {t("home.cases")}
            </span>
          </div>

          <CasesGrid
            cases={currentCases}
            currentCase={currentCase}
            isLoading={isLoading}
            searchTerm={searchTerm}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            onActivateCase={handleActivateCase}
            onDeactivateCase={handleDeactivateCase}
            onStartSession={handleStartSessionInCase}
            onCreateCase={() => setShowCreateCaseModal(true)}
            t={t}
          />
        </div>

        {/* Create Case Modal */}
        {showCreateCaseModal && (
          <CreateCaseModal
            onClose={() => setShowCreateCaseModal(false)}
            onCreateCase={handleCreateCase}
            isLoading={isLoading}
            t={t}
          />
        )}
      </div>
    </div>
  );
};

export default HomePage;
