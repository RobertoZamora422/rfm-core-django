import { Pencil, Plus, Save } from 'lucide-react';
import { useState } from 'react';
import DataTable from '../components/tables/DataTable';
import Button from '../components/ui/Button';
import FilterBar from '../components/ui/FilterBar';
import FormField from '../components/ui/FormField';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import useApiData from '../hooks/useApiData';
import { gastosFijosService } from '../services/finanzasService';
import { extractApiError } from '../utils/apiErrors';
import { money } from '../utils/formatters';

const today = new Date();
const emptyForm = {
  concepto: '',
  categoria: 'General',
  descripcion: '',
  valor: '',
  frecuencia: 'mensual',
  activo: true,
  fecha_inicio: '',
  fecha_fin: '',
};

export default function GastosFijos() {
  const [periodo, setPeriodo] = useState({ anio: today.getFullYear(), mes: today.getMonth() + 1 });
  const { data: gastos, loading, error, reload } = useApiData(
    () => gastosFijosService.list({ anio: periodo.anio, mes: periodo.mes }),
    [],
    [periodo.anio, periodo.mes],
  );
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const total = gastos.filter((item) => item.activo !== false).reduce((sum, item) => sum + Number(item.valor || 0), 0);

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
      concepto: row.concepto || '',
      categoria: row.categoria || 'General',
      descripcion: row.descripcion || '',
      valor: row.valor || '',
      frecuencia: row.frecuencia || 'mensual',
      activo: row.activo !== false,
      fecha_inicio: row.fecha_inicio || '',
      fecha_fin: row.fecha_fin || '',
    });
    setShowForm(true);
    setMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    if (!form.concepto.trim() || Number(form.valor) <= 0) {
      setMessage('Concepto y valor mayor a cero son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        valor: Number(form.valor),
        anio: null,
        mes: null,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
      };
      if (editingId) {
        await gastosFijosService.update(editingId, payload);
        setMessage('Gasto fijo recurrente actualizado correctamente.');
      } else {
        await gastosFijosService.create(payload);
        setMessage('Gasto fijo recurrente guardado correctamente.');
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      await reload();
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo guardar el gasto fijo recurrente.'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row) {
    setMessage('');
    try {
      await gastosFijosService.update(row.id, {
        ...row,
        activo: !row.activo,
        anio: row.anio || null,
        mes: row.mes || null,
      });
      setMessage('Estado del gasto fijo actualizado.');
      await reload();
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo actualizar el gasto fijo.'));
    }
  }

  return (
    <section className="page-stack">
      <PageHeader
        title="Gastos fijos recurrentes"
        description="Egresos operativos activos que se aplican automáticamente cada mes según su vigencia."
        actions={<Button type="button" onClick={startCreate}><Plus size={18} />Nuevo gasto recurrente</Button>}
      />
      {loading ? <p className="muted">Cargando gastos fijos...</p> : null}
      {error ? <p className="alert alert-error">{error}</p> : null}
      {message ? <p className={message.includes('correctamente') || message.includes('actualizado') ? 'alert alert-success' : 'alert alert-error'}>{message}</p> : null}

      <FilterBar>
        <FormField label="Año">
          <input type="number" value={periodo.anio} onChange={(event) => setPeriodo({ ...periodo, anio: Number(event.target.value) })} />
        </FormField>
        <FormField label="Mes">
          <input type="number" min="1" max="12" value={periodo.mes} onChange={(event) => setPeriodo({ ...periodo, mes: Number(event.target.value) })} />
        </FormField>
      </FilterBar>

      {showForm ? (
        <form className="panel form-grid" onSubmit={handleSubmit}>
          <h2>{editingId ? 'Editar gasto recurrente' : 'Nuevo gasto recurrente'}</h2>
          <div className="form-grid two">
            <FormField label="Concepto">
              <input value={form.concepto} onChange={(event) => update('concepto', event.target.value)} />
            </FormField>
            <FormField label="Categoría">
              <input value={form.categoria} onChange={(event) => update('categoria', event.target.value)} />
            </FormField>
            <FormField label="Monto mensual">
              <input type="number" min="0" step="0.01" value={form.valor} onChange={(event) => update('valor', event.target.value)} />
            </FormField>
            <FormField label="Frecuencia">
              <select value={form.frecuencia} onChange={(event) => update('frecuencia', event.target.value)}>
                <option value="mensual">Mensual</option>
              </select>
            </FormField>
            <FormField label="Estado">
              <select value={form.activo ? 'true' : 'false'} onChange={(event) => update('activo', event.target.value === 'true')}>
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </FormField>
            <FormField label="Fecha de inicio">
              <input type="date" value={form.fecha_inicio} onChange={(event) => update('fecha_inicio', event.target.value)} />
            </FormField>
            <FormField label="Fecha de fin opcional">
              <input type="date" value={form.fecha_fin} onChange={(event) => update('fecha_fin', event.target.value)} />
            </FormField>
            <FormField label="Descripción">
              <textarea value={form.descripcion} onChange={(event) => update('descripcion', event.target.value)} />
            </FormField>
          </div>
          <div className="inline-actions">
            <Button type="submit" disabled={saving}><Save size={18} />{saving ? 'Guardando...' : 'Guardar gasto'}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </form>
      ) : null}

      <DataTable
        columns={[
          { key: 'concepto', label: 'Concepto' },
          { key: 'categoria', label: 'Categoría', render: (row) => row.categoria || 'General' },
          { key: 'valor', label: 'Monto mensual', render: (row) => money(row.valor) },
          { key: 'frecuencia', label: 'Frecuencia', render: (row) => row.frecuencia || 'mensual' },
          { key: 'activo', label: 'Estado', render: (row) => <StatusBadge value={row.activo ? 'activo' : 'inactivo'} /> },
          { key: 'vigencia', label: 'Vigencia', render: (row) => `${row.fecha_inicio || 'Sin inicio'} - ${row.fecha_fin || 'Sin fin'}` },
          { key: 'descripcion', label: 'Descripción', render: (row) => row.descripcion || 'No registrada' },
          {
            key: 'acciones',
            label: 'Acciones',
            render: (row) => (
              <div className="inline-actions">
                <Button type="button" variant="secondary" onClick={() => startEdit(row)}><Pencil size={16} />Editar</Button>
                <Button type="button" variant="ghost" onClick={() => toggleActive(row)}>{row.activo ? 'Desactivar' : 'Activar'}</Button>
              </div>
            ),
          },
        ]}
        emptyMessage="No hay gastos fijos aplicables al periodo."
        rows={gastos}
      />
      <div className="result-highlight">
        <span>Total de gastos fijos activos del periodo</span>
        <strong>{money(total)}</strong>
      </div>
    </section>
  );
}
