import React from 'react';
import Dialog from '../ui/Dialog';

interface AddCampaignsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadFile: () => void;
  onAddManually: () => void;
}

export const AddCampaignsModal: React.FC<AddCampaignsModalProps> = ({
  isOpen,
  onClose,
  onUploadFile,
  onAddManually,
}) => {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Add campaigns" size="md">
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Choose how you want to add campaigns.
        </p>

        <div className="space-y-3 pt-2">
          <button
            onClick={onUploadFile}
            className="flex w-full items-start gap-4 rounded-lg border border-slate-200 p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-slate-900">Upload from file</h3>
              <p className="text-sm text-slate-600">
                Import an Excel file — one file can contain multiple campaigns.
                Review before importing.
              </p>
            </div>
            <svg
              className="h-5 w-5 text-slate-400 flex-shrink-0 mt-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          <button
            onClick={onAddManually}
            className="flex w-full items-start gap-4 rounded-lg border border-slate-200 p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-600"
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
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-slate-900">Add one campaign</h3>
              <p className="text-sm text-slate-600">
                Fill in the campaign form manually — quota allocation and rate
                tiers.
              </p>
            </div>
            <svg
              className="h-5 w-5 text-slate-400 flex-shrink-0 mt-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default AddCampaignsModal;
