import { Plus, Save } from 'lucide-react';
import { useState } from 'react';
import DataTable from '../components/tables/DataTable';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import useApiData from '../hooks/useApiData';
import { eventosService } from '../services/eventosService';
import { extractApiError } from '../utils/apiErrors';

const emptyForm = { nombre: '', descripcion: '', activo: true };

export default function Eventos() {
  const { data: eventos, loading, error, reload } = useApiData(() => eventosService.list(), [], []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    if (!form.nombre.trim()) {
      setMessage('El nombre del tipo de evento es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      await eventosService.create(form);
      setForm(emptyForm);
      setShowForm(false);
      setMessage('Tipo de evento guardado correctamente.');
      await reload();
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo guardar el tipo de evento.'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row) {
    setMessage('');
    try {
      await eventosService.update(row.id, { ...row, activo: !row.activo });
      setMessage('Estado del tipo de evento actualizado.');
      await reload();
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo actualizar el tipo de evento.'));
    }
  }

  return (
    <section className="page-stack">
      <PageHeader
        title="Eventos"
        description="Catalogo de tipos de evento usados en cotizaciones y reportes."
        actions={<Button type="button" onClick={() => setShowForm((value) => !value)}><Plus size={18} />Nuevo tipo</Button>}
      />
      {loading ? <p className="muted">Cargando tipos de evento...</p> : null}
      {error ? <p className="alert alert-error">{error}</p> : null}
      {message ? <p className={message.includes('correctamente') || message.includes('actualizado') ? 'alert alert-success' : 'alert alert-error'}>{message}</p> : null}

      {showForm ? (
        <form className="panel form-grid" onSubmit={handleSubmit}>
          <div className="form-grid two">
            <FormField label="Tipo de evento">
              <input value={form.nombre} onChange={(event) => update('nombre', event.target.value)} />
            </FormField>
            <FormField label="Estado">
              <select value={form.activo ? 'true' : 'false'} onChange={(event) => update('activo', event.target.value === 'true')}>
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </FormField>
            <FormField label="Descripcion">
              <textarea value={form.descripcion} onChange={(event) => update('descripcion', event.target.value)} />
            </FormField>
          </div>
          <div className="actions-end">
            <Button type="submit" disabled={saving}><Save size={18} />{saving ? 'Guardando...' : 'Guardar tipo'}</Button>
          </div>
        </form>
      ) : null}

      <DataTable
        columns={[
          { key: 'nombre', label: 'Tipo de evento' },
          { key: 'descripcion', label: 'Descripcion', render: (row) => row.descripcion || 'No registrada' },
          { key: 'activo', label: 'Estado', render: (row) => <StatusBadge value={row.activo ? 'activo' : 'inactivo'} /> },
          {
            key: 'acciones',
            label: 'Acciones',
            render: (row) => <Button type="button" variant="secondary" onClick={() => toggleActive(row)}>{row.activo ? 'Desactivar' : 'Activar'}</Button>,
          },
        ]}
        emptyMessage="No hay registros disponibles."
        rows={eventos}
      />
    </section>
  );
}
