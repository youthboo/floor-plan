import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFileUpload } from '../../hooks/useFileUpload';
import { fileService } from '../../services/api';
import FileUpload from '../Shared/FileUpload';

export const UploadARPage: React.FC = () => {
  const navigate = useNavigate();
  const { preview, loading, error, handleFileSelect, handleUpload, reset } =
    useFileUpload(fileService.uploadAR);

  const handleProceed = async () => {
    if (preview?.filePath) {
      navigate('/preview-ar', { state: { filePath: preview.filePath } });
    }
  };

  return (
    <div className="upload-ar-page">
      <div className="container">
        <h1>Upload AR File</h1>
        <p className="description">Upload your monthly AR file for processing</p>

        {!preview ? (
          <div className="upload-section">
            <FileUpload
              onFileSelect={handleFileSelect}
              loading={loading}
              error={error}
              onUpload={handleUpload}
              accept=".xlsx,.xls"
              buttonText="Upload & Preview"
            />
          </div>
        ) : (
          <div className="preview-section">
            <h2>File Preview: {preview.fileName}</h2>

            <div className="sheets-overview">
              {preview.sheetNames.map((sheet) => (
                <div key={sheet} className="sheet-info">
                  <h3>{sheet}</h3>
                  <p className="record-count">
                    {preview.recordCounts[sheet]} records
                  </p>
                </div>
              ))}
            </div>

            {preview.sheetNames.map((sheet) => (
              <div key={`preview-${sheet}`} className="sheet-preview">
                <h3>{sheet} (First 5 rows)</h3>
                <div
                  className="table-container"
                  dangerouslySetInnerHTML={{
                    __html: preview.previewTables[sheet],
                  }}
                />
              </div>
            ))}

            <div className="button-group">
              <button className="btn btn-primary" onClick={handleProceed}>
                ✓ Proceed to Calculation
              </button>
              <button className="btn btn-secondary" onClick={reset}>
                ↺ Upload Different File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadARPage;
