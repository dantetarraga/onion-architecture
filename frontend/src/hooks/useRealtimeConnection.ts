import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';
import { useSocketStore } from '@/store/socket.store';
import { useEffect } from 'react';

export function useRealtimeConnection(): void {
  const token = useAuthStore((state) => state.token);
  const setSocket = useSocketStore((state) => state.setSocket);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      setSocket(null);
      return;
    }

    const socket = connectSocket(token);
    setSocket(socket);

    return () => {
      disconnectSocket();
      setSocket(null);
    };
  }, [token, setSocket]);
}
