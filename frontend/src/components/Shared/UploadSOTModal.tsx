import React from 'react';
import FileUploadModal from './FileUploadModal';

interface UploadSOTModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
}

export const UploadSOTModal: React.FC<UploadSOTModalProps> = ({ isOpen, onClose, onUpload }) => (
  <FileUploadModal
    isOpen={isOpen}
    onClose={onClose}
    onUpload={onUpload}
    title="Upload SOT file"
    description="Stock-on-truck file (optional) — used to enrich the drawdown data."
    ariaLabel="Choose SOT file"
  />
);

export default UploadSOTModal;
