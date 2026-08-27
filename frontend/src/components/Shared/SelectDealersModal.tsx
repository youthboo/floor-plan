import React, { useEffect, useMemo, useState } from 'react';
import Dialog from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';

export const DEALERS = [
  'B Infinite Group',
  'Tanpoon Group',
  'Crown Motors',
  'Rever Automotive HQ',
  'Siam Motors BYD',
  'Metro Auto Group',
  'Bangkok EV Center',
  'Chonburi Motors',
  'Phuket Auto Group',
  'Korat Car Mall',
  'Hatyai Motors',
  'Chiangmai EV',
  'Rama III Auto',
  'Ekamai Showroom',
];

interface SelectDealersModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDealers: string[];
  onConfirm: (dealers: string[]) => void;
}

export const SelectDealersModal: React.FC<SelectDealersModalProps> = ({
  isOpen,
  onClose,
  selectedDealers,
  onConfirm,
}) => {
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState<string[]>(selectedDealers);

  useEffect(() => {
    if (isOpen) {
      setChecked(selectedDealers);
      setSearch('');
    }
  }, [isOpen, selectedDealers]);

  const filteredDealers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return DEALERS;
    return DEALERS.filter((dealer) => dealer.toLowerCase().includes(query));
  }, [search]);

  const allSelected = checked.length === DEALERS.length;

  const toggleDealer = (dealer: string) => {
    setChecked((prev) =>
      prev.includes(dealer) ? prev.filter((d) => d !== dealer) : [...prev, dealer]
    );
  };

  const toggleSelectAll = () => {
    setChecked(allSelected ? [] : [...DEALERS]);
  };

  const handleClose = () => {
    setSearch('');
    onClose();
  };

  const handleDone = () => {
    onConfirm(checked);
    handleClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Select dealers" size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Choose which dealers this quota row applies to</p>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search dealers..."
        />

        <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
          <label className="flex cursor-pointer items-center gap-3 border-b border-slate-200 px-4 py-3 hover:bg-slate-50">
            <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
            <span className="text-sm font-semibold text-slate-900">Select all dealers</span>
          </label>

          {filteredDealers.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No dealers found</p>
          ) : (
            filteredDealers.map((dealer) => (
              <label
                key={dealer}
                className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0 hover:bg-slate-50"
              >
                <Checkbox
                  checked={checked.includes(dealer)}
                  onCheckedChange={() => toggleDealer(dealer)}
                />
                <span className="text-sm text-slate-700">{dealer}</span>
              </label>
            ))
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-slate-500">{checked.length} selected</span>
          <Button variant="default" onClick={handleDone}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default SelectDealersModal;
