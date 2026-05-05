export function money(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));
}

export function percent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

export function dateText(value) {
  if (!value) return 'No registrado';
  return String(value);
}

export function serviceText(value) {
  const labels = {
    alquiler: 'Alquiler del local',
    servicio_completo: 'Servicio completo',
    no_seguro: 'Aun no esta seguro',
  };
  return labels[value] || value || 'No registrado';
}
