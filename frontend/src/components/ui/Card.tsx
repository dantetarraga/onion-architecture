import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Colored left rail, used to encode a live status (occupancy, session state) at a glance. */
  railColor?: 'green' | 'yellow' | 'red' | 'none';
}

const RAIL_CLASSES: Record<NonNullable<CardProps['railColor']>, string> = {
  green: 'border-l-4 border-l-route-green',
  yellow: 'border-l-4 border-l-signal-yellow',
  red: 'border-l-4 border-l-hazard-red',
  none: '',
};

export function Card({ railColor = 'none', className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn('rounded-sm border border-steel-100 bg-paper shadow-sm', RAIL_CLASSES[railColor], className)}
      {...rest}
    >
      {children}
    </div>
  );
}
