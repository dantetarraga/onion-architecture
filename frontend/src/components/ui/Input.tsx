import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ label, error, className, id, ...rest }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="font-mono text-xs uppercase tracking-wide text-steel">
        {label}
      </label>
      <input
        id={inputId}
        className={cn(
          'h-11 rounded-sm border border-steel-100 bg-paper px-3 text-sm text-asphalt placeholder:text-steel-300',
          'focus:border-signal-yellow-600',
          error && 'border-hazard-red',
          className,
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...rest}
      />
      {error && (
        <p id={`${inputId}-error`} className="font-mono text-xs text-hazard-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
