import type { SelectHTMLAttributes } from 'react';
import { useId } from 'react';
import { cn } from '@/lib/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export function Select({ label, className, id, children, ...rest }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="font-mono text-xs uppercase tracking-wide text-steel">
        {label}
      </label>
      <select
        id={selectId}
        className={cn(
          'h-11 rounded-sm border border-steel-100 bg-paper px-3 text-sm text-asphalt',
          'focus:border-signal-yellow-600',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}
