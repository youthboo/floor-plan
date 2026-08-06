import React from 'react';
import { useConfig } from '../../hooks/useConfig';
import LoadingSpinner from '../Shared/LoadingSpinner';
import ErrorAlert from '../Shared/ErrorAlert';

export const HomePage: React.FC = () => {
  const { config, loading, error } = useConfig();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;
  if (!config?.config) return <ErrorAlert message="Failed to load configuration" />;

  return (
    <div className="w-full min-h-screen bg-white py-10">
      <div className="max-w-4xl mx-auto px-10">
        {/* Page Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">FloorPlan Interest Calculator</h1>
          <p className="text-sm text-gray-600">Calculate automotive dealer rental charges</p>
        </div>

        {/* Configuration Section */}
        {config.config && (
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Configuration</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <span className="text-sm font-semibold text-gray-600 uppercase">Month End Date</span>
                <p className="text-lg font-semibold text-gray-900 mt-2">{config.config.monthEndDate || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <span className="text-sm font-semibold text-gray-600 uppercase">Penalty Rate</span>
                <p className="text-lg font-semibold text-gray-900 mt-2">{config.config.penaltyRate || 'N/A'}%</p>
              </div>
            </div>
          </section>
        )}

        {/* Interest Rates Section */}
        {config.rates && config.rates.length > 0 && (
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Interest Rates by Day Range</h2>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Start Day</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">End Day</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Rate (%)</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Effective Period</th>
                  </tr>
                </thead>
                <tbody>
                  {config.rates.map((rate, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-900">{rate.StartDay}</td>
                      <td className="px-6 py-4 text-gray-900">{rate.EndDay}</td>
                      <td className="px-6 py-4 text-gray-900">{rate.Rate}</td>
                      <td className="px-6 py-4 text-gray-600 text-sm">{rate.EffectiveStart} to {rate.EffectiveEnd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Subvention Campaigns Section */}
        {config.subventions && config.subventions.length > 0 && (
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Subvention Campaigns</h2>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Campaign Name</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Free Days</th>
                  </tr>
                </thead>
                <tbody>
                  {config.subventions.map((sub, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-900">{sub['Campaign Name']}</td>
                      <td className="px-6 py-4 text-gray-900">{sub['Free Days']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default HomePage;
