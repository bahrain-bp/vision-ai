import React from "react";
import { LanguageCode } from "@aws-sdk/client-transcribe-streaming";
import "./TranslationSettings.css";

interface TranslationSettings {
  sourceLanguage: string;
  targetLanguage: string;
}

interface TranslationSettingsProps {
  translationSettings: TranslationSettings;
  onTranslationSettingsChange: (
    field: keyof TranslationSettings,
    value: string
  ) => void;
}

const TranslationSettings: React.FC<TranslationSettingsProps> = ({
  translationSettings,
  onTranslationSettingsChange,
}) => {
  // Function to get language name from code
  const getLanguageName = (code: string): string => {
    const languageCode = code.split("-")[0];
    const displayName = new Intl.DisplayNames(["en"], { type: "language" }).of(languageCode);
    return displayName || code;
  };

  // Generate language options from AWS Transcribe LanguageCode
  const languageOptions = Object.entries(LanguageCode).map(([code, name]) => {
    const formattedCode = code.split("_")[0].toLowerCase() + "-" + code.split("_")[1].toUpperCase();
    const displayName = new Intl.DisplayNames(["en"], { type: "language" }).of(
      formattedCode.split("-")[0]
    ) || name;
    const region = formattedCode.split("-")[1];

    return {
      code: formattedCode,
      name: `${displayName} (${region})`
    };
  });

  // Get current language names
  const investigatorLangName = getLanguageName(translationSettings.sourceLanguage);
  const witnessLangName = getLanguageName(translationSettings.targetLanguage);

  return (
    <div className="session-card">
      <h2 className="card-title">Translation Settings</h2>

      <div className="translation-settings-row">
        <div className="language-selector-compact">
          <label className="form-label">Investigator Language</label>
          <select
            value={translationSettings.sourceLanguage}
            onChange={(e) =>
              onTranslationSettingsChange("sourceLanguage", e.target.value)
            }
            className="form-select compact"
          >
            {languageOptions.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <div className="language-selector-compact">
          <label className="form-label">Witness Language</label>
          <select
            value={translationSettings.targetLanguage}
            onChange={(e) =>
              onTranslationSettingsChange("targetLanguage", e.target.value)
            }
            className="form-select compact"
          >
            {languageOptions.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <div className="translation-display">
          <span className="translation-direction">
            Investigator: <strong>{investigatorLangName}</strong> | Witness: <strong>{witnessLangName}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};

export default TranslationSettings;