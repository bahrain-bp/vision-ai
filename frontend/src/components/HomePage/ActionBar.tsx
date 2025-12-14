import React from "react";
import { Search, Plus } from "lucide-react";

interface ActionBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: "all" | "active" | "inactive";
  onStatusFilterChange: (value: "all" | "active" | "inactive") => void;
  sortOrder: "newest" | "oldest";
  onSortOrderChange: (value: "newest" | "oldest") => void;
  onCreateCase: () => void;
  isLoading: boolean;
  t: (key: string) => string;
}

const ActionBar: React.FC<ActionBarProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortOrder,
  onSortOrderChange,
  onCreateCase,
  isLoading,
  t,
}) => {
  return (
    <div className="actions-bar">
      <div className="search-box">
        <Search size={20} className="search-icon" />
        <input
          type="text"
          placeholder={t("home.searchCases")}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="filter-controls">
        <select
          value={statusFilter}
          onChange={(e) =>
            onStatusFilterChange(
              e.target.value as "all" | "active" | "inactive"
            )
          }
          className="filter-select"
        >
          <option value="all">{t("home.allStatus")}</option>
          <option value="active">{t("home.active")}</option>
          <option value="inactive">{t("home.inactive")}</option>
        </select>

        <select
          value={sortOrder}
          onChange={(e) =>
            onSortOrderChange(e.target.value as "newest" | "oldest")
          }
          className="filter-select"
        >
          <option value="newest">{t("home.newestFirst")}</option>
          <option value="oldest">{t("home.oldestFirst")}</option>
        </select>
      </div>

      <button
        onClick={onCreateCase}
        disabled={isLoading}
        className="new-case-btn"
      >
        <Plus size={20} />
        <span>{t("home.newCase")}</span>
      </button>
    </div>
  );
};

export default ActionBar;
