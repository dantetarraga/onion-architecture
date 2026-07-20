import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-asphalt px-4 text-center">
      <p className="font-display text-8xl text-signal-yellow">404</p>
      <p className="max-w-xs font-mono text-sm text-steel-300">
        No hay ninguna cochera con ese código. Revisa la dirección o vuelve al inicio.
      </p>
      <Link to="/sucursales">
        <Button>Volver a sucursales</Button>
      </Link>
    </div>
  );
}
