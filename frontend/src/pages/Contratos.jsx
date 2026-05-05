import { Eye } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import DataTable from '../components/tables/DataTable';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import useApiData from '../hooks/useApiData';
import { contratosService } from '../services/contratosService';
import { money, percent } from '../utils/formatters';

export default function Contratos() {
  const [searchParams] = useSearchParams();
  const desde = searchParams.get('desde');
  const { data: contratos, loading, error } = useApiData(() => contratosService.list(), [], []);
  const rows = desde ? contratos.filter((contrato) => contrato.fecha_evento >= desde) : contratos;

  return (
    <section className="page-stack">
      <PageHeader
        title="Contratos"
        description={desde ? `Contratos con fecha de evento desde ${desde}.` : 'Ventas cerradas, valores finales y rentabilidad bruta por evento.'}
      />
      {loading ? <p className="muted">Cargando contratos...</p> : null}
      {error ? <p className="alert alert-error">{error}</p> : null}
      <DataTable
        columns={[
          { key: 'cliente_nombre', label: 'Cliente' },
          { key: 'cliente_telefono', label: 'Telefono' },
          { key: 'evento_nombre', label: 'Evento' },
          { key: 'paquete_nombre', label: 'Paquete', render: (row) => row.paquete_nombre || 'No aplica' },
          { key: 'fecha_evento', label: 'Fecha del evento' },
          { key: 'valor_final', label: 'Valor final', render: (row) => money(row.valor_final) },
          { key: 'estado_contrato', label: 'Contrato', render: (row) => <StatusBadge value={row.estado_contrato} /> },
          { key: 'estado_pago', label: 'Pago', render: (row) => <StatusBadge value={row.estado_pago} /> },
          { key: 'monto_abonado', label: 'Abonado', render: (row) => money(row.monto_abonado) },
          { key: 'saldo_pendiente', label: 'Saldo', render: (row) => money(row.saldo_pendiente) },
          { key: 'observaciones', label: 'Observaciones', render: (row) => row.observaciones || 'Sin observaciones' },
          { key: 'fecha_registro', label: 'Registro', render: (row) => row.fecha_registro ? String(row.fecha_registro).slice(0, 10) : 'No registrado' },
          { key: 'total_costos_directos', label: 'Costos directos', render: (row) => money(row.total_costos_directos) },
          { key: 'utilidad_bruta', label: 'Utilidad bruta', render: (row) => money(row.utilidad_bruta) },
          { key: 'margen_bruto', label: 'Margen bruto', render: (row) => percent(row.margen_bruto) },
          { key: 'acciones', label: 'Acciones', render: (row) => <Button as={Link} to={`/contratos/${row.id}`} variant="secondary"><Eye size={16} />Detalle</Button> },
        ]}
        emptyMessage="No hay registros disponibles."
        rows={rows}
      />
    </section>
  );
}
