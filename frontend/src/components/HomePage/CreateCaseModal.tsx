import React, { useState } from "react";
import { X } from "lucide-react";

interface CreateCaseModalProps {
  onClose: () => void;
  onCreateCase: (title: string, description: string) => Promise<void>;
  isLoading: boolean;
  t: (key: string) => string;
}

const CreateCaseModal: React.FC<CreateCaseModalProps> = ({
  onClose,
  onCreateCase,
  isLoading,
  t,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && description.trim()) {
      await onCreateCase(title, description);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">{t("modal.createNewCase")}</h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="caseTitle" className="form-label">
              {t("modal.caseTitle")} *
            </label>
            <input
              id="caseTitle"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("modal.enterTitle")}
              className="form-input"
              required
              maxLength={60}
            />
            <div className="char-count">{title.length}/60</div>
          </div>

          <div className="form-group">
            <label htmlFor="caseDescription" className="form-label">
              {t("modal.description")} *
            </label>
            <textarea
              id="caseDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("modal.enterDescription")}
              className="form-textarea"
              rows={4}
              required
              maxLength={120}
            />
            <div className="char-count">{description.length}/120</div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="modal-cancel-btn"
              disabled={isLoading}
            >
              {t("modal.cancel")}
            </button>
            <button
              type="submit"
              className="modal-submit-btn"
              disabled={isLoading || !title.trim() || !description.trim()}
            >
              {isLoading ? t("modal.creating") : t("modal.createCase")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCaseModal;
