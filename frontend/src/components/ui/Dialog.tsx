import React, { ReactNode, useEffect } from 'react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={`w-full rounded-lg bg-white p-6 shadow-lg ${sizeClasses[size]}`}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
              <button
                onClick={onClose}
                className="cursor-pointer text-slate-400 hover:text-slate-600"
                aria-label="Close dialog"
                type="button"
              >
                ✕
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </>
  );
};

export default Dialog;
