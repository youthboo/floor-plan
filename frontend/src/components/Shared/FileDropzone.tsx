import React from 'react';
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
  hint = '.xlsx only · click to browse',
  className,
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so selecting the same file again (e.g. after a rejection) still fires onChange.
    event.target.value = '';
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

  return (
    <label
      aria-label={ariaLabel}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition-colors hover:border-slate-400 hover:bg-slate-100',
        disabled && 'pointer-events-none cursor-not-allowed opacity-60',
        className
      )}
    >
      <Upload className="h-6 w-6 text-slate-400" />
      <div className="max-w-full">
        <p className="break-all font-medium text-slate-900">
          {selectedFile ? selectedFile.name : placeholder}
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
