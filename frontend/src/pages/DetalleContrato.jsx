import { ArrowLeft, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import MetricCard from '../components/cards/MetricCard';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import useApiData from '../hooks/useApiData';
import { contratosService } from '../services/contratosService';
import { costosDirectosService } from '../services/finanzasService';
import { extractApiError } from '../utils/apiErrors';
import { money, percent } from '../utils/formatters';

const emptyCostoForm = { concepto: '', descripcion: '', valor: '' };
const contractStatuses = ['confirmado', 'cancelado'];
const paymentStatuses = ['pendiente', 'abonado', 'pagado'];

function number(value) {
  return Number(value || 0);
}

function parseDateOnly(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function sameMonth(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function average(rows, selector) {
  const values = rows.map(selector).filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function moneyOrEmpty(value) {
  return value === null || value === undefined ? 'Sin datos suficientes' : money(value);
}

function percentOrEmpty(value) {
  return value === null || value === undefined ? 'Sin datos suficientes' : percent(value);
}

function comparisonStatus(diff, unit = 'money') {
  if (diff === null || diff === undefined) return 'Referencia no disponible.';
  const abs = unit === 'percent' ? `${Math.abs(diff).toFixed(2)} puntos porcentuales` : money(Math.abs(diff));
  if (Math.abs(diff) < 0.01) return `Está alineado con la referencia.`;
  return diff > 0 ? `Superior a la referencia por ${abs}.` : `Inferior a la referencia por ${abs}.`;
}

function buildComparisons(contrato, contratos) {
  if (!contrato) return [];
  const eventDate = parseDateOnly(contrato.fecha_evento);
  const currentMargin = number(contrato.margen_bruto);
  const currentUtility = number(contrato.utilidad_bruta);
  const currentValue = number(contrato.valor_final);
  const currentCosts = number(contrato.total_costos_directos);
  const activeContracts = contratos.filter((item) => (
    String(item.id) !== String(contrato.id) && item.estado_contrato !== 'cancelado'
  ));
  const sameMonthContracts = activeContracts.filter((item) => sameMonth(parseDateOnly(item.fecha_evento), eventDate));
  const sameEventContracts = activeContracts.filter((item) => item.evento_nombre && item.evento_nombre === contrato.evento_nombre);
  const samePackageContracts = activeContracts.filter((item) => item.paquete_nombre && item.paquete_nombre === contrato.paquete_nombre);
  const avgMonthMargin = average(sameMonthContracts, (item) => number(item.margen_bruto));
  const avgEventUtility = average(sameEventContracts, (item) => number(item.utilidad_bruta));
  const avgPackageTicket = average(samePackageContracts, (item) => number(item.valor_final));
  const avgPackageCosts = average(samePackageContracts, (item) => number(item.total_costos_directos));

  return [
    {
      title: 'Margen bruto vs promedio del mes',
      eventValue: percent(currentMargin),
      referenceValue: percentOrEmpty(avgMonthMargin),
      difference: avgMonthMargin === null ? 'Sin datos suficientes' : `${(currentMargin - avgMonthMargin).toFixed(2)} pp`,
      interpretation: avgMonthMargin === null
        ? 'No hay otros contratos del mismo mes para comparar margen.'
        : `Este evento tiene un margen bruto de ${percent(currentMargin)}, ${comparisonStatus(currentMargin - avgMonthMargin, 'percent').toLowerCase()}`,
    },
    {
      title: 'Utilidad bruta vs eventos del mismo tipo',
      eventValue: money(currentUtility),
      referenceValue: moneyOrEmpty(avgEventUtility),
      difference: avgEventUtility === null ? 'Sin datos suficientes' : money(currentUtility - avgEventUtility),
      interpretation: avgEventUtility === null
        ? 'No hay otros eventos del mismo tipo para calcular una referencia.'
        : `La utilidad bruta del evento es ${comparisonStatus(currentUtility - avgEventUtility).toLowerCase()}`,
    },
    {
      title: 'Valor final vs ticket promedio del paquete',
      eventValue: money(currentValue),
      referenceValue: moneyOrEmpty(avgPackageTicket),
      difference: avgPackageTicket === null ? 'Sin datos suficientes' : money(currentValue - avgPackageTicket),
      interpretation: avgPackageTicket === null
        ? 'No hay suficientes contratos del mismo paquete para comparar ticket.'
        : `El valor final del contrato es ${comparisonStatus(currentValue - avgPackageTicket).toLowerCase()}`,
    },
    {
      title: 'Costos directos vs promedio del paquete',
      eventValue: money(currentCosts),
      referenceValue: moneyOrEmpty(avgPackageCosts),
      difference: avgPackageCosts === null ? 'Sin datos suficientes' : money(currentCosts - avgPackageCosts),
      interpretation: avgPackageCosts === null
        ? 'No hay suficientes costos de contratos del mismo paquete para comparar.'
        : `Los costos directos del evento son ${comparisonStatus(currentCosts - avgPackageCosts).toLowerCase()}`,
    },
  ];
}

function saldoText(contrato) {
  if (contrato?.saldo_pendiente !== undefined && contrato?.saldo_pendiente !== null) {
    return money(contrato.saldo_pendiente);
  }
  return contrato?.estado_pago === 'pagado' ? money(0) : 'No disponible';
}

export default function DetalleContrato() {
  const { id } = useParams();
  const { data: contrato, loading, error, reload: reloadContrato } = useApiData(() => contratosService.get(id), null, [id]);
  const { data: contratos, reload: reloadContratos } = useApiData(() => contratosService.list(), [], []);
  const { data: costos, loading: loadingCostos, error: costosError, reload: reloadCostos } = useApiData(
    () => costosDirectosService.list({ contrato: id }),
    [],
    [id],
  );
  const [contractForm, setContractForm] = useState({
    fecha_evento: '',
    valor_final: '',
    estado_contrato: 'confirmado',
    estado_pago: 'pendiente',
    monto_abonado: '',
    observaciones: '',
  });
  const [costForm, setCostForm] = useState(emptyCostoForm);
  const [editingCostId, setEditingCostId] = useState(null);
  const [showCostForm, setShowCostForm] = useState(false);
  const [savingContract, setSavingContract] = useState(false);
  const [savingCost, setSavingCost] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (contrato) {
      setContractForm({
        fecha_evento: contrato.fecha_evento || '',
        valor_final: contrato.valor_final || '',
        estado_contrato: contrato.estado_contrato || 'confirmado',
        estado_pago: contrato.estado_pago || 'pendiente',
        monto_abonado: contrato.monto_abonado || '',
        observaciones: contrato.observaciones || '',
      });
    }
  }, [contrato]);

  const comparisons = useMemo(() => buildComparisons(contrato, contratos), [contrato, contratos]);
  const totalCostos = costos.reduce((sum, item) => sum + number(item.valor), 0);
  const utilidadBruta = number(contrato?.valor_final) - totalCostos;
  const margenBruto = number(contrato?.valor_final) > 0 ? (utilidadBruta / number(contrato?.valor_final)) * 100 : 0;

  async function refreshAll() {
    await Promise.all([reloadContrato(), reloadCostos(), reloadContratos()]);
  }

  function startCreateCost() {
    setEditingCostId(null);
    setCostForm(emptyCostoForm);
    setShowCostForm(true);
    setMessage('');
  }

  function startEditCost(row) {
    setEditingCostId(row.id);
    setCostForm({
      concepto: row.concepto || '',
      descripcion: row.descripcion || '',
      valor: row.valor || '',
    });
    setShowCostForm(true);
    setMessage('');
  }

  async function handleContractSubmit(event) {
    event.preventDefault();
    setMessage('');
    if (!contractForm.fecha_evento || number(contractForm.valor_final) <= 0) {
      setMessage('Fecha de evento y valor final mayor a cero son obligatorios.');
      return;
    }
    if (contractForm.estado_pago === 'abonado' && (number(contractForm.monto_abonado) <= 0 || number(contractForm.monto_abonado) >= number(contractForm.valor_final))) {
      setMessage('Para marcar como abonado, registra un monto mayor a cero y menor al valor final.');
      return;
    }
    setSavingContract(true);
    try {
      await contratosService.update(id, {
        cotizacion: contrato.cotizacion,
        fecha_evento: contractForm.fecha_evento,
        valor_final: number(contractForm.valor_final),
        estado_contrato: contractForm.estado_contrato,
        estado_pago: contractForm.estado_pago,
        monto_abonado: contractForm.estado_pago === 'pagado'
          ? number(contractForm.valor_final)
          : contractForm.estado_pago === 'pendiente'
            ? 0
            : number(contractForm.monto_abonado),
        observaciones: contractForm.observaciones,
      });
      setMessage('Contrato actualizado correctamente.');
      await refreshAll();
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo actualizar el contrato.'));
    } finally {
      setSavingContract(false);
    }
  }

  async function handleCostSubmit(event) {
    event.preventDefault();
    setMessage('');
    if (!costForm.concepto.trim() || number(costForm.valor) <= 0) {
      setMessage('Concepto y valor mayor a cero son obligatorios.');
      return;
    }
    setSavingCost(true);
    try {
      const payload = { ...costForm, contrato: id, valor: number(costForm.valor) };
      if (editingCostId) {
        await costosDirectosService.update(editingCostId, payload);
        setMessage('Costo directo actualizado correctamente.');
      } else {
        await costosDirectosService.create(payload);
        setMessage('Costo directo añadido correctamente.');
      }
      setCostForm(emptyCostoForm);
      setEditingCostId(null);
      setShowCostForm(false);
      await refreshAll();
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo guardar el costo directo.'));
    } finally {
      setSavingCost(false);
    }
  }

  async function handleDeleteCost(row) {
    setMessage('');
    if (!window.confirm(`Eliminar el costo directo "${row.concepto}"?`)) return;
    try {
      await costosDirectosService.remove(row.id);
      setMessage('Costo directo eliminado correctamente.');
      await refreshAll();
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo eliminar el costo directo.'));
    }
  }

  if (loading && !contrato) {
    return <section className="page-stack"><p className="muted">Cargando contrato...</p></section>;
  }

  if (error && !contrato) {
    return <section className="page-stack"><p className="alert alert-error">{error}</p></section>;
  }

  if (!contrato) {
    return <section className="page-stack"><p className="muted">No hay datos disponibles.</p></section>;
  }

  return (
    <section className="page-stack contract-detail-page">
      <PageHeader
        title={`Detalle del contrato #${contrato.id}`}
        description="Información operativa, pago, costos directos y rentabilidad del evento."
        actions={<Button as={Link} to="/contratos" variant="secondary"><ArrowLeft size={18} />Volver a contratos</Button>}
      />

      {message ? <p className={message.includes('correctamente') || message.includes('añadido') ? 'alert alert-success' : 'alert alert-error'}>{message}</p> : null}
      {loadingCostos ? <p className="muted">Cargando costos directos...</p> : null}
      {costosError ? <p className="alert alert-error">{costosError}</p> : null}

      <div className="contract-detail-grid">
        <article className="panel detail-panel">
          <h2>Información del cliente</h2>
          <dl className="detail-list">
            <div><dt>Cliente</dt><dd>{contrato.cliente_nombre || 'No registrado'}</dd></div>
            <div><dt>Teléfono</dt><dd>{contrato.cliente_telefono || 'No registrado'}</dd></div>
          </dl>
        </article>

        <article className="panel detail-panel">
          <h2>Información del evento</h2>
          <dl className="detail-list">
            <div><dt>Evento</dt><dd>{contrato.evento_nombre || 'No registrado'}</dd></div>
            <div><dt>Paquete</dt><dd>{contrato.paquete_nombre || 'No aplica'}</dd></div>
            <div><dt>Fecha del evento</dt><dd>{contrato.fecha_evento || 'No registrada'}</dd></div>
          </dl>
        </article>

        <article className="panel detail-panel">
          <h2>Información comercial y de pago</h2>
          <dl className="detail-list">
            <div><dt>Valor final</dt><dd>{money(contrato.valor_final)}</dd></div>
            <div><dt>Estado del contrato</dt><dd><StatusBadge value={contrato.estado_contrato} /></dd></div>
            <div><dt>Monto abonado</dt><dd>{money(contrato.monto_abonado)}</dd></div>
            <div><dt>Saldo pendiente</dt><dd>{saldoText(contrato)}</dd></div>
            <div><dt>Estado de pago</dt><dd><StatusBadge value={contrato.estado_pago} /></dd></div>
            <div><dt>Observaciones</dt><dd>{contrato.observaciones || 'Sin observaciones'}</dd></div>
          </dl>
        </article>

        <article className="panel detail-panel">
          <h2>Registro</h2>
          <dl className="detail-list">
            <div><dt>Fecha de registro</dt><dd>{contrato.fecha_registro ? String(contrato.fecha_registro).slice(0, 10) : 'No registrada'}</dd></div>
          </dl>
        </article>
      </div>

      <form className="panel form-grid" onSubmit={handleContractSubmit}>
        <h2>Editar datos del contrato</h2>
        <div className="form-grid two">
          <FormField label="Fecha del evento">
            <input type="date" value={contractForm.fecha_evento} onChange={(event) => setContractForm({ ...contractForm, fecha_evento: event.target.value })} />
          </FormField>
          <FormField label="Valor final">
            <input type="number" min="0" step="0.01" value={contractForm.valor_final} onChange={(event) => setContractForm({ ...contractForm, valor_final: event.target.value })} />
          </FormField>
          <FormField label="Estado del contrato">
            <select value={contractForm.estado_contrato} onChange={(event) => setContractForm({ ...contractForm, estado_contrato: event.target.value })}>
              {contractStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </FormField>
          <FormField label="Estado del pago">
            <select value={contractForm.estado_pago} onChange={(event) => setContractForm({ ...contractForm, estado_pago: event.target.value })}>
              {paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </FormField>
          {contractForm.estado_pago === 'abonado' ? (
            <FormField label="Monto abonado">
              <input type="number" min="0" step="0.01" value={contractForm.monto_abonado} onChange={(event) => setContractForm({ ...contractForm, monto_abonado: event.target.value })} />
            </FormField>
          ) : null}
          <FormField label="Observaciones">
            <textarea value={contractForm.observaciones} onChange={(event) => setContractForm({ ...contractForm, observaciones: event.target.value })} />
          </FormField>
        </div>
        <div className="actions-end">
          <Button type="submit" disabled={savingContract}><Save size={18} />{savingContract ? 'Guardando...' : 'Guardar contrato'}</Button>
        </div>
      </form>

      <section className="page-stack">
        <PageHeader
          title="Costos directos"
          description="Costos asociados al contrato/evento. Estos valores alimentan automáticamente la rentabilidad."
          actions={<Button type="button" onClick={startCreateCost}><Plus size={18} />Añadir costo</Button>}
        />

        {showCostForm ? (
          <form className="panel form-grid" onSubmit={handleCostSubmit}>
            <h2>{editingCostId ? 'Editar costo directo' : 'Nuevo costo directo'}</h2>
            <div className="form-grid two">
              <FormField label="Concepto">
                <input value={costForm.concepto} onChange={(event) => setCostForm({ ...costForm, concepto: event.target.value })} />
              </FormField>
              <FormField label="Valor">
                <input type="number" min="0" step="0.01" value={costForm.valor} onChange={(event) => setCostForm({ ...costForm, valor: event.target.value })} />
              </FormField>
              <FormField label="Descripción">
                <textarea value={costForm.descripcion} onChange={(event) => setCostForm({ ...costForm, descripcion: event.target.value })} />
              </FormField>
            </div>
            <div className="inline-actions">
              <Button type="submit" disabled={savingCost}><Save size={18} />{savingCost ? 'Guardando...' : 'Guardar costo'}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowCostForm(false)}><X size={18} />Cancelar</Button>
            </div>
          </form>
        ) : null}

        <div className="cost-list panel">
          {costos.length === 0 ? (
            <p className="empty-state">No hay costos directos registrados para este contrato.</p>
          ) : (
            costos.map((costo) => (
              <div className="cost-row" key={costo.id}>
                <div>
                  <strong>{costo.concepto}</strong>
                  <span>{costo.descripcion || 'Sin descripción'}</span>
                </div>
                <strong>{money(costo.valor)}</strong>
                <div className="inline-actions">
                  <Button type="button" variant="secondary" onClick={() => startEditCost(costo)}><Pencil size={15} />Editar</Button>
                  <Button type="button" variant="ghost" onClick={() => handleDeleteCost(costo)}><Trash2 size={15} />Eliminar</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="page-stack">
        <PageHeader title="Rentabilidad del evento" description="Valores calculados automáticamente desde el contrato y sus costos directos." />
        <div className="grid-4">
          <MetricCard title="Valor final" value={money(contrato.valor_final)} />
          <MetricCard title="Total costos directos" value={money(totalCostos)} />
          <MetricCard title="Utilidad bruta" value={money(utilidadBruta)} />
          <MetricCard title="Margen bruto" value={percent(margenBruto)} />
        </div>
      </section>

      <section className="page-stack">
        <PageHeader title="Métricas y comparaciones" description="Comparaciones operativas del evento contra referencias reales del sistema." />
        <div className="comparison-grid">
          {comparisons.map((item) => (
            <article className="comparison-card" key={item.title}>
              <h2>{item.title}</h2>
              <dl>
                <div><dt>Evento actual</dt><dd>{item.eventValue}</dd></div>
                <div><dt>Referencia</dt><dd>{item.referenceValue}</dd></div>
                <div><dt>Diferencia</dt><dd>{item.difference}</dd></div>
              </dl>
              <p>{item.interpretation}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
