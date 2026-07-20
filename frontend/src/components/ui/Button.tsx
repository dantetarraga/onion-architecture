import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-signal-yellow text-asphalt hover:bg-signal-yellow-600 disabled:bg-steel-100',
  secondary: 'bg-asphalt text-paper hover:bg-asphalt-700 disabled:bg-steel-300',
  outline: 'bg-transparent text-asphalt border border-asphalt hover:bg-asphalt hover:text-paper disabled:opacity-40',
  danger: 'bg-hazard-red text-paper hover:bg-hazard-red-600 disabled:bg-steel-300',
  ghost: 'bg-transparent text-asphalt hover:bg-concrete-200 disabled:opacity-40',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-7 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-sm font-display font-medium uppercase tracking-wide',
        'transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : icon}
      {children}
    </button>
  );
}
