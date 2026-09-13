import React from 'react';
import FileUploadModal from './FileUploadModal';

interface UploadARModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
}

export const UploadARModal: React.FC<UploadARModalProps> = ({ isOpen, onClose, onUpload }) => (
  <FileUploadModal
    isOpen={isOpen}
    onClose={onClose}
    onUpload={onUpload}
    title="Upload AR drawdown file"
    description="Wholesale AR drawdown file — the basis for the interest calculation."
    ariaLabel="Choose AR drawdown file"
    showInlineFileError
  />
);

export default UploadARModal;
