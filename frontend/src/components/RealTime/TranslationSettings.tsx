import React from "react";
import "./TranslationSettings.css";
import { useCaseContext } from "../../hooks/useCaseContext";
import { useLanguage } from "../../context/LanguageContext";

interface TranslationSettingsType {
  sourceLanguage: string;
  targetLanguage: string;
}

interface TranslationSettingsProps {
  translationSettings: TranslationSettingsType;
  onTranslationSettingsChange: (
    field: keyof TranslationSettingsType,
    value: string
  ) => void;
}

// Supported translation languages (AWS Translate compatible)
const SUPPORTED_LANGUAGES = [
  "af-ZA", "ar-AE", "ar-SA", "ca-ES", "cs-CZ", "da-DK", 
  "de-DE", "de-CH", "el-GR", "en-AU", "en-GB", "en-IN",
  "en-NZ", "en-US", "en-ZA", "es-ES", "es-US", "fa-IR",
  "fi-FI", "fr-CA", "fr-FR", "he-IL", "hi-IN", "hr-HR",
  "id-ID", "it-IT", "ja-JP", "ko-KR", "ms-MY", "nl-NL",
  "no-NO", "pl-PL", "pt-BR", "pt-PT", "ro-RO", "ru-RU",
  "sk-SK", "sr-RS", "sv-SE", "th-TH", "tl-PH", "uk-UA",
  "vi-VN", "zh-CN", "zh-HK", "zh-TW",
];

const TranslationSettings: React.FC<TranslationSettingsProps> = ({
  translationSettings,
  onTranslationSettingsChange,
}) => {
  const { currentPersonType } = useCaseContext();
  const { t, language } = useLanguage();

  const getParticipantLabel = (): string => {
    if (!currentPersonType) return t("identity.witness");
    
    const labels: Record<string, string> = {
      'Witness': t('identity.witness'),
      'Accused': t('identity.accused'),
      'Victim': t('identity.victim')
    };
    
    const capitalizedType = currentPersonType.charAt(0).toUpperCase() + currentPersonType.slice(1);
    return labels[capitalizedType] || capitalizedType;
  };

  const participantLabel = getParticipantLabel();

  // Get current language names using translation context
  const investigatorLangName = t(`lang.${translationSettings.sourceLanguage}`);
  const participantLangName = t(`lang.${translationSettings.targetLanguage}`);

  return (
    <div className="session-card">
      <h2 className="card-title">{t("translation.settingsTitle")}</h2>
      <div className="translation-settings-row">
        <div className="language-selector-compact">
          <label className="form-label">
            {language === 'ar' 
              ? `${t("session.language")} ${t("session.investigator")}`
              : `${t("session.investigator")} ${t("session.language")}`
            }
          </label>
          <select
            value={translationSettings.sourceLanguage}
            onChange={(e) =>
              onTranslationSettingsChange("sourceLanguage", e.target.value)
            }
            className="form-select compact"
          >
            {SUPPORTED_LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {t(`lang.${code}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="language-selector-compact">
          <label className="form-label">
            {language === 'ar'
              ? `${t("session.language")} ${participantLabel}`
              : `${participantLabel} ${t("session.language")}`
            }
          </label>
          <select
            value={translationSettings.targetLanguage}
            onChange={(e) =>
              onTranslationSettingsChange("targetLanguage", e.target.value)
            }
            className="form-select compact"
          >
            {SUPPORTED_LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {t(`lang.${code}`)}
              </option>
            ))}
          </select>
        </div>

        <div 
          className="translation-display"
          style={{
            direction: language === 'ar' ? 'rtl' : 'ltr',
            textAlign: language === 'ar' ? 'right' : 'left'
          }}
        >
          <span className="translation-direction">
            {language === 'ar' ? (
              // Arabic: Participant | Investigator (RTL)
              <>
                {participantLabel}: <strong>{participantLangName}</strong> | 
                {t("session.investigator")}: <strong>{investigatorLangName}</strong>
              </>
            ) : (
              // English: Investigator | Participant (LTR)
              <>
                {t("session.investigator")}: <strong>{investigatorLangName}</strong> | 
                {participantLabel}: <strong>{participantLangName}</strong>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TranslationSettings;