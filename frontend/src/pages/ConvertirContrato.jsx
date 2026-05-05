import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import PageHeader from '../components/ui/PageHeader';
import useApiData from '../hooks/useApiData';
import { convertirCotizacionContrato, cotizacionesService } from '../services/cotizacionesService';
import { extractApiError } from '../utils/apiErrors';
import { money } from '../utils/formatters';

export default function ConvertirContrato() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: cotizacion, loading, error } = useApiData(() => cotizacionesService.get(id), null, [id]);
  const [form, setForm] = useState({
    valor_final: '',
    fecha_evento: '',
    estado_contrato: 'confirmado',
    estado_pago: 'pendiente',
    monto_abonado: '',
    observaciones: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (cotizacion) {
      setForm((current) => ({
        ...current,
        valor_final: cotizacion.monto_estimado || '',
        fecha_evento: cotizacion.fecha_tentativa || '',
      }));
    }
  }, [cotizacion]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    if (!form.fecha_evento || Number(form.valor_final) <= 0) {
      setMessage('Fecha del evento y valor final mayor a cero son obligatorios.');
      return;
    }
    if (form.estado_pago === 'abonado' && (Number(form.monto_abonado) <= 0 || Number(form.monto_abonado) >= Number(form.valor_final))) {
      setMessage('Para marcar como abonado, registra un monto mayor a cero y menor al valor final.');
      return;
    }
    setSaving(true);
    try {
      await convertirCotizacionContrato(id, {
        ...form,
        valor_final: Number(form.valor_final),
        monto_abonado: form.estado_pago === 'pagado'
          ? Number(form.valor_final)
          : form.estado_pago === 'pendiente'
            ? 0
            : Number(form.monto_abonado),
      });
      navigate('/contratos');
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo convertir la cotizacion en contrato.'));
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

  if (cotizacion.tiene_contrato) {
    return (
      <section className="page-stack">
        <PageHeader title="Convertir en contrato" description="Esta cotizacion ya fue convertida." />
        <article className="panel page-stack">
          <p>La cotizacion #{cotizacion.id} ya tiene un contrato asociado. No se creara un contrato duplicado.</p>
          <Button as={Link} to="/contratos" variant="secondary">Ver contratos</Button>
        </article>
      </section>
    );
  }

  return (
    <section className="page-stack">
      <PageHeader title="Convertir en contrato" description="Registro del valor real negociado y estado administrativo de pago." />
      {message ? <p className="alert alert-error">{message}</p> : null}
      <form className="panel form-grid" onSubmit={handleSubmit}>
        <div className="grid-2">
          <p>Cliente: <strong>{cotizacion.cliente_nombre}</strong></p>
          <p>Evento: <strong>{cotizacion.tipo_evento_nombre}</strong></p>
          <p>Monto estimado: <strong>{money(cotizacion.monto_estimado)}</strong></p>
          <p>Diferencia actual: <strong>{money(Number(form.valor_final || 0) - Number(cotizacion.monto_estimado || 0))}</strong></p>
        </div>
        <div className="form-grid two">
          <FormField label="Valor final del contrato">
            <input type="number" min="0" step="0.01" value={form.valor_final} onChange={(event) => setForm({ ...form, valor_final: event.target.value })} />
          </FormField>
          <FormField label="Fecha del evento">
            <input type="date" value={form.fecha_evento} onChange={(event) => setForm({ ...form, fecha_evento: event.target.value })} />
          </FormField>
          <FormField label="Estado del contrato">
            <select value={form.estado_contrato} onChange={(event) => setForm({ ...form, estado_contrato: event.target.value })}>
              <option value="confirmado">Confirmado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </FormField>
          <FormField label="Estado de pago">
            <select value={form.estado_pago} onChange={(event) => setForm({ ...form, estado_pago: event.target.value })}>
              <option value="pendiente">Pendiente</option>
              <option value="abonado">Abonado</option>
              <option value="pagado">Pagado</option>
            </select>
          </FormField>
          {form.estado_pago === 'abonado' ? (
            <FormField label="Monto abonado">
              <input type="number" min="0" step="0.01" value={form.monto_abonado} onChange={(event) => setForm({ ...form, monto_abonado: event.target.value })} />
            </FormField>
          ) : null}
          <FormField label="Observaciones">
            <textarea value={form.observaciones} onChange={(event) => setForm({ ...form, observaciones: event.target.value })} />
          </FormField>
        </div>
        <div className="actions-end">
          <Button type="submit" disabled={saving}><Save size={18} />{saving ? 'Guardando...' : 'Guardar contrato'}</Button>
        </div>
      </form>
    </section>
  );
}
