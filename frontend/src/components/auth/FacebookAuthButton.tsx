import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { authApi } from '@/api/auth.api';
import { signInWithFacebook } from '@/lib/facebook';
import { notifyError } from '@/lib/notify';
import { useAuthStore } from '@/store/auth.store';

export function FacebookAuthButton() {
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();
  const location = useLocation();

  async function handleClick() {
    setLoading(true);
    try {
      const accessToken = await signInWithFacebook();
      const result = await authApi.loginWithFacebook(accessToken);
      setAuth(result.accessToken, result.user);
      const from = (location.state as { from?: string } | null)?.from ?? '/sucursales';
      navigate(from, { replace: true });
    } catch (error) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      loading={loading}
      className="w-full"
      icon={<FacebookIcon />}
      onClick={handleClick}
    >
      Continuar con Facebook
    </Button>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M18 9a9 9 0 1 0-10.41 8.89v-6.29H5.31V9h2.28V7.02c0-2.25 1.34-3.5 3.4-3.5.98 0 2.01.18 2.01.18v2.21h-1.13c-1.12 0-1.47.69-1.47 1.4V9h2.5l-.4 2.6h-2.1v6.29A9 9 0 0 0 18 9Z"
      />
    </svg>
  );
}
