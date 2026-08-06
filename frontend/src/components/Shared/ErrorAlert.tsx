import React from 'react';

interface ErrorAlertProps {
  message: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message }) => {
  return (
    <div className="flex gap-4 p-4 rounded-lg my-4 bg-red-50 border-l-4 border-red-700 text-red-700">
      <span className="text-xl flex-shrink-0">❌</span>
      <div className="flex-1">
        <strong className="block mb-1">Error</strong>
        <p className="m-0 leading-tight text-sm">{message}</p>
      </div>
    </div>
  );
};

export default ErrorAlert;
