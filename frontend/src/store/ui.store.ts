import { create } from 'zustand';
import { generateId } from '@/lib/id';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface UIState {
  toasts: Toast[];
  pushToast: (type: Toast['type'], message: string) => void;
  dismissToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  pushToast: (type, message) =>
    set((state) => ({ toasts: [...state.toasts, { id: generateId(), type, message }] })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
