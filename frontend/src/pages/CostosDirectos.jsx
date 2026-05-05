import { Plus, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import DataTable from '../components/tables/DataTable';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import PageHeader from '../components/ui/PageHeader';
import useApiData from '../hooks/useApiData';
import { contratosService } from '../services/contratosService';
import { costosDirectosService } from '../services/finanzasService';
import { extractApiError } from '../utils/apiErrors';
import { money, percent } from '../utils/formatters';

const emptyForm = { concepto: '', descripcion: '', valor: '' };

export default function CostosDirectos() {
  const { data: contratos, loading: loadingContratos, error: contratosError, reload: reloadContratos } = useApiData(() => contratosService.list(), [], []);
  const [selectedContratoId, setSelectedContratoId] = useState('');
  const { data: costos, loading: loadingCostos, error: costosError, reload: reloadCostos } = useApiData(
    () => costosDirectosService.list(selectedContratoId ? { contrato: selectedContratoId } : {}),
    [],
    [selectedContratoId],
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!selectedContratoId && contratos.length > 0) {
      setSelectedContratoId(String(contratos[0].id));
    }
  }, [contratos, selectedContratoId]);

  const selectedContrato = contratos.find((contrato) => String(contrato.id) === String(selectedContratoId));
  const total = costos.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const utilidad = selectedContrato ? Number(selectedContrato.valor_final || 0) - total : 0;
  const margen = selectedContrato?.valor_final ? (utilidad / Number(selectedContrato.valor_final)) * 100 : 0;

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    if (!selectedContratoId) {
      setMessage('Selecciona un contrato real antes de registrar costos.');
      return;
    }
    if (!form.concepto.trim() || Number(form.valor) <= 0) {
      setMessage('Concepto y valor mayor a cero son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      await costosDirectosService.create({ ...form, contrato: selectedContratoId, valor: Number(form.valor) });
      setForm(emptyForm);
      setShowForm(false);
      setMessage('Costo directo guardado correctamente.');
      await Promise.all([reloadCostos(), reloadContratos()]);
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo guardar el costo directo.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-stack">
      <PageHeader
        title="Costos directos del evento"
        description="Costos asociados a contratos especificos para calcular utilidad y margen bruto."
        actions={<Button type="button" onClick={() => setShowForm((value) => !value)}><Plus size={18} />Agregar costo</Button>}
      />
      {loadingContratos || loadingCostos ? <p className="muted">Cargando datos reales...</p> : null}
      {contratosError ? <p className="alert alert-error">{contratosError}</p> : null}
      {costosError ? <p className="alert alert-error">{costosError}</p> : null}
      {message ? <p className={message.includes('correctamente') ? 'alert alert-success' : 'alert alert-error'}>{message}</p> : null}

      <article className="panel">
        <FormField label="Contrato">
          <select value={selectedContratoId} onChange={(event) => setSelectedContratoId(event.target.value)}>
            {contratos.length === 0 ? <option value="">No hay contratos registrados</option> : null}
            {contratos.map((contrato) => (
              <option key={contrato.id} value={contrato.id}>
                #{contrato.id} - {contrato.cliente_nombre} - {contrato.evento_nombre} - {contrato.fecha_evento}
              </option>
            ))}
          </select>
        </FormField>
      </article>

      {showForm ? (
        <form className="panel form-grid" onSubmit={handleSubmit}>
          <div className="form-grid two">
            <FormField label="Concepto">
              <input value={form.concepto} onChange={(event) => update('concepto', event.target.value)} />
            </FormField>
            <FormField label="Valor">
              <input type="number" min="0" step="0.01" value={form.valor} onChange={(event) => update('valor', event.target.value)} />
            </FormField>
            <FormField label="Descripcion">
              <textarea value={form.descripcion} onChange={(event) => update('descripcion', event.target.value)} />
            </FormField>
          </div>
          <div className="actions-end">
            <Button type="submit" disabled={saving}><Save size={18} />{saving ? 'Guardando...' : 'Guardar costo'}</Button>
          </div>
        </form>
      ) : null}

      <div className="grid-3">
        <article className="panel"><h2>Contrato</h2><p>{selectedContrato ? `${selectedContrato.evento_nombre} - ${selectedContrato.cliente_nombre}` : 'Sin contrato seleccionado'}</p></article>
        <article className="panel"><h2>Valor del contrato</h2><strong>{money(selectedContrato?.valor_final)}</strong></article>
        <article className="panel"><h2>Fecha del evento</h2><p>{selectedContrato?.fecha_evento || 'No registrada'}</p></article>
      </div>

      <DataTable
        columns={[
          { key: 'concepto', label: 'Concepto' },
          { key: 'descripcion', label: 'Descripcion', render: (row) => row.descripcion || 'No registrada' },
          { key: 'valor', label: 'Valor', render: (row) => money(row.valor) },
          { key: 'fecha_registro', label: 'Fecha de registro', render: (row) => row.fecha_registro ? String(row.fecha_registro).slice(0, 10) : 'No registrada' },
        ]}
        emptyMessage="No hay registros disponibles."
        rows={costos}
      />

      <div className="grid-3">
        <article className="panel"><h2>Total costos directos</h2><strong>{money(total)}</strong></article>
        <article className="panel"><h2>Utilidad bruta</h2><strong>{money(utilidad)}</strong></article>
        <article className="panel"><h2>Margen bruto</h2><strong>{percent(margen)}</strong></article>
      </div>
    </section>
  );
}
