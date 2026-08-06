import React from 'react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-96 gap-4">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 border-4 border-gray-200 rounded-full" />
        <div className="absolute inset-0 border-4 border-transparent border-t-primary-600 rounded-full animate-spin" />
      </div>
      <p className="text-gray-600 text-sm font-medium">Loading...</p>
    </div>
  );
};

export default LoadingSpinner;
