import React from 'react';
import { FileText, Download, Copy } from 'lucide-react';

const LiveTranscription = () => {
  const transcriptLines = [
    { time: '00:15:23', speaker: 'Ahmad', language: 'AR', text: 'أنا لم أكن على علم بتغيير السياسة' },
    { time: '00:15:28', speaker: 'M. AlZebari', language: 'AR', text: 'متى علمت بهذا التغيير؟' },
    { time: '00:15:32', speaker: 'Ahmad', language: 'AR', text: 'في الأسبوع الماضي فقط' },
  ];

  return (
    <div className="transcription-card">
      <div className="card-header">
        <div className="header-left">
          <FileText className="header-icon" />
          <h3 className="card-title">Live Transcription</h3>
        </div>
        <div className="recording-status">
          <span className="recording-dot"></span>
          <span>Recording</span>
        </div>
      </div>

      <div className="transcript-container">
        {transcriptLines.map((line, index) => (
          <div key={index} className="transcript-line">
            <span className="timestamp">{line.time}</span>{' '}
            <span className="speaker">[{line.speaker}]</span>{' '}
            <span className="language">{line.language}:</span>{' '}
            <span className="text">{line.text}</span>
          </div>
        ))}
      </div>

      <div className="action-buttons">
        <button className="action-btn">
          <Download className="btn-icon" />
          <span>Download</span>
        </button>
        <button className="action-btn">
          <Copy className="btn-icon" />
          <span>Copy All</span>
        </button>
      </div>
    </div>
  );
};

export default LiveTranscription;