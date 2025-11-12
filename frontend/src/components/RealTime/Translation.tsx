import React, { useState } from "react";
import { Globe, Download, Copy, Trash2, Settings, ChevronDown, Play } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import { TranslatedLine, TranslationStatus } from "../../types/";

const Translation: React.FC = () => {
  const {
    translatedLines,
    translationStatus,
    translationConfig,
    translateText,
    updateTranslationConfig,
    clearTranslations,
    getTranslationStats
  } = useTranslation();


  const [showSettings, setShowSettings] = useState(false);
  const [manualText, setManualText] = useState("");
  const [manualSpeaker, setManualSpeaker] = useState("User");

  const { total, languages } = getTranslationStats();

  const handleCopyAll = async () => {
    const allText = translatedLines.map((line: TranslatedLine) => 
      `[${line.timestamp}] [${line.speaker}] ${line.originalText} → ${line.translatedText}`
    ).join('\n');
    
    try {
      await navigator.clipboard.writeText(allText);
      alert("Translations copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleDownload = () => {
    const content = translatedLines.map((line: TranslatedLine) =>
      `Time: ${line.timestamp}
Speaker: ${line.speaker}
Original (${line.sourceLanguage}): ${line.originalText}
Translated (${line.targetLanguage}): ${line.translatedText}
Confidence: ${line.confidence}%
---`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translations-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleManualTranslate = async () => {
    if (!manualText.trim()) return;

    await translateText(manualText, manualSpeaker);
    setManualText("");
  };

  const getStatusColor = (status: TranslationStatus) => {
    switch (status) {
      case "translating": return "text-yellow-500";
      case "completed": return "text-green-500";
      case "error": return "text-red-500";
      default: return "text-gray-500";
    }
  };

  const getStatusText = (status: TranslationStatus) => {
    switch (status) {
      case "translating": return "Translating...";
      case "completed": return "Translation Ready";
      case "error": return "Translation Error";
      default: return "Ready";
    }
  };

  return (
    <div className="translation-card">
      <div className="card-header">
        <div className="header-left">
          <Globe className="header-icon" />
          <h3 className="card-title">Live Translation</h3>
          <span className="translation-badge">
            {languages}
          </span>
          <div className="translation-status-indicator">
            <span className={`status-dot ${translationStatus}`}></span>
            <span className={`status-text ${getStatusColor(translationStatus)}`}>
              {getStatusText(translationStatus)}
            </span>
          </div>
        </div>
        
        <div className="translation-controls">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="settings-btn"
            title="Translation Settings"
          >
            <Settings className="btn-icon" />
          </button>
          
          <div className="language-selector">
            <select 
              value={translationConfig.targetLanguage}
              onChange={(e) => updateTranslationConfig({ targetLanguage: e.target.value })}
              className="language-select"
            >
              <option value="ar">Arabic (عربي)</option>
              <option value="fr">French (Français)</option>
              <option value="es">Spanish (Español)</option>
              <option value="de">German (Deutsch)</option>
              <option value="it">Italian (Italiano)</option>
              <option value="pt">Portuguese (Português)</option>
            </select>
            <ChevronDown className="chevron-icon" />
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="translation-settings">
          <div className="setting-group">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={translationConfig.autoTranslate}
                onChange={(e) => updateTranslationConfig({ autoTranslate: e.target.checked })}
                className="setting-checkbox"
              />
              Auto-translate new speech
            </label>
          </div>
          
          <div className="setting-group">
            <label className="setting-label">Source Language:</label>
            <select 
              value={translationConfig.sourceLanguage}
              onChange={(e) => updateTranslationConfig({ sourceLanguage: e.target.value })}
              className="setting-select"
            >
              <option value="auto">Auto-detect</option>
              <option value="en">English</option>
              <option value="ar">Arabic</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
            </select>
          </div>

          <div className="manual-translation">
            <h4>Manual Translation</h4>
            <div className="manual-inputs">
              <input
                type="text"
                value={manualSpeaker}
                onChange={(e) => setManualSpeaker(e.target.value)}
                placeholder="Speaker"
                className="manual-input speaker-input"
              />
              <input
                type="text"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Enter text to translate..."
                className="manual-input text-input"
                onKeyPress={(e) => e.key === 'Enter' && handleManualTranslate()}
              />
              <button 
                onClick={handleManualTranslate}
                disabled={!manualText.trim() || translationStatus === "translating"}
                className="manual-translate-btn"
              >
                <Play className="btn-icon" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="translation-stats">
        <span className="stat-item">Total: {total}</span>
        <span className="stat-item">From: {translationConfig.sourceLanguage.toUpperCase()}</span>
        <span className="stat-item">To: {translationConfig.targetLanguage.toUpperCase()}</span>
      </div>

      <div className="translation-container">
        {translatedLines.length === 0 ? (
          <p className="no-translation">
            No translations yet. {translationConfig.autoTranslate ? 
              `Speech will be automatically translated from ${translationConfig.sourceLanguage.toUpperCase()} to ${translationConfig.targetLanguage.toUpperCase()}.` : 
              "Enable auto-translate or use manual translation."
            }
          </p>
        ) : (
          translatedLines.map((line: TranslatedLine) => (
            <div key={line.id} className="translation-line">
              <div className="line-header">
                <span className="timestamp">{line.timestamp}</span>
                <span className="speaker-badge">{line.speaker}</span>
                <span className="confidence-badge">{line.confidence}%</span>
              </div>
              <div className="line-content">
                <div className="original-text">
                  <span className="language-tag">{line.sourceLanguage}</span>
                  <span className="text">{line.originalText}</span>
                </div>
                <div className="translated-text">
                  <span className="language-tag">{line.targetLanguage}</span>
                  <span className="text">{line.translatedText}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="action-buttons">
        <button className="action-btn" onClick={handleDownload} disabled={translatedLines.length === 0}>
          <Download className="btn-icon" />
          <span>Download</span>
        </button>
        <button className="action-btn" onClick={handleCopyAll} disabled={translatedLines.length === 0}>
          <Copy className="btn-icon" />
          <span>Copy All</span>
        </button>
        <button className="action-btn danger" onClick={clearTranslations} disabled={translatedLines.length === 0}>
          <Trash2 className="btn-icon" />
          <span>Clear All</span>
        </button>
      </div>
    </div>
  );
};

export default Translation;