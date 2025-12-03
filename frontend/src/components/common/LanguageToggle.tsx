import React from "react";
import { useLanguage } from "../../context/LanguageContext";

const LanguageToggle: React.FC = () => {
  const { language, toggleLanguage } = useLanguage();

  return (
    <div className="language-controls">
      <span className="language-label">
        {language === "en" ? "Language:" : "اللغة:"}
      </span>
      <button
        onClick={toggleLanguage}
        className={`lang-btn ${language === "en" ? "active" : ""}`}
      >
        EN
      </button>
      <button
        onClick={toggleLanguage}
        className={`lang-btn ${language === "ar" ? "active" : ""}`}
      >
        AR
      </button>
    </div>
  );
};

export default LanguageToggle;
