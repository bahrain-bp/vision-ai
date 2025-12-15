// src/components/RealTime/AIAssistant/MetricsWidget.tsx

import React from 'react';
import { Check, X, RotateCcw } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext'; // ← ADDED
import { MetricsWidgetProps } from '../../../types/aiQuestionsRT';

/**
 * MetricsWidget Component
 * 
 * Displays session-wide question metrics with clear labels
 * - Confirmed questions count (green)
 * - Rejected questions count (red)  
 * - Retry attempts count (amber)
 * 
 * Props:
 * - metrics: QuestionMetrics object from context
 * - className: Optional additional CSS classes
 */
const MetricsWidget: React.FC<MetricsWidgetProps> = ({ metrics, className = '' }) => {
   const { t } = useLanguage();
  return (
    <div className={`flex items-center justify-center gap-3 py-2 ${className}`}>
      
      {/* Confirmed Badge with Label */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-bold text-sm">
          <Check className="w-4 h-4" />
          <span>{metrics.confirmedCount}</span>
        </div>
        <span className="text-xs text-gray-600 font-medium">{t("aiAssistant.confirmed")}</span> {/* ← CHANGED */}
      </div>

      {/* Rejected Badge with Label */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1.5 bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-bold text-sm">
          <X className="w-4 h-4" />
          <span>{metrics.rejectedCount}</span>
        </div>
        <span className="text-xs text-gray-600 font-medium">{t("aiAssistant.rejected")}</span> {/* ← CHANGED */}
      </div>

      {/* Retry Badge with Label */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg font-bold text-sm">
          <RotateCcw className="w-4 h-4" />
          <span>{metrics.retryCount}</span>
        </div>
        <span className="text-xs text-gray-600 font-medium">{t("aiAssistant.retries")}</span> {/* ← CHANGED */}

      </div>
      
    </div>
  );
};

export default MetricsWidget;