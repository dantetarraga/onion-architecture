import type { ReactNode } from 'react';
import { ToastViewport } from '@/components/ui/ToastViewport';

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ eyebrow, title, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-asphalt px-4 py-12">
      <div className="mb-8 flex items-center gap-2">
        <span className="h-3 w-3 bg-signal-yellow" aria-hidden />
        <span className="font-display text-xl tracking-wide text-paper">Parking/OS</span>
      </div>

      <div className="w-full max-w-sm border-t-4 border-signal-yellow bg-paper p-8 shadow-xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-signal-yellow-600">{eyebrow}</p>
        <h1 className="mt-1 mb-6 text-2xl text-asphalt">{title}</h1>
        {children}
      </div>

      {footer && <div className="mt-6 font-mono text-xs text-steel-300">{footer}</div>}
      <ToastViewport />
    </div>
  );
}
