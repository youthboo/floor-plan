import React, { useEffect, useState } from 'react';
import Dialog from '../ui/Dialog';
import { Button } from '../ui/Button';
import FileDropzone from './FileDropzone';

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
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
    }
  }, [isOpen]);

  const handleRecalculate = () => {
    if (!selectedFile || isSubmitting) return;
    onRecalculate(selectedFile);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setSelectedFile(null);
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Upload waive conditions" size="lg">
      <div className="space-y-6">
        <p className="text-sm text-slate-600">
          Choose the waive conditions file, then recalculate to apply it.
        </p>

        <FileDropzone
          ariaLabel="Choose waive conditions file"
          selectedFile={selectedFile}
          onFileSelect={setSelectedFile}
          disabled={isSubmitting}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleRecalculate}
            disabled={!selectedFile || isSubmitting}
          >
            {isSubmitting ? 'Recalculating...' : 'Recalculate'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default UploadWaiveModal;
