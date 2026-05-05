import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import PageHeader from '../components/ui/PageHeader';
import { guardarConfiguracion, obtenerConfiguracion } from '../services/configuracionService';
import { extractApiError } from '../utils/apiErrors';
import { formatWhatsAppNumber } from '../utils/whatsapp';

export default function Configuracion() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    obtenerConfiguracion()
      .then(setConfig)
      .catch(() => setMessage('No se pudo cargar la configuracion desde la API.'))
      .finally(() => setLoading(false));
  }, []);

  function update(field, value) {
    setConfig((current) => ({ ...current, [field]: value }));
  }

  function validate() {
    if (!config.nombre_negocio?.trim()) return 'El nombre del negocio es obligatorio.';
    if (!formatWhatsAppNumber(config.whatsapp)) return 'Ingresa un WhatsApp valido para el negocio.';
    if (config.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.correo)) return 'Ingresa un correo valido.';
    if (Number(config.tarifa_base_alquiler) < 0) return 'La tarifa base no puede ser negativa.';
    if (Number(config.invitados_incluidos) < 0) return 'Los invitados incluidos no pueden ser negativos.';
    if (Number(config.costo_invitado_adicional) < 0) return 'El costo adicional no puede ser negativo.';
    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validate();
    setMessage('');
    if (validationError) {
      setMessage(validationError);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...config,
        tarifa_base_alquiler: Number(config.tarifa_base_alquiler),
        invitados_incluidos: Number(config.invitados_incluidos),
        costo_invitado_adicional: Number(config.costo_invitado_adicional),
      };
      const saved = await guardarConfiguracion(payload);
      setConfig(saved);
      setMessage('Configuracion guardada correctamente.');
    } catch (err) {
      setMessage(extractApiError(err, 'No se pudo guardar la configuracion.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <section className="page-stack"><p className="muted">Cargando configuracion...</p></section>;
  }

  if (!config) {
    return <section className="page-stack"><p className="alert alert-error">{message || 'No hay configuracion disponible.'}</p></section>;
  }

  return (
    <section className="page-stack">
      <PageHeader title="Configuracion" description="Parametros generales que gobiernan WhatsApp y reglas de pre-cotizacion." />
      {message ? <p className={message.includes('correctamente') ? 'alert alert-success' : 'alert alert-error'}>{message}</p> : null}
      <form className="page-stack" onSubmit={handleSubmit}>
        <article className="panel form-grid">
          <h2>Datos del negocio</h2>
          <div className="form-grid two">
            <FormField label="Nombre del salon">
              <input value={config.nombre_negocio || ''} onChange={(event) => update('nombre_negocio', event.target.value)} />
            </FormField>
            <FormField label="WhatsApp">
              <input value={config.whatsapp || ''} onChange={(event) => update('whatsapp', event.target.value)} placeholder="0999999999" />
            </FormField>
            <FormField label="Correo">
              <input type="email" value={config.correo || ''} onChange={(event) => update('correo', event.target.value)} />
            </FormField>
            <FormField label="Direccion">
              <input value={config.direccion || ''} onChange={(event) => update('direccion', event.target.value)} />
            </FormField>
          </div>
          <p className="muted">Numero usado para wa.me: {formatWhatsAppNumber(config.whatsapp) || 'No valido'}</p>
        </article>

        <article className="panel form-grid">
          <h2>Tarifa de alquiler</h2>
          <div className="form-grid two">
            <FormField label="Tarifa base">
              <input type="number" min="0" step="0.01" value={config.tarifa_base_alquiler} onChange={(event) => update('tarifa_base_alquiler', event.target.value)} />
            </FormField>
            <FormField label="Invitados incluidos">
              <input type="number" min="0" value={config.invitados_incluidos} onChange={(event) => update('invitados_incluidos', event.target.value)} />
            </FormField>
            <FormField label="Costo por invitado adicional">
              <input type="number" min="0" step="0.01" value={config.costo_invitado_adicional} onChange={(event) => update('costo_invitado_adicional', event.target.value)} />
            </FormField>
          </div>
        </article>

        <div className="actions-end">
          <Button type="submit" disabled={saving}><Save size={18} />{saving ? 'Guardando...' : 'Guardar configuracion'}</Button>
        </div>
      </form>
    </section>
  );
}
