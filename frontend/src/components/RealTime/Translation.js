import React from 'react';
import { Globe, Download, ChevronDown } from 'lucide-react';

const Translation = () => {
  const translations = [
    { time: '00:15:23', speaker: 'Ahmad', text: 'I was not aware of the policy change', confidence: '98%' },
    { time: '00:15:28', speaker: 'M. AlZebari', text: 'When did you learn about this change?', confidence: '99%' },
    { time: '00:15:32', speaker: 'Ahmad', text: 'Just last week', confidence: '97%' },
  ];

  return (
    <div className="translation-card">
      <div className="card-header">
        <div className="header-left">
          <Globe className="header-icon" />
          <h3 className="card-title">Translation</h3>
        </div>
        <div className="language-selector">
          <span>AR → EN</span>
          <ChevronDown className="chevron-icon" />
        </div>
      </div>

      <div className="translation-container">
        {translations.map((line, index) => (
          <div key={index} className="translation-line">
            <div className="line-content">
              <span className="timestamp">{line.time}</span>{' '}
              <span className="speaker">[{line.speaker}]:</span>{' '}
              <span className="text">{line.text}</span>
            </div>
            <span className="confidence">({line.confidence})</span>
          </div>
        ))}
      </div>

      <button className="download-btn">
        <Download className="btn-icon" />
        <span>Download</span>
      </button>
    </div>
  );
};

export default Translation;