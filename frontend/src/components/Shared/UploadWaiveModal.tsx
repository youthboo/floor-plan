import React from 'react';
import FileUploadModal from './FileUploadModal';

interface UploadWaiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecalculate: (file: File) => void;
  isSubmitting?: boolean;
}

export const UploadWaiveModal: React.FC<UploadWaiveModalProps> = ({
  isOpen,
  onClose,
  onRecalculate,
  isSubmitting = false,
}) => (
  <FileUploadModal
    isOpen={isOpen}
    onClose={onClose}
    onUpload={onRecalculate}
    title="Upload waive conditions"
    description="Choose the waive conditions file, then recalculate to apply it."
    ariaLabel="Choose waive conditions file"
    confirmLabel="Recalculate"
    submittingLabel="Recalculating..."
    isSubmitting={isSubmitting}
  />
);

export default UploadWaiveModal;
