import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency } from '@/lib/format';
import { adminApi } from '@/api/admin.api';
import { branchesApi } from '@/api/branches.api';
import { notifyError } from '@/lib/notify';
import type { Branch, RevenueReportRow } from '@/types/entities';

export function RevenueSection() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<RevenueReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    branchesApi.list().then(setBranches).catch((error) => notifyError(error));
  }, []);

  function loadReport() {
    setLoading(true);
    adminApi
      .revenueReport({
        branchId: branchId || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
      })
      .then(setRows)
      .catch((error) => notifyError(error))
      .finally(() => setLoading(false));
  }

  useEffect(loadReport, []); // eslint-disable-line react-hooks/exhaustive-deps

  const total = rows?.reduce((sum, row) => sum + row.totalRevenue, 0) ?? 0;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-end gap-3">
        <Select label="Sucursal" value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-48">
          <option value="">Todas</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </Select>
        <Input label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="Hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button size="sm" onClick={loadReport} loading={loading}>
          Aplicar
        </Button>
      </div>

      <div className="mt-5 border-t border-dashed border-steel-100 pt-4">
        {!rows ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="font-mono text-[11px] uppercase tracking-wide text-steel">
                <th className="pb-2 font-normal">Sucursal</th>
                <th className="pb-2 text-right font-normal">Ingresos aprobados</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.branch.id} className="border-t border-steel-100/60">
                  <td className="py-2 text-asphalt">{row.branch.name}</td>
                  <td className="py-2 text-right font-mono text-asphalt">{formatCurrency(row.totalRevenue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-asphalt">
                <td className="py-2 font-display uppercase text-asphalt">Total</td>
                <td className="py-2 text-right font-mono font-semibold text-asphalt">{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </Card>
  );
}
