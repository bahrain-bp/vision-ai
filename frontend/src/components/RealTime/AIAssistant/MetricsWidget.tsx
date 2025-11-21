// Displays real-time metrics for question generation

import React from 'react';
import { useQuestionContext } from '../../../hooks/useQuestionContext';

const MetricsWidget: React.FC = () => {
  // Get metrics from context
  const { metrics } = useQuestionContext();

  return (
    <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 mt-4">
      {/* Header */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Questions Metrics
      </h3>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-3">
        
        {/* Confirmed Questions */}
        <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="text-2xl font-bold text-green-600">
            {metrics.confirmedCount}
          </div>
          <div className="text-xs text-green-700 mt-1">
            Confirmed
          </div>
        </div>

        {/* Rejected Questions */}
        <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="text-2xl font-bold text-red-600">
            {metrics.rejectedCount}
          </div>
          <div className="text-xs text-red-700 mt-1">
            Rejected
          </div>
        </div>

        {/* Retry Count */}
        <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-600">
            {metrics.retryCount}
          </div>
          <div className="text-xs text-gray-700 mt-1">
            Retries
          </div>
        </div>

      </div>
    </div>
  );
};

export default MetricsWidget;