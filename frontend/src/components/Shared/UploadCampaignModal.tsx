import React, { useState } from 'react';
import Dialog from '../ui/Dialog';
import { Button } from '../ui/Button';
import FileDropzone from './FileDropzone';

interface UploadCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
}

export const UploadCampaignModal: React.FC<UploadCampaignModalProps> = ({
  isOpen,
  onClose,
  onUpload,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile);
      setSelectedFile(null);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Upload campaign file" size="xl">
      <div className="space-y-6">
        <p className="text-sm text-slate-600">
          Choose an Excel file. A single file can define multiple campaigns.
        </p>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">File</label>
          <FileDropzone
            ariaLabel="Choose campaign file"
            selectedFile={selectedFile}
            onFileSelect={setSelectedFile}
            placeholder="Click to choose campaign file"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleUpload}
            disabled={!selectedFile}
          >
            Upload
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default UploadCampaignModal;
