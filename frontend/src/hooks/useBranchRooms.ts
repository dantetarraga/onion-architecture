import { useSocketStore } from '@/store/socket.store';
import { useEffect } from 'react';

export function useBranchRooms(branchIds: string[]): void {
  const socket = useSocketStore((state) => state.socket);
  const key = branchIds.join(',');

  useEffect(() => {
    if (!socket || !key) return;
    const ids = key.split(',');
    ids.forEach((branchId) => socket.emit('join:branch', { branchId }));

    return () => {
      ids.forEach((branchId) => socket.emit('leave:branch', { branchId }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, key]);
}
