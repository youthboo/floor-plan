import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCalculation } from '../../hooks/useCalculation';
import LoadingSpinner from '../Shared/LoadingSpinner';
import ErrorAlert from '../Shared/ErrorAlert';
import SuccessAlert from '../Shared/SuccessAlert';
import { formatCurrency } from '../../utils/formatters';

interface LocationState {
  filePath: string;
}

export const PreviewARPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;
  const { result, loading, error, calculate } = useCalculation();

  if (!state?.filePath) {
    return <ErrorAlert message="No file selected. Please go back and upload a file." />;
  }

  const handleCalculate = async () => {
    await calculate(state.filePath);
  };

  return (
    <div className="preview-ar-page">
      <div className="container">
        <h1>Calculate Charges</h1>

        {!result && (
          <div className="calculation-section">
            <p>Ready to calculate AR charges from the uploaded file.</p>
            <button
              className="btn btn-primary"
              onClick={handleCalculate}
              disabled={loading}
            >
              {loading ? 'Calculating...' : '🔢 Calculate'}
            </button>
          </div>
        )}

        {loading && <LoadingSpinner />}

        {error && <ErrorAlert message={error} />}

        {result && (
          <div className="result-section">
            <SuccessAlert message={result.message} />

            <h2>Summary</h2>
            <table className="summary-table">
              <tbody>
                {Object.entries(result.summary).map(([key, value]) => (
                  <tr key={key}>
                    <td className="label">{key}</td>
                    <td className="value">{formatCurrency(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2>Details (First 10 records)</h2>
            <div className="details-table-container">
              <table className="details-table">
                <thead>
                  <tr>
                    <th>Dealer Code</th>
                    <th>VIN</th>
                    <th>Price</th>
                    <th>RAM Charge</th>
                    <th>Dealer Charge</th>
                  </tr>
                </thead>
                <tbody>
                  {result.detailRecords.slice(0, 10).map((record, idx) => (
                    <tr key={idx}>
                      <td>{record.dealerCode}</td>
                      <td>{record.vinNumber}</td>
                      <td>{formatCurrency(record.price)}</td>
                      <td>{formatCurrency(record.ramCharge)}</td>
                      <td>{formatCurrency(record.dealerCharge)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="button-group">
              <button
                className="btn btn-primary"
                onClick={() => navigate('/')}
              >
                ↩ Back to Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewARPage;
