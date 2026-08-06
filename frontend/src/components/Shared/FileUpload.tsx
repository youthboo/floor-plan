import React, { useRef } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  loading?: boolean;
  error?: string | null;
  onUpload?: () => void;
  accept?: string;
  buttonText?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  loading = false,
  error = null,
  onUpload,
  accept = '.xlsx,.xls',
  buttonText = 'Upload',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={handleClick}
        className="border-2 border-dashed border-primary-600 rounded-lg p-12 text-center cursor-pointer bg-blue-50 transition-all hover:bg-blue-100 hover:border-primary-700 w-full"
      >
        <div className="text-5xl mb-4">📤</div>
        <p className="m-0 text-lg font-medium text-primary-600">Click to select file or drag & drop</p>
        <p className="mt-2 m-0 text-sm text-gray-600">Supported: Excel (.xlsx, .xls)</p>
      </button>

      {error && (
        <div className="text-red-700 text-sm p-3 bg-red-50 rounded">
          {error}
        </div>
      )}

      {onUpload && (
        <button
          onClick={onUpload}
          disabled={loading}
          type="button"
          className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium text-base cursor-pointer transition-colors hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Uploading...' : buttonText}
        </button>
      )}
    </div>
  );
};

export default FileUpload;
