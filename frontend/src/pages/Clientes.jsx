import { Plus, Save } from 'lucide-react';
import { useState } from 'react';
import DataTable from '../components/tables/DataTable';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import PageHeader from '../components/ui/PageHeader';
import useApiData from '../hooks/useApiData';
import { clientesService } from '../services/clientesService';
import { extractApiError } from '../utils/apiErrors';

const emptyForm = { nombre: '', telefono: '', correo: '' };

export default function Clientes() {
  const { data: clientes, loading, error, reload } = useApiData(() => clientesService.list(), [], []);
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
    if (!form.nombre.trim() || !form.telefono.trim()) {
      setMessage('Nombre y telefono son obligatorios.');
      return;
    }
    if (form.telefono.replace(/\D/g, '').length < 7) {
      setMessage('Ingresa un telefono valido.');
      return;
    }
    setSaving(true);
    try {
      await clientesService.create(form);
      setForm(emptyForm);
      setShowForm(false);
      setMessage('Cliente guardado correctamente.');
      await reload();
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo guardar el cliente.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-stack">
      <PageHeader
        title="Clientes"
        description="Personas interesadas o contratantes registradas desde cotizaciones."
        actions={<Button type="button" onClick={() => setShowForm((value) => !value)}><Plus size={18} />Nuevo cliente</Button>}
      />
      {loading ? <p className="muted">Cargando clientes...</p> : null}
      {error ? <p className="alert alert-error">{error}</p> : null}
      {message ? <p className={message.includes('correctamente') ? 'alert alert-success' : 'alert alert-error'}>{message}</p> : null}

      {showForm ? (
        <form className="panel form-grid" onSubmit={handleSubmit}>
          <div className="form-grid two">
            <FormField label="Nombre">
              <input value={form.nombre} onChange={(event) => update('nombre', event.target.value)} />
            </FormField>
            <FormField label="Telefono">
              <input value={form.telefono} onChange={(event) => update('telefono', event.target.value)} />
            </FormField>
            <FormField label="Correo">
              <input type="email" value={form.correo} onChange={(event) => update('correo', event.target.value)} />
            </FormField>
          </div>
          <div className="actions-end">
            <Button type="submit" disabled={saving}><Save size={18} />{saving ? 'Guardando...' : 'Guardar cliente'}</Button>
          </div>
        </form>
      ) : null}

      <DataTable
        columns={[
          { key: 'nombre', label: 'Nombre' },
          { key: 'telefono', label: 'Telefono' },
          { key: 'correo', label: 'Correo', render: (row) => row.correo || 'No registrado' },
          { key: 'fecha_registro', label: 'Fecha de registro', render: (row) => row.fecha_registro ? String(row.fecha_registro).slice(0, 10) : 'No registrado' },
        ]}
        emptyMessage="No hay registros disponibles."
        rows={clientes}
      />
    </section>
  );
}
