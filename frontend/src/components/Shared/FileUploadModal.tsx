import React, { useEffect, useState } from 'react';
import Dialog from '../ui/Dialog';
import { Button } from '../ui/Button';
import FileDropzone from './FileDropzone';

export interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
  title: string;
  description: string;
  ariaLabel: string;
  fileFieldLabel?: string;
  dropzonePlaceholder?: string;
  confirmLabel?: string;
  submittingLabel?: string;
  isSubmitting?: boolean;
  showInlineFileError?: boolean;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  title,
  description,
  ariaLabel,
  fileFieldLabel,
  dropzonePlaceholder,
  confirmLabel = 'Upload',
  submittingLabel,
  isSubmitting = false,
  showInlineFileError = false,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setFileError(null);
    }
  }, [isOpen]);

  const handleUpload = () => {
    if (!selectedFile || isSubmitting) return;
    onUpload(selectedFile);
    setSelectedFile(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setSelectedFile(null);
    setFileError(null);
    onClose();
  };

  const dropzone = (
    <FileDropzone
      ariaLabel={ariaLabel}
      selectedFile={selectedFile}
      onFileSelect={(file) => {
        setFileError(null);
        setSelectedFile(file);
      }}
      onInvalidFile={showInlineFileError ? setFileError : undefined}
      placeholder={dropzonePlaceholder}
      disabled={isSubmitting}
    />
  );

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title={title} size="xl">
      <div className="space-y-6">
        <p className="text-sm text-slate-600">{description}</p>

        {fileFieldLabel ? (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-900">
              {fileFieldLabel}
            </label>
            {dropzone}
          </div>
        ) : (
          dropzone
        )}

        {showInlineFileError && fileError && <p className="text-sm text-red-600">{fileError}</p>}

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleUpload}
            disabled={!selectedFile || isSubmitting}
          >
            {isSubmitting && submittingLabel ? submittingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default FileUploadModal;
