export function formatWhatsAppNumber(rawValue) {
  const value = String(rawValue || '').replace(/[^\d+]/g, '');
  if (!value) return '';
  const withoutPlus = value.startsWith('+') ? value.slice(1) : value;
  if (withoutPlus.startsWith('593')) return withoutPlus;
  if (withoutPlus.startsWith('0') && withoutPlus.length >= 10) {
    return `593${withoutPlus.slice(1)}`;
  }
  return withoutPlus;
}

export function buildWhatsAppUrl(rawValue, message) {
  const number = formatWhatsAppNumber(rawValue);
  if (!number) return '';
  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${number}${query}`;
}

export function preQuoteMessage(result) {
  const cotizacion = result?.cotizacion;
  const cliente = result?.cliente;
  if (!cotizacion) {
    return 'Hola, deseo continuar con una pre-cotizacion para mi evento.';
  }
  return [
    `Hola, deseo continuar con la pre-cotizacion #${cotizacion.id}.`,
    `Cliente: ${cliente?.nombre || cotizacion.cliente_nombre}.`,
    `Evento: ${cotizacion.tipo_evento_nombre}.`,
    `Invitados: ${cotizacion.numero_invitados}.`,
    `Monto estimado: $${Number(cotizacion.monto_estimado || 0).toFixed(2)}.`,
  ].join(' ');
}
