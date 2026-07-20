import { useEffect } from 'react';
import { useUIStore } from '@/store/ui.store';
import { cn } from '@/lib/cn';

const TONE_CLASSES = {
  success: 'border-route-green bg-route-green-100 text-route-green-600',
  error: 'border-hazard-red bg-hazard-red-100 text-hazard-red-600',
  info: 'border-asphalt bg-paper text-asphalt',
};

export function ToastViewport() {
  const toasts = useUIStore((state) => state.toasts);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} id={toast.id} type={toast.type} message={toast.message} />
      ))}
    </div>
  );
}

function ToastItem({ id, type, message }: { id: string; type: keyof typeof TONE_CLASSES; message: string }) {
  const dismissToast = useUIStore((state) => state.dismissToast);

  useEffect(() => {
    const timeout = setTimeout(() => dismissToast(id), 5000);
    return () => clearTimeout(timeout);
  }, [id, dismissToast]);

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto max-w-sm rounded-sm border-l-4 bg-paper px-4 py-3 font-mono text-sm shadow-lg',
        TONE_CLASSES[type],
      )}
    >
      {message}
    </div>
  );
}
