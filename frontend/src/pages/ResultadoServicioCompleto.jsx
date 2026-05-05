import { MessageCircle, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import { obtenerConfiguracion } from '../services/configuracionService';
import { money } from '../utils/formatters';
import { buildWhatsAppUrl, preQuoteMessage } from '../utils/whatsapp';

export default function ResultadoServicioCompleto() {
  const { state } = useLocation();
  const result = state?.result;
  const cotizacion = result?.cotizacion;
  const paquetes = result?.paquetes || [];
  const selectedPackage = result?.paquete;
  const [config, setConfig] = useState(result?.configuracion || null);
  const [error, setError] = useState('');

  useEffect(() => {
    obtenerConfiguracion({ publico: true })
      .then(setConfig)
      .catch(() => setError('No se pudo cargar el WhatsApp configurado del negocio.'));
  }, []);

  if (!result || !cotizacion) {
    return <MissingQuote />;
  }

  const whatsappUrl = buildWhatsAppUrl(config?.whatsapp, preQuoteMessage(result));

  return (
    <main className="public-page">
      <section className="public-shell page-stack">
        <PageHeader title="Resultado de pre-cotizacion" description="Modalidad: servicio completo" />
        <article className="panel page-stack">
          {error ? <p className="alert alert-error">{error}</p> : null}
          <div className="grid-2">
            <p>Cliente: <strong>{result.cliente?.nombre || cotizacion.cliente_nombre}</strong></p>
            <p>Tipo de evento: <strong>{cotizacion.tipo_evento_nombre}</strong></p>
            <p>Invitados: <strong>{cotizacion.numero_invitados}</strong></p>
            <p>Paquete registrado: <strong>{cotizacion.paquete_nombre || selectedPackage?.nombre || 'Por definir con asesor'}</strong></p>
          </div>

          {selectedPackage ? (
            <div className="result-highlight">
              <span>Total estimado con {selectedPackage.nombre}</span>
              <strong>{money(selectedPackage.total_estimado)}</strong>
            </div>
          ) : (
            <p className="muted">No se selecciono un paquete especifico; se muestra la oferta activa para orientar la conversacion comercial.</p>
          )}

          <div className="grid-3">
            {paquetes.length === 0 ? (
              <article className="panel"><p>No hay paquetes activos disponibles.</p></article>
            ) : paquetes.map((paquete) => (
              <article className="card panel" key={paquete.id}>
                <h2>{paquete.nombre}</h2>
                <p>{paquete.descripcion || 'Servicio completo para eventos.'}</p>
                <p>{money(paquete.precio_por_persona)} por persona</p>
                <p>Total estimado: <strong>{money(paquete.total_estimado)}</strong></p>
              </article>
            ))}
          </div>

          <p className="muted">
            Se registro la cotizacion #{cotizacion.id} en estado nuevo para seguimiento administrativo.
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
