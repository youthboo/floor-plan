import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BackLinkProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export const BackLink: React.FC<BackLinkProps> = ({
  onClick,
  label = 'All campaigns',
  className,
}) => (
  <button
    onClick={onClick}
    className={cn(
      'mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900',
      className
    )}
  >
    <ArrowLeft className="h-4 w-4" />
    {label}
  </button>
);

export default BackLink;
