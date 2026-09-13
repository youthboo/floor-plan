import React from 'react';
import FileUploadModal from './FileUploadModal';

interface UploadCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
}

export const UploadCampaignModal: React.FC<UploadCampaignModalProps> = ({
  isOpen,
  onClose,
  onUpload,
}) => (
  <FileUploadModal
    isOpen={isOpen}
    onClose={onClose}
    onUpload={onUpload}
    title="Upload campaign file"
    description="Choose an Excel file. A single file can define multiple campaigns."
    ariaLabel="Choose campaign file"
    fileFieldLabel="File"
    dropzonePlaceholder="Click to choose campaign file"
  />
);

export default UploadCampaignModal;
