import { Eye, FilePlus2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import DataTable from '../components/tables/DataTable';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import useApiData from '../hooks/useApiData';
import { cotizacionesService } from '../services/cotizacionesService';
import { money, serviceText } from '../utils/formatters';

export default function Cotizaciones() {
  const { data: cotizaciones, loading, error } = useApiData(() => cotizacionesService.list(), [], []);
  const nuevas = cotizaciones.filter((item) => item.estado === 'nuevo').length;
  const seguimiento = cotizaciones.filter((item) => item.estado === 'contactado').length;
  const confirmadas = cotizaciones.filter((item) => item.estado === 'confirmado').length;
  const convertidas = cotizaciones.filter((item) => item.estado === 'convertido').length;

  return (
    <section className="page-stack">
      <PageHeader
        title="Gestion de cotizaciones"
        description="Pipeline comercial de solicitudes recibidas desde pre-cotizacion o registro administrativo."
        actions={<Button as={Link} to="/pre-cotizacion"><FilePlus2 size={18} />Abrir pre-cotizacion publica</Button>}
      />
      {loading ? <p className="muted">Cargando cotizaciones...</p> : null}
      {error ? <p className="alert alert-error">{error}</p> : null}
      <DataTable
        columns={[
          { key: 'cliente_nombre', label: 'Cliente' },
          { key: 'cliente_telefono', label: 'Telefono' },
          { key: 'tipo_evento_nombre', label: 'Evento' },
          { key: 'fecha_tentativa', label: 'Fecha tentativa' },
          { key: 'numero_invitados', label: 'Invitados' },
          { key: 'tipo_servicio', label: 'Servicio', render: (row) => serviceText(row.tipo_servicio) },
          { key: 'paquete_nombre', label: 'Paquete', render: (row) => row.paquete_nombre || 'No aplica' },
          { key: 'monto_estimado', label: 'Estimado', render: (row) => money(row.monto_estimado) },
          { key: 'estado', label: 'Estado', render: (row) => <StatusBadge value={row.estado} /> },
          { key: 'origen', label: 'Origen', render: (row) => row.notas?.toLowerCase().includes('pre-cotizacion publica') ? 'Pre-cotizacion publica' : 'Administrativo' },
          { key: 'acciones', label: 'Acciones', render: (row) => <Button as={Link} to={`/cotizaciones/${row.id}`} variant="secondary"><Eye size={16} />Detalle</Button> },
        ]}
        emptyMessage="No hay registros disponibles."
        rows={cotizaciones}
      />
      <div className="grid-4">
        <article className="panel"><h2>Total</h2><strong>{cotizaciones.length}</strong></article>
        <article className="panel"><h2>Nuevas</h2><strong>{nuevas}</strong></article>
        <article className="panel"><h2>Seguimiento</h2><strong>{seguimiento}</strong></article>
        <article className="panel"><h2>Confirmadas</h2><strong>{confirmadas}</strong></article>
        <article className="panel"><h2>Convertidas</h2><strong>{convertidas}</strong></article>
      </div>
    </section>
  );
}
