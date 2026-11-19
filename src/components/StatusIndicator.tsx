import { AlertTriangle, CheckCircle2, Clock, Flag } from 'lucide-react';
import type { BusStatus } from '../types/database';

interface StatusIndicatorProps {
  status: BusStatus;
  size?: 'sm' | 'md';
}

export function StatusIndicator({ status, size = 'sm' }: StatusIndicatorProps) {
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  switch (status) {
    case 'On Time':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium text-emerald-400 whitespace-nowrap shrink-0 ${textSize}`}
        >
          <CheckCircle2 className={iconSize} aria-hidden="true" />
          <span>On Time</span>
        </span>
      );
    case 'Delayed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium text-amber-400 whitespace-nowrap shrink-0 ${textSize}`}
        >
          <AlertTriangle className={iconSize} aria-hidden="true" />
          <span>Delayed</span>
        </span>
      );
    case 'Arrived':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium text-sky-400 whitespace-nowrap shrink-0 ${textSize}`}
        >
          <Flag className={iconSize} aria-hidden="true" />
          <span>Arrived</span>
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium text-slate-400 whitespace-nowrap shrink-0 ${textSize}`}
        >
          <Clock className={iconSize} aria-hidden="true" />
          <span>{status || 'Not Started'}</span>
        </span>
      );
  }
}
