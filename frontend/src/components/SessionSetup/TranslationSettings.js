import React from "react";

const TranslationSettings = ({
  translationSettings,
  onTranslationSettingsChange,
}) => {
  return (
    <div className="session-card">
      <h2 className="card-title">Translation Settings</h2>

      <div className="space-y-4">
        <div className="form-group">
          <label className="form-label">Source Language</label>
          <select
            value={translationSettings.sourceLanguage}
            onChange={(e) =>
              onTranslationSettingsChange("sourceLanguage", e.target.value)
            }
            className="form-select"
          >
            <option value="ar">Arabic</option>
            <option value="en">English</option>
            <option value="fr">French</option>
            <option value="hi">Hindi</option>
            <option value="ur">Urdu</option>
            <option value="fil">Filipino</option>
            <option value="bn">Bengali</option>
            <option value="ml">Malayalam</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Target Language</label>
          <select
            value={translationSettings.targetLanguage}
            onChange={(e) =>
              onTranslationSettingsChange("targetLanguage", e.target.value)
            }
            className="form-select"
          >
            <option value="en">English</option>
            <option value="ar">Arabic</option>
            <option value="fr">French</option>
            <option value="hi">Hindi</option>
            <option value="ur">Urdu</option>
            <option value="fil">Filipino</option>
            <option value="bn">Bengali</option>
            <option value="ml">Malayalam</option>
          </select>
        </div>

        <div className="info-box">
          <p className="info-text">
            <strong>Translation:</strong>{" "}
            {translationSettings.sourceLanguage.toUpperCase()} →{" "}
            {translationSettings.targetLanguage.toUpperCase()}
          </p>
          <p className="info-text mt-1">
            Real-time transcription, translation, identity verification, and AI
            assistant will be automatically enabled
          </p>
        </div>
      </div>
    </div>
  );
};

export default TranslationSettings;