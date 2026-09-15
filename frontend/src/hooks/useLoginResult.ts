import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LoginResult } from '@/api/auth.api';
import { useAuthStore } from '@/store/auth.store';

/**
 * Cierre comun de todos los botones de login (password, Google, Facebook):
 * si el backend devolvio la sesion, la guarda y redirige a donde iba el
 * usuario; si devolvio un desafio MFA, lo lleva a /mfa con el token en el
 * state de la navegacion (nunca en la URL ni en localStorage).
 */
export function useLoginResult() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (result: LoginResult) => {
      const from = (location.state as { from?: string } | null)?.from ?? '/sucursales';
      if (result.mfaRequired) {
        navigate('/mfa', { state: { mfaToken: result.mfaToken, from } });
        return;
      }
      setAuth(result.accessToken, result.user);
      navigate(from, { replace: true });
    },
    [location.state, navigate, setAuth],
  );
}
