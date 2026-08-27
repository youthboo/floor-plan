import React, { useEffect, useState } from 'react';
import Dialog from '../ui/Dialog';
import { Button } from '../ui/Button';
import FileDropzone from './FileDropzone';

interface UploadSOTModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
}

export const UploadSOTModal: React.FC<UploadSOTModalProps> = ({
  isOpen,
  onClose,
  onUpload,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
    }
  }, [isOpen]);

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
    <Dialog isOpen={isOpen} onClose={handleClose} title="Upload SOT file" size="xl">
      <div className="space-y-6">
        <p className="text-sm text-slate-600">
          Stock-on-truck file (optional) — used to enrich the drawdown data.
        </p>

        <FileDropzone
          ariaLabel="Choose SOT file"
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

export default UploadSOTModal;
