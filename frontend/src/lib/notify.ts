import { useUIStore } from '@/store/ui.store';

export function notifyError(error: unknown): void {
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  useUIStore.getState().pushToast('error', message);
}

export function notifySuccess(message: string): void {
  useUIStore.getState().pushToast('success', message);
}
