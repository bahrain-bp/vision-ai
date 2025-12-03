import React from "react";
import { XCircle, AlertTriangle } from "lucide-react";
import { useLanguage } from "../../../context/LanguageContext";

interface ConfirmationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "warning" | "danger" | "info";
}

const ConfirmationPopup: React.FC<ConfirmationPopupProps> = ({
  isOpen,
  onClose,
  onConfirm,

  type = "warning",
}) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "danger":
        return (
          <XCircle className="confirmation-popup-icon confirmation-popup-icon-danger" />
        );
      case "info":
        return (
          <AlertTriangle className="confirmation-popup-icon confirmation-popup-icon-info" />
        );
      default:
        return (
          <AlertTriangle className="confirmation-popup-icon confirmation-popup-icon-warning" />
        );
    }
  };

  const getButtonClass = () => {
    switch (type) {
      case "danger":
        return "confirmation-popup-btn-confirm-danger";
      case "info":
        return "confirmation-popup-btn-confirm-info";
      default:
        return "confirmation-popup-btn-confirm-warning";
    }
  };

  return (
    <div className="confirmation-popup-overlay">
      <div className="confirmation-popup-container">
        <div className="confirmation-popup-header">
          {getIcon()}
          <h3 className="confirmation-popup-title">{t("popup.title")}</h3>
        </div>

        <div className="confirmation-popup-content">
          <p className="confirmation-popup-message">{t("popup.message")}</p>
        </div>

        <div className="confirmation-popup-actions">
          <button
            onClick={onClose}
            className="confirmation-popup-btn-cancel"
            type="button"
          >
            {t("popup.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className={`confirmation-popup-btn-confirm ${getButtonClass()}`}
            type="button"
          >
            {t("popup.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationPopup;
