import { MessageCircle, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import { obtenerConfiguracion } from '../services/configuracionService';
import { money } from '../utils/formatters';
import { buildWhatsAppUrl, preQuoteMessage } from '../utils/whatsapp';

export default function ResultadoComparacion() {
  const { state } = useLocation();
  const result = state?.result;
  const cotizacion = result?.cotizacion;
  const alquiler = result?.alquiler;
  const servicio = result?.servicio_completo;
  const [config, setConfig] = useState(result?.configuracion || null);
  const [error, setError] = useState('');

  useEffect(() => {
    obtenerConfiguracion({ publico: true })
      .then(setConfig)
      .catch(() => setError('No se pudo cargar el WhatsApp configurado del negocio.'));
  }, []);

  if (!result || !cotizacion || !alquiler || !servicio) {
    return <MissingQuote />;
  }

  const whatsappUrl = buildWhatsAppUrl(config?.whatsapp, preQuoteMessage(result));

  return (
    <main className="public-page">
      <section className="public-shell page-stack">
        <PageHeader title="Resultado de pre-cotizacion" description="Comparacion de modalidades" />
        <article className="panel page-stack">
          {error ? <p className="alert alert-error">{error}</p> : null}
          <div className="grid-2">
            <p>Cliente: <strong>{result.cliente?.nombre || cotizacion.cliente_nombre}</strong></p>
            <p>Tipo de evento: <strong>{cotizacion.tipo_evento_nombre}</strong></p>
            <p>Invitados: <strong>{cotizacion.numero_invitados}</strong></p>
            <p>Monto referencial registrado: <strong>{money(cotizacion.monto_estimado)}</strong></p>
          </div>
          <div className="grid-2">
            <div className="panel">
              <h2>Alquiler del local</h2>
              <p>Tarifa base: <strong>{money(alquiler.tarifa_base)}</strong></p>
              <p>Invitados incluidos: <strong>{alquiler.invitados_incluidos}</strong></p>
              <p>Invitados adicionales: <strong>{alquiler.personas_adicionales}</strong></p>
              <p>Total estimado: <strong>{money(alquiler.total_estimado)}</strong></p>
            </div>
            <div className="panel">
              <h2>Servicio completo</h2>
              {servicio.desde ? (
                <>
                  <p>Desde: <strong>{money(servicio.desde.total_estimado)}</strong> ({servicio.desde.nombre})</p>
                  <p>Hasta: <strong>{money(servicio.hasta?.total_estimado)}</strong> ({servicio.hasta?.nombre})</p>
                </>
              ) : (
                <p>No hay paquetes activos disponibles.</p>
              )}
            </div>
          </div>
          <p className="muted">
            Se registro la cotizacion #{cotizacion.id} en estado nuevo. El asesor definira la modalidad final con el cliente.
          </p>
          <div className="inline-actions">
            <Button as={Link} to="/pre-cotizacion" variant="secondary">
              <RotateCcw size={18} />
              Generar otra estimacion
            </Button>
            <Button as="a" href={whatsappUrl || undefined} target="_blank" rel="noreferrer" disabled={!whatsappUrl}>
              <MessageCircle size={18} />
              Continuar por WhatsApp
            </Button>
          </div>
        </article>
      </section>
    </main>
  );
}

function MissingQuote() {
  return (
    <main className="public-page">
      <section className="public-shell page-stack">
        <article className="panel page-stack">
          <h1>No encontramos datos de una pre-cotizacion activa.</h1>
          <p className="muted">Por favor completa el formulario para generar tu estimacion.</p>
          <Button as={Link} to="/pre-cotizacion" variant="secondary">Volver a pre-cotizacion</Button>
        </article>
      </section>
    </main>
  );
}
