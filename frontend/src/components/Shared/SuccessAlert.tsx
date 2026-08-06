import React from 'react';

interface SuccessAlertProps {
  message: string;
}

export const SuccessAlert: React.FC<SuccessAlertProps> = ({ message }) => {
  return (
    <div className="flex gap-4 p-4 rounded-lg my-4 bg-green-50 border-l-4 border-green-700 text-green-700">
      <span className="text-xl flex-shrink-0">✓</span>
      <div className="flex-1">
        <strong className="block mb-1">Success</strong>
        <p className="m-0 leading-tight text-sm">{message}</p>
      </div>
    </div>
  );
};

export default SuccessAlert;
