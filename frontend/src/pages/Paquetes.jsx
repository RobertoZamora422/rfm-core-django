import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Eye, Pencil, Plus, Power, Save, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import useApiData from '../hooks/useApiData';
import { obtenerDesempenoPaquetes, paquetesService } from '../services/paquetesService';
import { extractApiError } from '../utils/apiErrors';
import { money, percent, serviceText } from '../utils/formatters';

const emptyForm = {
  nombre: '',
  descripcion: '',
  precio_por_persona: '',
  tipo_servicio: 'Servicio completo',
  activo: true,
};

const emptyPerformance = {
  cotizaciones: 0,
  contratos: 0,
  contratos_confirmados: 0,
  eventos_realizados: 0,
  conversion: 0,
  ingresos: 0,
  utilidad: 0,
  margen: 0,
};

function normalizePerformance(item = {}) {
  const contratosConfirmados = Number(item.contratos_confirmados ?? item.contratos ?? 0);

  return {
    id: item.id,
    nombre: item.nombre || 'Sin nombre',
    cotizaciones: Number(item.cotizaciones || 0),
    contratos: Number(item.contratos ?? contratosConfirmados),
    contratos_confirmados: contratosConfirmados,
    eventos_realizados: Number(item.eventos_realizados || 0),
    conversion: Number(item.conversion || 0),
    ingresos: Number(item.ingresos || 0),
    utilidad: Number(item.utilidad || 0),
    margen: Number(item.margen || 0),
  };
}

function hasUsefulPerformance(rows) {
  return rows.some((row) => (
    row.cotizaciones > 0
    || row.contratos_confirmados > 0
    || row.ingresos > 0
    || row.utilidad !== 0
  ));
}

function SectionHeading({ title, subtitle }) {
  return (
    <div className="section-card-heading">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </div>
  );
}

function EmptyState({ children, action }) {
  return (
    <div className="empty-state package-empty-state">
      <span>{children}</span>
      {action}
    </div>
  );
}

function DetailRow({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function MetricTile({ label, value }) {
  return (
    <article className="package-detail-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function PackageActions({ row, onView, onEdit, onToggle, updatingId }) {
  const updating = String(updatingId || '') === String(row.id);

  return (
    <div className="inline-actions package-actions">
      <Button type="button" variant="secondary" onClick={() => onView(row)}>
        <Eye size={16} />
        Ver detalle
      </Button>
      <Button type="button" variant="secondary" onClick={() => onEdit(row)}>
        <Pencil size={16} />
        Editar
      </Button>
      <Button type="button" variant="ghost" onClick={() => onToggle(row)} disabled={updating}>
        <Power size={16} />
        {updating ? 'Actualizando' : row.activo ? 'Desactivar' : 'Activar'}
      </Button>
    </div>
  );
}

function PackageDetailModal({ paquete, performance, performanceError, onClose }) {
  if (!paquete) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="modal-panel package-detail-modal" aria-modal="true" role="dialog" aria-labelledby="package-detail-title">
        <div className="modal-header">
          <div>
            <h2 id="package-detail-title">Detalle del paquete</h2>
            <p>{paquete.nombre}</p>
          </div>
          <button type="button" className="icon-button" aria-label="Cerrar detalle" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="package-detail-sections">
          <section className="package-detail-section">
            <h3>Información del paquete</h3>
            <dl className="detail-list">
              <DetailRow label="Nombre">{paquete.nombre}</DetailRow>
              <DetailRow label="Descripción">{paquete.descripcion || 'No registrada'}</DetailRow>
              <DetailRow label="Precio por persona">{money(paquete.precio_por_persona)}</DetailRow>
              <DetailRow label="Tipo de servicio">{serviceText(paquete.tipo_servicio)}</DetailRow>
              <DetailRow label="Estado"><StatusBadge value={paquete.activo ? 'activo' : 'inactivo'} /></DetailRow>
            </dl>
          </section>

          <section className="package-detail-section">
            <h3>Desempeño del paquete</h3>
            {performanceError ? (
              <p className="alert alert-error">No se pudo cargar el desempeño de paquetes.</p>
            ) : (
              <div className="package-detail-metrics">
                <MetricTile label="Cotizaciones" value={performance.cotizaciones} />
                <MetricTile label="Contratos confirmados" value={performance.contratos_confirmados} />
                <MetricTile label="Eventos realizados" value={performance.eventos_realizados} />
                <MetricTile label="Conversión" value={percent(performance.conversion)} />
                <MetricTile label="Ingresos" value={money(performance.ingresos)} />
                <MetricTile label="Utilidad" value={money(performance.utilidad)} />
                <MetricTile label="Margen" value={percent(performance.margen)} />
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

export default function Paquetes() {
  const {
    data: paquetes,
    loading: loadingPaquetes,
    error: paquetesError,
    reload,
  } = useApiData(() => paquetesService.list(), [], []);
  const {
    data: desempeno,
    loading: loadingDesempeno,
    error: desempenoError,
    reload: reloadDesempeno,
  } = useApiData(() => obtenerDesempenoPaquetes(), [], []);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState('');

  const performanceRows = useMemo(() => desempeno.map(normalizePerformance), [desempeno]);
  const performanceByPackage = useMemo(() => new Map(
    performanceRows.map((item) => [String(item.id), item]),
  ), [performanceRows]);
  const selectedPerformance = selectedPackage
    ? performanceByPackage.get(String(selectedPackage.id)) || emptyPerformance
    : emptyPerformance;
  const hasPerformanceData = hasUsefulPerformance(performanceRows);
  const hasContractChartData = performanceRows.some((row) => row.contratos > 0);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage('');
  }

  function startEdit(row) {
    setEditingId(row.id);
    setForm({
      nombre: row.nombre || '',
      descripcion: row.descripcion || '',
      precio_por_persona: row.precio_por_persona || '',
      tipo_servicio: row.tipo_servicio || 'Servicio completo',
      activo: Boolean(row.activo),
    });
    setSelectedPackage(null);
    setShowForm(true);
    setMessage('');
  }

  async function refresh() {
    await Promise.all([reload(), reloadDesempeno()]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    if (!form.nombre.trim() || Number(form.precio_por_persona) <= 0) {
      setMessage('Nombre y precio por persona mayor a cero son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, precio_por_persona: Number(form.precio_por_persona) };
      if (editingId) {
        await paquetesService.update(editingId, payload);
      } else {
        await paquetesService.create(payload);
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      setMessage('Paquete guardado correctamente.');
      await refresh();
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo guardar el paquete.'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row) {
    setMessage('');
    setUpdatingId(row.id);
    try {
      const { id, ...payload } = row;
      await paquetesService.update(id, { ...payload, activo: !row.activo });
      setMessage('Estado del paquete actualizado correctamente.');
      await refresh();
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo actualizar el estado del paquete.'));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="page-stack paquetes-page">
      <PageHeader
        title="Gestión de paquetes"
        description="Administra la oferta comercial y analiza el desempeño por paquete"
        actions={<Button type="button" onClick={startCreate}><Plus size={18} />Nuevo paquete</Button>}
      />

      {message ? (
        <p className={message.includes('correctamente') || message.includes('actualizado') ? 'alert alert-success' : 'alert alert-error'}>
          {message}
        </p>
      ) : null}
      {saving ? <p className="muted">Guardando paquete.</p> : null}
      {updatingId ? <p className="muted">Actualizando estado.</p> : null}

      {showForm ? (
        <form className="panel form-grid" onSubmit={handleSubmit}>
          <h2>{editingId ? 'Editar paquete' : 'Nuevo paquete'}</h2>
          <div className="form-grid two">
            <FormField label="Nombre">
              <input value={form.nombre} onChange={(event) => update('nombre', event.target.value)} />
            </FormField>
            <FormField label="Precio por persona">
              <input type="number" min="0" step="0.01" value={form.precio_por_persona} onChange={(event) => update('precio_por_persona', event.target.value)} />
            </FormField>
            <FormField label="Tipo de servicio">
              <input value={form.tipo_servicio} onChange={(event) => update('tipo_servicio', event.target.value)} />
            </FormField>
            <FormField label="Activo">
              <select value={form.activo ? 'true' : 'false'} onChange={(event) => update('activo', event.target.value === 'true')}>
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </FormField>
            <FormField label="Descripción">
              <textarea value={form.descripcion} onChange={(event) => update('descripcion', event.target.value)} />
            </FormField>
          </div>
          <div className="inline-actions">
            <Button type="submit" disabled={saving}><Save size={18} />{saving ? 'Guardando paquete...' : 'Guardar paquete'}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </form>
      ) : null}

      <article className="panel package-card">
        <SectionHeading
          title="Paquetes registrados"
          subtitle="Gestiona precios, estado y disponibilidad para cotizaciones"
        />

        {loadingPaquetes ? <p className="muted">Cargando paquetes.</p> : null}
        {paquetesError ? <p className="alert alert-error">No se pudieron cargar los paquetes.</p> : null}

        {!loadingPaquetes && !paquetesError && paquetes.length === 0 ? (
          <EmptyState action={<Button type="button" onClick={startCreate}>Crear primer paquete</Button>}>
            No hay paquetes registrados todavía.
          </EmptyState>
        ) : null}

        {!loadingPaquetes && !paquetesError && paquetes.length > 0 ? (
          <>
            <div className="package-table-wrap">
              <table className="data-table package-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Precio p/p</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paquetes.map((row) => (
                    <tr key={row.id}>
                      <td>{row.nombre}</td>
                      <td>{money(row.precio_por_persona)}</td>
                      <td><StatusBadge value={row.activo ? 'activo' : 'inactivo'} /></td>
                      <td>
                        <PackageActions
                          row={row}
                          onView={setSelectedPackage}
                          onEdit={startEdit}
                          onToggle={toggleActive}
                          updatingId={updatingId}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="package-mobile-list">
              {paquetes.map((row) => (
                <article className="package-mobile-card" key={row.id}>
                  <div>
                    <span>Nombre</span>
                    <strong>{row.nombre}</strong>
                  </div>
                  <div>
                    <span>Precio p/p</span>
                    <strong>{money(row.precio_por_persona)}</strong>
                  </div>
                  <div>
                    <span>Estado</span>
                    <StatusBadge value={row.activo ? 'activo' : 'inactivo'} />
                  </div>
                  <PackageActions
                    row={row}
                    onView={setSelectedPackage}
                    onEdit={startEdit}
                    onToggle={toggleActive}
                    updatingId={updatingId}
                  />
                </article>
              ))}
            </div>
          </>
        ) : null}
      </article>

      <article className="panel package-card">
        <SectionHeading
          title="Desempeño de paquetes"
          subtitle="Comparativa comercial y financiera basada en datos reales"
        />

        {loadingDesempeno ? <p className="muted">Cargando desempeño.</p> : null}
        {desempenoError ? <p className="alert alert-error">No se pudo cargar el desempeño de paquetes.</p> : null}

        {!loadingDesempeno && !desempenoError && !hasPerformanceData ? (
          <EmptyState>
            Aún no hay cotizaciones o contratos suficientes para calcular desempeño.
          </EmptyState>
        ) : null}

        {!loadingDesempeno && !desempenoError && hasPerformanceData ? (
          <div className="package-performance-grid">
            <section className="package-chart-panel">
              <h3>Contratos por paquete</h3>
              {hasContractChartData ? (
                <div className="chart-box package-chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={performanceRows} margin={{ top: 6, right: 18, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="nombre" tickLine={false} axisLine={false} width={124} />
                      <Tooltip formatter={(value) => [Number(value || 0), 'Contratos']} />
                      <Bar dataKey="contratos" name="Contratos" fill="#4f46e5" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState>Aún no hay contratos confirmados para comparar paquetes.</EmptyState>
              )}
            </section>

            <section className="package-summary-panel">
              <h3>Resumen de desempeño</h3>
              <div className="package-table-wrap">
                <table className="data-table package-performance-table">
                  <thead>
                    <tr>
                      <th>Paquete</th>
                      <th>Conversión</th>
                      <th>Ingresos</th>
                      <th>Utilidad</th>
                      <th>Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.nombre}</td>
                        <td>{percent(row.conversion)}</td>
                        <td>{money(row.ingresos)}</td>
                        <td>{money(row.utilidad)}</td>
                        <td>{percent(row.margen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : null}
      </article>

      <PackageDetailModal
        paquete={selectedPackage}
        performance={selectedPerformance}
        performanceError={desempenoError}
        onClose={() => setSelectedPackage(null)}
      />
    </section>
  );
}
