import {
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Eye,
  FilePlus2,
  Plus,
  Save,
  Search,
  Send,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import DataTable from '../components/tables/DataTable';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import useApiData from '../hooks/useApiData';
import { clientesService } from '../services/clientesService';
import {
  cambiarEstadoCotizacion,
  convertirCotizacionContrato,
  cotizacionesService,
} from '../services/cotizacionesService';
import { eventosService } from '../services/eventosService';
import { paquetesService } from '../services/paquetesService';
import { extractApiError } from '../utils/apiErrors';
import { money } from '../utils/formatters';

const emptyQuoteForm = {
  cliente_nombre: '',
  cliente_telefono: '',
  cliente_correo: '',
  tipo_evento: '',
  fecha_tentativa: '',
  numero_invitados: '',
  tipo_servicio: 'servicio_completo',
  paquete: '',
  monto_estimado: '',
  notas: '',
};

const emptyFilters = {
  search: '',
  estado: 'todos',
  tipoEvento: 'todos',
  fechaCreacion: '',
};

const estadoOptions = [
  { value: 'todos', label: 'Todos' },
  { value: 'nuevas', label: 'Nuevas' },
  { value: 'contactadas', label: 'Contactadas' },
  { value: 'confirmadas', label: 'Confirmadas' },
  { value: 'convertidas', label: 'Convertidas' },
  { value: 'descartadas', label: 'Descartadas' },
];

const serviceOptions = [
  { value: 'servicio_completo', label: 'Servicio completo' },
  { value: 'alquiler', label: 'Solo alquiler' },
  { value: 'no_seguro', label: 'Por definir' },
];

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function hasContract(row) {
  return Boolean(row?.tiene_contrato || row?.contrato_id);
}

function displayStatus(row) {
  return hasContract(row) ? 'convertido' : row?.estado;
}

function serviceText(value) {
  return serviceOptions.find((option) => option.value === value)?.label || value || 'No registrado';
}

function dateKey(value) {
  if (!value) return '';
  const key = String(value).slice(0, 10);
  const parsed = new Date(`${key}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? '' : key;
}

function readableDate(value, fallback = 'Sin fecha') {
  const key = dateKey(value);
  if (!key) return fallback;
  const parsed = new Date(`${key}T00:00:00`);
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function estimatedTotal(value) {
  if (value === null || value === undefined || value === '' || Number(value) <= 0) {
    return 'No calculado';
  }
  return money(value);
}

function clientName(row) {
  return row.cliente_nombre || 'Sin cliente';
}

function contactText(row) {
  return row.cliente_telefono || 'No registrado';
}

function eventName(row) {
  return row.tipo_evento_nombre || 'Sin evento';
}

function guestsText(row) {
  return row.numero_invitados ? row.numero_invitados : 'No definido';
}

function quoteMatchesStatus(row, status) {
  if (status === 'todos') return true;
  if (status === 'convertidas') return hasContract(row);
  if (status === 'confirmadas') return row.estado === 'confirmado' && !hasContract(row);
  if (status === 'nuevas') return row.estado === 'nuevo';
  if (status === 'contactadas') return row.estado === 'contactado';
  if (status === 'descartadas') return row.estado === 'descartado';
  return true;
}

function quoteMatchesSearch(row, search) {
  const term = normalizeText(search);
  if (!term) return true;

  const values = [
    row.cliente_nombre,
    row.cliente_telefono,
    row.tipo_evento_nombre,
    serviceText(row.tipo_servicio),
    row.paquete_nombre,
  ].map(normalizeText);

  return values.some((value) => value.includes(term));
}

function QuoteActions({
  row,
  onChangeStatus,
  onConvert,
  updatingId,
}) {
  const converted = hasContract(row);
  const updating = String(updatingId || '') === String(row.id);
  const canChange = !converted;
  const canConvert = row.estado === 'confirmado' && !converted && row.estado !== 'descartado';

  return (
    <div className="quote-actions">
      <Button as={Link} to={`/cotizaciones/${row.id}`} variant="secondary">
        <Eye size={16} />
        Ver detalle
      </Button>
      <details className="quote-action-menu">
        <summary>
          <span>Acciones</span>
          <ChevronDown size={16} />
        </summary>
        <div>
          <button
            type="button"
            disabled={!canChange || row.estado === 'contactado' || updating}
            onClick={() => onChangeStatus(row, 'contactado')}
          >
            Marcar como contactada
          </button>
          <button
            type="button"
            disabled={!canChange || row.estado === 'confirmado' || updating}
            onClick={() => onChangeStatus(row, 'confirmado')}
          >
            Marcar como confirmada
          </button>
          <button
            type="button"
            disabled={!canChange || row.estado === 'descartado' || updating}
            onClick={() => onChangeStatus(row, 'descartado')}
          >
            Descartar cotización
          </button>
          {canConvert ? (
            <button type="button" disabled={updating} onClick={() => onConvert(row)}>
              Convertir en contrato
            </button>
          ) : null}
          {converted ? (
            <Link to={row.contrato_id ? `/contratos/${row.contrato_id}` : '/contratos'}>
              Ver contrato
            </Link>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, detail, tone }) {
  return (
    <article className={`quote-summary-card quote-summary-${tone}`}>
      <div>
        <span className="quote-summary-icon"><Icon size={18} /></span>
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
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
            <p>{clientName(quote)} - {eventName(quote)}</p>
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

export default function Cotizaciones() {
  const {
    data: cotizaciones,
    loading,
    error,
    reload,
  } = useApiData(() => cotizacionesService.list(), [], []);
  const { data: clientes, reload: reloadClientes } = useApiData(() => clientesService.list(), [], []);
  const { data: eventos } = useApiData(() => eventosService.list(), [], []);
  const { data: paquetes } = useApiData(() => paquetesService.list(), [], []);

  const [filters, setFilters] = useState(emptyFilters);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyQuoteForm);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState('');
  const [conversionTarget, setConversionTarget] = useState(null);
  const [converting, setConverting] = useState(false);

  const tipoEventoOptions = useMemo(() => {
    const map = new Map();
    eventos.forEach((evento) => map.set(String(evento.id), evento.nombre));
    cotizaciones.forEach((quote) => {
      if (quote.tipo_evento && quote.tipo_evento_nombre) {
        map.set(String(quote.tipo_evento), quote.tipo_evento_nombre);
      }
    });
    return Array.from(map, ([id, nombre]) => ({ id, nombre }));
  }, [eventos, cotizaciones]);

  const filteredCotizaciones = useMemo(() => cotizaciones.filter((row) => {
    const matchesSearch = quoteMatchesSearch(row, filters.search);
    const matchesStatus = quoteMatchesStatus(row, filters.estado);
    const matchesEvent = filters.tipoEvento === 'todos' || String(row.tipo_evento || '') === String(filters.tipoEvento);
    const creationDate = dateKey(row.fecha_registro);
    const filterDate = dateKey(filters.fechaCreacion);
    const matchesDate = !filterDate || creationDate === filterDate;

    return matchesSearch && matchesStatus && matchesEvent && matchesDate;
  }), [cotizaciones, filters]);

  const summary = useMemo(() => ({
    nuevas: cotizaciones.filter((item) => item.estado === 'nuevo').length,
    contactadas: cotizaciones.filter((item) => item.estado === 'contactado').length,
    confirmadas: cotizaciones.filter((item) => item.estado === 'confirmado' && !hasContract(item)).length,
    convertidas: cotizaciones.filter((item) => hasContract(item)).length,
  }), [cotizaciones]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'tipo_servicio' && value !== 'servicio_completo' ? { paquete: '' } : {}),
    }));
  }

  function startCreate() {
    setForm(emptyQuoteForm);
    setShowForm(true);
    setMessage('');
  }

  async function handleCreateQuote(event) {
    event.preventDefault();
    setMessage('');

    const nombre = form.cliente_nombre.trim();
    const telefono = form.cliente_telefono.trim();
    const telefonoNormalizado = normalizePhone(telefono);
    const invitados = Number(form.numero_invitados);
    const montoEstimado = form.monto_estimado === '' ? 0 : Number(form.monto_estimado);

    if (!nombre || !telefono) {
      setMessage('Nombre y teléfono del cliente son obligatorios.');
      return;
    }
    if (telefonoNormalizado.length < 7) {
      setMessage('Ingresa un teléfono o WhatsApp válido.');
      return;
    }
    if (!form.tipo_evento) {
      setMessage('Selecciona un tipo de evento.');
      return;
    }
    if (!dateKey(form.fecha_tentativa)) {
      setMessage('Ingresa una fecha tentativa válida.');
      return;
    }
    if (!Number.isFinite(invitados) || invitados <= 0) {
      setMessage('Ingresa una cantidad de invitados mayor a cero.');
      return;
    }
    if (!Number.isFinite(montoEstimado) || montoEstimado < 0) {
      setMessage('El total estimado no puede ser negativo.');
      return;
    }

    setSaving(true);
    try {
      const existingClient = clientes.find((cliente) => normalizePhone(cliente.telefono) === telefonoNormalizado);
      let clienteId = existingClient?.id;

      if (!clienteId) {
        const nuevoCliente = await clientesService.create({
          nombre,
          telefono,
          correo: form.cliente_correo.trim(),
        });
        clienteId = nuevoCliente.id;
      }

      await cotizacionesService.create({
        cliente: clienteId,
        tipo_evento: form.tipo_evento,
        paquete: form.tipo_servicio === 'servicio_completo' && form.paquete ? form.paquete : null,
        fecha_tentativa: form.fecha_tentativa,
        numero_invitados: invitados,
        tipo_servicio: form.tipo_servicio,
        monto_estimado: montoEstimado,
        estado: 'nuevo',
        notas: form.notas.trim(),
      });

      setForm(emptyQuoteForm);
      setShowForm(false);
      setMessage('Cotización guardada correctamente.');
      await Promise.all([reload(), reloadClientes()]);
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo guardar la cotización.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeStatus(row, estado) {
    setMessage('');
    setUpdatingId(row.id);
    try {
      await cambiarEstadoCotizacion(row.id, {
        estado,
        ultimo_contacto: estado === 'contactado' ? new Date().toISOString().slice(0, 10) : row.ultimo_contacto,
        notas: row.notas || '',
      });
      setMessage('Estado de cotización actualizado correctamente.');
      await reload();
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo actualizar el estado de la cotización.'));
    } finally {
      setUpdatingId(null);
    }
  }

  async function confirmConversion() {
    if (!conversionTarget) return;
    setConverting(true);
    setMessage('');
    try {
      await convertirCotizacionContrato(conversionTarget.id, {});
      setMessage('Cotización convertida en contrato correctamente.');
      setConversionTarget(null);
      await reload();
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo convertir la cotización en contrato.'));
    } finally {
      setConverting(false);
    }
  }

  const columns = [
    {
      key: 'cliente',
      label: 'Cliente',
      render: (row) => <span className="quote-cell-main">{clientName(row)}</span>,
    },
    {
      key: 'contacto',
      label: 'Contacto',
      render: (row) => contactText(row),
    },
    {
      key: 'evento',
      label: 'Evento',
      render: (row) => (
        <span className="quote-cell-stack">
          <span className="quote-cell-main">{eventName(row)}</span>
          <span className="quote-cell-sub">{serviceText(row.tipo_servicio)}</span>
        </span>
      ),
    },
    {
      key: 'fecha_tentativa',
      label: 'Fecha tentativa',
      render: (row) => readableDate(row.fecha_tentativa),
    },
    {
      key: 'numero_invitados',
      label: 'Invitados',
      render: (row) => guestsText(row),
    },
    {
      key: 'monto_estimado',
      label: 'Total estimado',
      render: (row) => estimatedTotal(row.monto_estimado),
    },
    {
      key: 'estado',
      label: 'Estado',
      render: (row) => <StatusBadge value={displayStatus(row)} />,
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (row) => (
        <QuoteActions
          row={row}
          updatingId={updatingId}
          onChangeStatus={handleChangeStatus}
          onConvert={setConversionTarget}
        />
      ),
    },
  ];

  return (
    <section className="page-stack cotizaciones-page">
      <PageHeader
        title="Gestión de cotizaciones"
        description="Pipeline comercial de solicitudes recibidas desde pre-cotización o registro administrativo."
        actions={<Button type="button" onClick={startCreate}><Plus size={18} />Nueva cotización</Button>}
      />

      {loading ? <p className="muted">Cargando cotizaciones...</p> : null}
      {error ? <p className="alert alert-error">{error}</p> : null}
      {message ? (
        <p className={message.includes('correctamente') ? 'alert alert-success' : 'alert alert-error'}>
          {message}
        </p>
      ) : null}

      {showForm ? (
        <form className="panel form-grid quote-create-form" onSubmit={handleCreateQuote}>
          <div className="section-card-heading">
            <div>
              <h2>Nueva cotización</h2>
              <p>Registra la solicitud administrativa y déjala lista para seguimiento comercial.</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
          <div className="quote-create-grid">
            <FormField label="Nombre del cliente">
              <input value={form.cliente_nombre} onChange={(event) => updateForm('cliente_nombre', event.target.value)} />
            </FormField>
            <FormField label="Teléfono / WhatsApp">
              <input value={form.cliente_telefono} onChange={(event) => updateForm('cliente_telefono', event.target.value)} />
            </FormField>
            <FormField label="Correo">
              <input type="email" value={form.cliente_correo} onChange={(event) => updateForm('cliente_correo', event.target.value)} />
            </FormField>
            <FormField label="Tipo de evento">
              <select value={form.tipo_evento} onChange={(event) => updateForm('tipo_evento', event.target.value)}>
                <option value="">Seleccionar</option>
                {eventos.map((evento) => (
                  <option key={evento.id} value={evento.id}>{evento.nombre}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Fecha tentativa">
              <input type="date" value={form.fecha_tentativa} onChange={(event) => updateForm('fecha_tentativa', event.target.value)} />
            </FormField>
            <FormField label="Invitados aproximados">
              <input type="number" min="1" value={form.numero_invitados} onChange={(event) => updateForm('numero_invitados', event.target.value)} />
            </FormField>
            <FormField label="Servicio solicitado">
              <select value={form.tipo_servicio} onChange={(event) => updateForm('tipo_servicio', event.target.value)}>
                {serviceOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Paquete seleccionado">
              <select
                value={form.paquete}
                disabled={form.tipo_servicio !== 'servicio_completo'}
                onChange={(event) => updateForm('paquete', event.target.value)}
              >
                <option value="">No aplica</option>
                {paquetes.map((paquete) => (
                  <option key={paquete.id} value={paquete.id}>{paquete.nombre}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Total estimado">
              <input type="number" min="0" step="0.01" value={form.monto_estimado} onChange={(event) => updateForm('monto_estimado', event.target.value)} />
            </FormField>
            <FormField label="Notas">
              <textarea value={form.notas} onChange={(event) => updateForm('notas', event.target.value)} />
            </FormField>
          </div>
          <div className="actions-end">
            <Button type="submit" disabled={saving}><Save size={18} />{saving ? 'Guardando...' : 'Guardar cotización'}</Button>
          </div>
        </form>
      ) : null}

      <div className="quote-summary-grid">
        <SummaryCard icon={FilePlus2} label="Nuevas" value={summary.nuevas} detail="Sin gestionar" tone="new" />
        <SummaryCard icon={Send} label="Contactadas" value={summary.contactadas} detail="En seguimiento" tone="contacted" />
        <SummaryCard icon={CheckCircle2} label="Confirmadas" value={summary.confirmadas} detail="Listas para contrato" tone="confirmed" />
        <SummaryCard icon={ClipboardCheck} label="Convertidas" value={summary.convertidas} detail="Ya tienen contrato" tone="converted" />
      </div>

      <article className="panel quote-filter-card">
        <div className="quote-filter-grid">
          <FormField label="Buscar">
            <div className="quote-search-input">
              <Search size={18} />
              <input
                value={filters.search}
                placeholder="Buscar por cliente, evento o teléfono..."
                onChange={(event) => updateFilter('search', event.target.value)}
              />
            </div>
          </FormField>
          <FormField label="Estado">
            <select value={filters.estado} onChange={(event) => updateFilter('estado', event.target.value)}>
              {estadoOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Tipo de evento">
            <select value={filters.tipoEvento} onChange={(event) => updateFilter('tipoEvento', event.target.value)}>
              <option value="todos">Todos</option>
              {tipoEventoOptions.map((evento) => (
                <option key={evento.id} value={evento.id}>{evento.nombre}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Fecha de creación">
            <input type="date" value={filters.fechaCreacion} onChange={(event) => updateFilter('fechaCreacion', event.target.value)} />
          </FormField>
        </div>
      </article>

      <div className="quote-table-desktop">
        <DataTable
          columns={columns}
          emptyMessage="No hay cotizaciones con estos filtros."
          rows={filteredCotizaciones}
        />
      </div>

      <div className="quote-mobile-list">
        {filteredCotizaciones.length === 0 ? (
          <p className="empty-state">No hay cotizaciones con estos filtros.</p>
        ) : filteredCotizaciones.map((row) => (
          <article className="quote-mobile-card" key={row.id}>
            <header>
              <div>
                <span>Cliente</span>
                <strong>{clientName(row)}</strong>
                <small>{contactText(row)}</small>
              </div>
              <StatusBadge value={displayStatus(row)} />
            </header>
            <div className="quote-mobile-grid">
              <div>
                <span>Evento</span>
                <strong>{eventName(row)}</strong>
                <small>{serviceText(row.tipo_servicio)}</small>
              </div>
              <div>
                <span>Fecha tentativa</span>
                <strong>{readableDate(row.fecha_tentativa)}</strong>
              </div>
              <div>
                <span>Invitados</span>
                <strong>{guestsText(row)}</strong>
              </div>
              <div>
                <span>Total estimado</span>
                <strong>{estimatedTotal(row.monto_estimado)}</strong>
              </div>
            </div>
            <QuoteActions
              row={row}
              updatingId={updatingId}
              onChangeStatus={handleChangeStatus}
              onConvert={setConversionTarget}
            />
          </article>
        ))}
      </div>

      <ConfirmConvertModal
        quote={conversionTarget}
        saving={converting}
        onCancel={() => setConversionTarget(null)}
        onConfirm={confirmConversion}
      />
    </section>
  );
}
