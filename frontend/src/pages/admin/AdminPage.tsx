import { PageHeader } from '@/components/ui/PageHeader';
import { OccupancySection } from './OccupancySection';
import { RevenueSection } from './RevenueSection';
import { DemoToolsSection } from './DemoToolsSection';

export function AdminPage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Administración"
        title="Panel de operación"
        subtitle="Ocupación por sucursal en tiempo real, reporte de ingresos y herramientas para la demo en vivo."
      />

      <section>
        <h2 className="mb-4 text-xl text-asphalt">Ocupación por sucursal</h2>
        <OccupancySection />
      </section>

      <section>
        <h2 className="mb-4 text-xl text-asphalt">Reporte de ingresos</h2>
        <RevenueSection />
      </section>

      <section>
        <h2 className="mb-4 text-xl text-asphalt">Herramientas de demo</h2>
        <DemoToolsSection />
      </section>
    </div>
  );
}
