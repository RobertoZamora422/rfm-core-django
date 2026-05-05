import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import PageHeader from '../components/ui/PageHeader';
import { calcularPreCotizacion } from '../services/cotizacionesService';
import { listarEventosPublicos } from '../services/eventosService';
import { listarPaquetesPublicos } from '../services/paquetesService';
import { extractApiError } from '../utils/apiErrors';

const initialForm = {
  nombre: '',
  telefono: '',
  tipo_evento: '',
  tipo_evento_texto: '',
  fecha_tentativa: '',
  numero_invitados: '',
  tipo_servicio: 'no_seguro',
  paquete: '',
};

export default function PreCotizacion() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [tiposEvento, setTiposEvento] = useState([]);
  const [paquetes, setPaquetes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([
      listarEventosPublicos({ activo: true }),
      listarPaquetesPublicos({ activo: true }),
    ])
      .then(([eventos, paquetesActivos]) => {
        if (!alive) return;
        setTiposEvento(eventos);
        setPaquetes(paquetesActivos);
        setForm((current) => ({
          ...current,
          tipo_evento: eventos[0]?.id || '',
        }));
      })
      .catch(() => {
        if (alive) setError('No se pudieron cargar catalogos desde la API. Revisa que Django este activo.');
      })
      .finally(() => {
        if (alive) setCatalogLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validate() {
    const required = ['nombre', 'telefono', 'fecha_tentativa', 'numero_invitados', 'tipo_servicio'];
    const missing = required.filter((field) => !String(form[field] || '').trim());
    if (tiposEvento.length > 0 && !form.tipo_evento) missing.push('tipo_evento');
    if (tiposEvento.length === 0 && !form.tipo_evento_texto.trim()) missing.push('tipo_evento');
    if (missing.length) return 'Completa los campos obligatorios antes de continuar.';
    if (String(form.telefono).replace(/\D/g, '').length < 7) return 'Ingresa un telefono o WhatsApp valido.';
    if (Number(form.numero_invitados) <= 0) return 'El numero de invitados debe ser mayor a cero.';
    if (form.tipo_servicio === 'servicio_completo' && paquetes.length === 0) return 'No hay paquetes activos para cotizar servicio completo.';
    if (form.tipo_servicio === 'servicio_completo' && !form.paquete) return 'Selecciona un paquete para cotizar servicio completo.';
    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        tipo_evento: tiposEvento.length > 0 ? form.tipo_evento : form.tipo_evento_texto,
        numero_invitados: Number(form.numero_invitados),
        paquete: form.tipo_servicio === 'servicio_completo' ? form.paquete || undefined : undefined,
      };
      const result = await calcularPreCotizacion(payload);
      const routeMap = {
        alquiler: '/pre-cotizacion/alquiler',
        servicio_completo: '/pre-cotizacion/servicio-completo',
        comparacion: '/pre-cotizacion/comparacion',
      };
      navigate(routeMap[result.tipo_resultado] || '/pre-cotizacion/comparacion', {
        state: { result, form: payload },
      });
    } catch (err) {
      setError(extractApiError(err, 'No se pudo crear la pre-cotizacion. Intenta nuevamente.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="public-page">
      <section className="public-shell page-stack">
        <PageHeader
          title="Pre-cotiza tu evento"
          description="Completa los datos basicos y un asesor continuara contigo por WhatsApp."
        />

        <form className="panel form-grid" onSubmit={handleSubmit}>
          {error ? <p className="alert alert-error">{error}</p> : null}
          {catalogLoading ? <p className="muted">Cargando catalogos reales...</p> : null}

          <div className="form-grid two">
            <FormField label="Nombre del cliente">
              <input value={form.nombre} onChange={(event) => update('nombre', event.target.value)} />
            </FormField>
            <FormField label="Telefono o WhatsApp">
              <input value={form.telefono} onChange={(event) => update('telefono', event.target.value)} placeholder="0999999999" />
            </FormField>
            <FormField label="Tipo de evento">
              {tiposEvento.length > 0 ? (
                <select value={form.tipo_evento} onChange={(event) => update('tipo_evento', event.target.value)}>
                  {tiposEvento.map((evento) => (
                    <option key={evento.id} value={evento.id}>{evento.nombre}</option>
                  ))}
                </select>
              ) : (
                <input value={form.tipo_evento_texto} onChange={(event) => update('tipo_evento_texto', event.target.value)} placeholder="Boda, graduacion, corporativo..." />
              )}
            </FormField>
            <FormField label="Fecha tentativa">
              <input type="date" value={form.fecha_tentativa} onChange={(event) => update('fecha_tentativa', event.target.value)} />
            </FormField>
            <FormField label="Numero aproximado de invitados">
              <input type="number" min="1" value={form.numero_invitados} onChange={(event) => update('numero_invitados', event.target.value)} />
            </FormField>
            {form.tipo_servicio === 'servicio_completo' ? (
              <FormField label="Paquete de interes">
                <select value={form.paquete} onChange={(event) => update('paquete', event.target.value)}>
                  <option value="">Selecciona un paquete</option>
                  {paquetes.map((paquete) => (
                    <option key={paquete.id} value={paquete.id}>
                      {paquete.nombre} - ${Number(paquete.precio_por_persona || 0).toFixed(2)} por persona
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}
          </div>

          <FormField label="Tipo de servicio de interes">
            <div className="segmented">
              {[
                ['alquiler', 'Alquiler del local'],
                ['servicio_completo', 'Servicio completo'],
                ['no_seguro', 'Aun no estoy seguro'],
              ].map(([value, label]) => (
                <button
                  className={`segment ${form.tipo_servicio === value ? 'active' : ''}`}
                  key={value}
                  onClick={() => update('tipo_servicio', value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </FormField>

          <p className="muted">
            La estimacion es referencial. El cierre comercial se realiza con asesoria del negocio.
          </p>
          <div className="actions-end">
            <Button type="submit" disabled={loading || catalogLoading}>
              <ArrowRight size={18} />
              {loading ? 'Generando...' : 'Generar pre-cotizacion'}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
