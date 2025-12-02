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
}) => {
  return (
    <div className="actions-bar">
      <div className="search-box">
        <Search size={20} className="search-icon" />
        <input
          type="text"
          placeholder="Search cases..."
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
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <select
          value={sortOrder}
          onChange={(e) =>
            onSortOrderChange(e.target.value as "newest" | "oldest")
          }
          className="filter-select"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>

      <button
        onClick={onCreateCase}
        disabled={isLoading}
        className="new-case-btn"
      >
        <Plus size={20} />
        <span>New Case</span>
      </button>
    </div>
  );
};

export default ActionBar;
