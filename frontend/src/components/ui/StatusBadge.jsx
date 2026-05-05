const labels = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  confirmado: 'Confirmado',
  convertido: 'Convertido',
  descartado: 'Descartado',
  pendiente: 'Pendiente',
  abonado: 'Abonado',
  pagado: 'Pagado',
  cancelado: 'Cancelado',
  anulado: 'Anulado',
  activo: 'Activo',
  inactivo: 'Inactivo',
};

export default function StatusBadge({ value }) {
  const key = String(value || '').toLowerCase();
  return <span className={`status-badge status-${key}`}>{labels[key] || value}</span>;
}
