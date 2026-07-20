import { useSocketStore } from '@/store/socket.store';
import { useEffect, useRef } from 'react';

export function useSocketEvent<T>(event: string, handler: (payload: T) => void): void {
  const socket = useSocketStore((state) => state.socket);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;

    const listener = (payload: T): void => handlerRef.current(payload);
    socket.on(event, listener);

    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
