import { ArrowRight, RefreshCcw, Save } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import useApiData from '../hooks/useApiData';
import { cambiarEstadoCotizacion, cotizacionesService } from '../services/cotizacionesService';
import { extractApiError } from '../utils/apiErrors';
import { money, serviceText } from '../utils/formatters';

const estadosSeguimiento = ['nuevo', 'contactado', 'confirmado', 'descartado'];

export default function DetalleCotizacion() {
  const { id } = useParams();
  const { data: cotizacion, loading, error, reload } = useApiData(() => cotizacionesService.get(id), null, [id]);
  const [form, setForm] = useState({ estado: 'nuevo', ultimo_contacto: '', notas: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const estadosDisponibles = cotizacion?.tiene_contrato ? ['convertido'] : estadosSeguimiento;

  useEffect(() => {
    if (cotizacion) {
      setForm({
        estado: cotizacion.estado || 'nuevo',
        ultimo_contacto: cotizacion.ultimo_contacto || '',
        notas: cotizacion.notas || '',
      });
    }
  }, [cotizacion]);

  async function handleStatusSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await cambiarEstadoCotizacion(id, form);
      setMessage('Estado actualizado correctamente.');
      await reload();
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo actualizar el estado.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !cotizacion) {
    return <section className="page-stack"><p className="muted">Cargando cotizacion...</p></section>;
  }

  if (error && !cotizacion) {
    return <section className="page-stack"><p className="alert alert-error">{error}</p></section>;
  }

  if (!cotizacion) {
    return <section className="page-stack"><p className="muted">No hay datos disponibles.</p></section>;
  }

  return (
    <section className="page-stack">
      <PageHeader
        title="Detalle de cotizacion"
        description="Informacion completa y seguimiento comercial de la solicitud."
        actions={
          !cotizacion.tiene_contrato ? (
            <Button as={Link} to={`/cotizaciones/${id}/convertir`}><ArrowRight size={18} />Convertir en contrato</Button>
          ) : null
        }
      />
      {message ? <p className={message.includes('correctamente') ? 'alert alert-success' : 'alert alert-error'}>{message}</p> : null}
      <div className="grid-2">
        <article className="panel">
          <h2>Datos del evento</h2>
          <p>Cliente: <strong>{cotizacion.cliente_nombre}</strong></p>
          <p>Telefono: <strong>{cotizacion.cliente_telefono}</strong></p>
          <p>Tipo de evento: <strong>{cotizacion.tipo_evento_nombre}</strong></p>
          <p>Invitados: <strong>{cotizacion.numero_invitados}</strong></p>
          <p>Fecha tentativa: <strong>{cotizacion.fecha_tentativa}</strong></p>
          <p>Servicio: <strong>{serviceText(cotizacion.tipo_servicio)}</strong></p>
          <p>Paquete: <strong>{cotizacion.paquete_nombre || 'No aplica'}</strong></p>
        </article>
        <article className="panel">
          <h2>Seguimiento</h2>
          <p>Monto estimado: <strong>{money(cotizacion.monto_estimado)}</strong></p>
          <p>Estado: <StatusBadge value={cotizacion.estado} /></p>
          <p>Origen: <strong>{cotizacion.notas?.toLowerCase().includes('pre-cotizacion publica') ? 'Pre-cotizacion publica' : 'Administrativo'}</strong></p>
          <p>Ultimo contacto: <strong>{cotizacion.ultimo_contacto || 'Pendiente'}</strong></p>
          <p>Fecha de registro: <strong>{cotizacion.fecha_registro ? String(cotizacion.fecha_registro).slice(0, 10) : 'No registrada'}</strong></p>
          <p>Contrato: <strong>{cotizacion.tiene_contrato ? 'Ya convertido' : 'Pendiente'}</strong></p>
        </article>
      </div>

      <form className="panel form-grid" onSubmit={handleStatusSubmit}>
        <h2><RefreshCcw size={18} /> Actualizar seguimiento</h2>
        <div className="form-grid two">
          <FormField label="Estado">
            <select value={form.estado} disabled={cotizacion.tiene_contrato} onChange={(event) => setForm({ ...form, estado: event.target.value })}>
              {estadosDisponibles.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
            </select>
          </FormField>
          <FormField label="Ultimo contacto">
            <input type="date" value={form.ultimo_contacto} onChange={(event) => setForm({ ...form, ultimo_contacto: event.target.value })} />
          </FormField>
          <FormField label="Notas">
            <textarea value={form.notas} onChange={(event) => setForm({ ...form, notas: event.target.value })} />
          </FormField>
        </div>
        <div className="actions-end">
          <Button type="submit" disabled={saving}><Save size={18} />{saving ? 'Guardando...' : 'Guardar seguimiento'}</Button>
        </div>
      </form>
    </section>
  );
}
