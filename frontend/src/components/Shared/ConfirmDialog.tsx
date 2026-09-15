import React from 'react';
import Dialog from '../ui/Dialog';
import { Button } from '../ui/Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isConfirming = false,
  onConfirm,
  onCancel,
}) => (
  <Dialog isOpen={isOpen} onClose={onCancel} title={title} size="sm">
    <p className="text-sm text-slate-600">{message}</p>
    <div className="mt-6 flex justify-end gap-3">
      <Button variant="secondary" onClick={onCancel} disabled={isConfirming}>
        {cancelLabel}
      </Button>
      <Button
        variant={isDestructive ? 'destructive' : 'default'}
        onClick={onConfirm}
        disabled={isConfirming}
      >
        {isConfirming ? 'Working...' : confirmLabel}
      </Button>
    </div>
  </Dialog>
);

export default ConfirmDialog;
