import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FileDropzoneProps {
  selectedFile: File | null;
  onFileSelect: (file: File) => void;
  /** Called instead of onFileSelect when the chosen file's extension isn't in `accept`. */
  onInvalidFile?: (message: string) => void;
  ariaLabel: string;
  accept?: string;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  className?: string;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  selectedFile,
  onFileSelect,
  onInvalidFile,
  ariaLabel,
  accept = '.xlsx',
  disabled = false,
  placeholder = 'Choose file',
  hint = '.xlsx only · click to browse or drag and drop',
  className,
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const processFile = (file: File | undefined | null) => {
    if (!file) return;

    const allowedExtensions = accept
      .split(',')
      .map((ext) => ext.trim().toLowerCase())
      .filter(Boolean);
    const isAllowed = allowedExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!isAllowed) {
      onInvalidFile?.(`Only ${accept} files are accepted.`);
      return;
    }

    onFileSelect(file);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so selecting the same file again (e.g. after a rejection) still fires onChange.
    event.target.value = '';
    processFile(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (disabled) return;
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingOver(false);
    if (disabled) return;
    processFile(event.dataTransfer.files?.[0]);
  };

  return (
    <label
      aria-label={ariaLabel}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition-colors hover:border-slate-400 hover:bg-slate-100',
        isDraggingOver && 'border-primary-500 bg-primary-50',
        disabled && 'pointer-events-none cursor-not-allowed opacity-60',
        className
      )}
    >
      <Upload className="h-6 w-6 text-slate-400" />
      <div className="max-w-full">
        <p className="break-all font-medium text-slate-900">
          {selectedFile ? selectedFile.name : isDraggingOver ? 'Drop file to upload' : placeholder}
        </p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      </div>
      <input
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
      />
    </label>
  );
};

export default FileDropzone;
