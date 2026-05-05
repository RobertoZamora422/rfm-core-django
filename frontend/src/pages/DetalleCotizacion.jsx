import { ArrowLeft, ArrowRight, Eye, RefreshCcw, Save, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import useApiData from '../hooks/useApiData';
import {
  cambiarEstadoCotizacion,
  convertirCotizacionContrato,
  cotizacionesService,
} from '../services/cotizacionesService';
import { extractApiError } from '../utils/apiErrors';
import { money } from '../utils/formatters';

const estadosSeguimiento = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'contactado', label: 'Contactado' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'descartado', label: 'Descartado' },
];

function hasContract(cotizacion) {
  return Boolean(cotizacion?.tiene_contrato || cotizacion?.contrato_id);
}

function displayStatus(cotizacion) {
  return hasContract(cotizacion) ? 'convertido' : cotizacion?.estado;
}

function serviceText(value) {
  const labels = {
    servicio_completo: 'Servicio completo',
    alquiler: 'Solo alquiler',
    no_seguro: 'Por definir',
  };
  return labels[value] || value || 'No registrado';
}

function dateKey(value) {
  if (!value) return '';
  const key = String(value).slice(0, 10);
  const parsed = new Date(`${key}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? '' : key;
}

function readableDate(value, fallback = 'No registrada') {
  const key = dateKey(value);
  if (!key) return fallback;
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${key}T00:00:00`));
}

function estimatedTotal(value) {
  if (value === null || value === undefined || value === '' || Number(value) <= 0) {
    return 'No calculado';
  }
  return money(value);
}

function DetailRow({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ConfirmConvertModal({ quote, saving, onCancel, onConfirm }) {
  if (!quote) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <aside className="modal-panel quote-confirm-modal" aria-modal="true" role="dialog">
        <div className="modal-header">
          <div>
            <h2>Convertir en contrato</h2>
            <p>{quote.cliente_nombre || 'Sin cliente'} - {quote.tipo_evento_nombre || 'Sin evento'}</p>
          </div>
          <button type="button" className="icon-button" aria-label="Cerrar confirmación" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>
        <div className="quote-confirm-body">
          <p>¿Deseas convertir esta cotización en contrato?</p>
          <div className="inline-actions">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={onConfirm} disabled={saving}>
              {saving ? 'Convirtiendo...' : 'Convertir'}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function DetalleCotizacion() {
  const { id } = useParams();
  const { data: cotizacion, loading, error, reload } = useApiData(() => cotizacionesService.get(id), null, [id]);
  const [form, setForm] = useState({ estado: 'nuevo', ultimo_contacto: '', notas: '' });
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState('');

  const converted = hasContract(cotizacion);
  const canConvert = cotizacion?.estado === 'confirmado' && !converted;
  const estadosDisponibles = converted ? [{ value: 'convertido', label: 'Convertido' }] : estadosSeguimiento;

  useEffect(() => {
    if (cotizacion) {
      setForm({
        estado: displayStatus(cotizacion) || 'nuevo',
        ultimo_contacto: cotizacion.ultimo_contacto || '',
        notas: cotizacion.notas || '',
      });
    }
  }, [cotizacion]);

  async function handleStatusSubmit(event) {
    event.preventDefault();
    if (converted) return;

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

  async function handleConvert() {
    setConverting(true);
    setMessage('');
    try {
      await convertirCotizacionContrato(id, {});
      setMessage('Cotización convertida en contrato correctamente.');
      setShowConfirm(false);
      await reload();
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo convertir la cotización en contrato.'));
    } finally {
      setConverting(false);
    }
  }

  if (loading && !cotizacion) {
    return <section className="page-stack"><p className="muted">Cargando cotización...</p></section>;
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
        title={`Detalle de cotización #${cotizacion.id}`}
        description="Información completa y seguimiento comercial de la solicitud."
        actions={<Button as={Link} to="/cotizaciones" variant="secondary"><ArrowLeft size={18} />Volver a cotizaciones</Button>}
      />

      {message ? <p className={message.includes('correctamente') ? 'alert alert-success' : 'alert alert-error'}>{message}</p> : null}

      <div className="contract-detail-grid">
        <article className="panel detail-panel">
          <h2>Datos del cliente</h2>
          <dl className="detail-list">
            <DetailRow label="Nombre">{cotizacion.cliente_nombre || 'Sin cliente'}</DetailRow>
            <DetailRow label="Teléfono / WhatsApp">{cotizacion.cliente_telefono || 'No registrado'}</DetailRow>
            <DetailRow label="Fecha de registro">{readableDate(cotizacion.cliente_fecha_registro)}</DetailRow>
          </dl>
        </article>

        <article className="panel detail-panel">
          <h2>Datos del evento</h2>
          <dl className="detail-list">
            <DetailRow label="Tipo de evento">{cotizacion.tipo_evento_nombre || 'Sin evento'}</DetailRow>
            <DetailRow label="Fecha tentativa">{readableDate(cotizacion.fecha_tentativa, 'Sin fecha')}</DetailRow>
            <DetailRow label="Invitados">{cotizacion.numero_invitados || 'No definido'}</DetailRow>
            <DetailRow label="Servicio solicitado">{serviceText(cotizacion.tipo_servicio)}</DetailRow>
            <DetailRow label="Paquete seleccionado">{cotizacion.paquete_nombre || 'No aplica'}</DetailRow>
          </dl>
        </article>

        <article className="panel detail-panel">
          <h2>Cotización</h2>
          <dl className="detail-list">
            <DetailRow label="Total estimado">{estimatedTotal(cotizacion.monto_estimado)}</DetailRow>
            <DetailRow label="Fecha de creación">{readableDate(cotizacion.fecha_registro)}</DetailRow>
            <DetailRow label="Origen">
              {cotizacion.notas?.toLowerCase().includes('pre-cotizacion publica') ? 'Pre-cotización pública' : 'Administrativo'}
            </DetailRow>
          </dl>
        </article>

        <article className="panel detail-panel quote-followup-panel">
          <h2>Seguimiento comercial</h2>
          <dl className="detail-list">
            <DetailRow label="Estado actual"><StatusBadge value={displayStatus(cotizacion)} /></DetailRow>
            <DetailRow label="Último contacto">{readableDate(cotizacion.ultimo_contacto, 'Pendiente')}</DetailRow>
            <DetailRow label="Contrato">{converted ? 'Contrato generado' : 'Pendiente'}</DetailRow>
          </dl>
          <div className="inline-actions">
            {canConvert ? (
              <Button type="button" onClick={() => setShowConfirm(true)}>
                <ArrowRight size={18} />
                Convertir en contrato
              </Button>
            ) : null}
            {converted ? (
              <Button as={Link} to={cotizacion.contrato_id ? `/contratos/${cotizacion.contrato_id}` : '/contratos'} variant="secondary">
                <Eye size={18} />
                Ver contrato
              </Button>
            ) : null}
          </div>
        </article>
      </div>

      <form className="panel form-grid" onSubmit={handleStatusSubmit}>
        <h2><RefreshCcw size={18} /> Actualizar seguimiento</h2>
        <div className="form-grid two">
          <FormField label="Estado">
            <select
              value={form.estado}
              disabled={converted}
              onChange={(event) => setForm({ ...form, estado: event.target.value })}
            >
              {estadosDisponibles.map((estado) => (
                <option key={estado.value} value={estado.value}>{estado.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Último contacto">
            <input
              type="date"
              value={form.ultimo_contacto}
              disabled={converted}
              onChange={(event) => setForm({ ...form, ultimo_contacto: event.target.value })}
            />
          </FormField>
          <FormField label="Notas">
            <textarea
              value={form.notas}
              disabled={converted}
              onChange={(event) => setForm({ ...form, notas: event.target.value })}
            />
          </FormField>
        </div>
        <div className="actions-end">
          <Button type="submit" disabled={saving || converted}>
            <Save size={18} />
            {saving ? 'Guardando...' : converted ? 'Seguimiento bloqueado' : 'Guardar seguimiento'}
          </Button>
        </div>
      </form>

      <ConfirmConvertModal
        quote={showConfirm ? cotizacion : null}
        saving={converting}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleConvert}
      />
    </section>
  );
}
