import React, { useState } from 'react';
import Dialog from '../ui/Dialog';
import { Button } from '../ui/Button';
import FileDropzone from './FileDropzone';

interface UploadARModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
}

export const UploadARModal: React.FC<UploadARModalProps> = ({
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
    <Dialog isOpen={isOpen} onClose={handleClose} title="Upload AR drawdown file" size="lg">
      <div className="space-y-6">
        <p className="text-sm text-slate-600">
          Wholesale AR drawdown file — the basis for the interest calculation.
        </p>

        <FileDropzone
          ariaLabel="Choose AR drawdown file"
          selectedFile={selectedFile}
          onFileSelect={setSelectedFile}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleUpload} disabled={!selectedFile}>
            Upload
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default UploadARModal;
