// LanguageToggle.tsx
import React from "react";
import { useLanguage } from "../../context/LanguageContext";

interface LanguageToggleProps {
  onLanguageChange?: (language: "en" | "ar") => void;
}

const LanguageToggle: React.FC<LanguageToggleProps> = ({
  onLanguageChange,
}) => {
  const { language, toggleLanguage } = useLanguage();

  const handleLanguageChange = (newLanguage: "en" | "ar") => {
    if (newLanguage !== language) {
      toggleLanguage();

      // Notify parent component about language change
      if (onLanguageChange) {
        onLanguageChange(newLanguage);
      }
    }
  };

  return (
    <div className="language-controls">
      <span className="language-label">
        {language === "en" ? "Language:" : "اللغة:"}
      </span>
      <button
        onClick={() => handleLanguageChange("en")}
        className={`lang-btn ${language === "en" ? "active" : ""}`}
      >
        EN
      </button>
      <button
        onClick={() => handleLanguageChange("ar")}
        className={`lang-btn ${language === "ar" ? "active" : ""}`}
      >
        AR
      </button>
    </div>
  );
};

export default LanguageToggle;
