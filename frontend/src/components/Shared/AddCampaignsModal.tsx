import React from 'react';
import { ChevronRight, FileSpreadsheet, PlusCircle } from 'lucide-react';
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
            <div className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100">
              <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-slate-900">Upload from file</h3>
              <p className="text-sm text-slate-600">
                Import an Excel file — one file can contain multiple campaigns.
                Review before importing.
              </p>
            </div>
            <ChevronRight className="mt-1 h-5 w-5 flex-shrink-0 text-slate-400" />
          </button>

          <button
            onClick={onAddManually}
            className="flex w-full items-start gap-4 rounded-lg border border-slate-200 p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-100">
              <PlusCircle className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-slate-900">Add one campaign</h3>
              <p className="text-sm text-slate-600">
                Fill in the campaign form manually — quota allocation and rate
                tiers.
              </p>
            </div>
            <ChevronRight className="mt-1 h-5 w-5 flex-shrink-0 text-slate-400" />
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default AddCampaignsModal;
