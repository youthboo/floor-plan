import React, { useState } from 'react';
import Dialog from '../ui/Dialog';
import { Button } from '../ui/Button';

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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

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
    <Dialog isOpen={isOpen} onClose={handleClose} title="Upload campaign file" size="md">
      <div className="space-y-6">
        <p className="text-sm text-slate-600">
          Choose an Excel file. A single file can define multiple campaigns.
        </p>

        <div>
          <label className="text-sm font-medium text-slate-900">File</label>
          <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 py-12 px-6 transition-colors hover:border-slate-400 hover:bg-slate-100">
            <svg
              className="mb-2 h-8 w-8 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <div className="text-center">
              <p className="font-medium text-slate-900">
                Click to choose campaign file
              </p>
              <p className="text-xs text-slate-500">.xlsx or .csv · click to browse</p>
            </div>
            <input
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
            />
          </label>
          {selectedFile && (
            <p className="mt-2 text-sm text-green-600">
              ✓ {selectedFile.name}
            </p>
          )}
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
