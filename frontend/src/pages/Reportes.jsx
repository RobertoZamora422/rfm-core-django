import { Printer } from 'lucide-react';
import { useState } from 'react';
import DataTable from '../components/tables/DataTable';
import Button from '../components/ui/Button';
import FilterBar from '../components/ui/FilterBar';
import FormField from '../components/ui/FormField';
import PageHeader from '../components/ui/PageHeader';
import useApiData from '../hooks/useApiData';
import { obtenerReporte } from '../services/reportesService';
import { money, percent } from '../utils/formatters';

const current = new Date();
const currentMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;

const reportConfig = {
  financiero: {
    title: 'Reporte financiero',
    cards: [
      ['Ingresos totales', (resumen) => money(resumen.ingresos_totales)],
      ['Costos directos', (resumen) => money(resumen.costos_directos)],
      ['Gastos fijos', (resumen) => money(resumen.gastos_fijos)],
      ['Utilidad neta', (resumen) => money(resumen.utilidad_neta)],
    ],
    columns: [
      { key: 'periodo', label: 'Periodo' },
      { key: 'ingresos', label: 'Ingresos', render: (row) => money(row.ingresos) },
      { key: 'costos_directos', label: 'Costos directos', render: (row) => money(row.costos_directos) },
      { key: 'gastos_fijos', label: 'Gastos fijos', render: (row) => money(row.gastos_fijos) },
      { key: 'utilidad_neta', label: 'Utilidad neta', render: (row) => money(row.utilidad_neta) },
      { key: 'margen_neto', label: 'Margen neto', render: (row) => percent(row.margen_neto) },
    ],
  },
  comercial: {
    title: 'Reporte comercial',
    cards: [
      ['Cotizaciones recibidas', (resumen) => resumen.cotizaciones || 0],
      ['Contratos cerrados', (resumen) => resumen.contratos || 0],
      ['Tasa de conversion', (resumen) => percent(resumen.conversion)],
      ['Estados registrados', (resumen) => Object.values(resumen.estados || {}).reduce((sum, value) => sum + value, 0)],
    ],
    columns: [
      { key: 'periodo', label: 'Periodo' },
      { key: 'cotizaciones', label: 'Cotizaciones' },
      { key: 'contratos', label: 'Contratos' },
      { key: 'conversion', label: 'Conversion', render: (row) => percent(row.conversion) },
    ],
  },
  eventos: {
    title: 'Reporte por tipos de evento',
    cards: [
      ['Tipo con mayor utilidad', (resumen) => resumen.tipo_evento || 'Sin datos'],
      ['Contratos', (resumen) => resumen.contratos || 0],
      ['Ingresos', (resumen) => money(resumen.ingresos)],
      ['Margen', (resumen) => percent(resumen.margen)],
    ],
    columns: [
      { key: 'tipo_evento', label: 'Tipo de evento' },
      { key: 'contratos', label: 'Contratos' },
      { key: 'ingresos', label: 'Ingresos', render: (row) => money(row.ingresos) },
      { key: 'utilidad', label: 'Utilidad', render: (row) => money(row.utilidad) },
      { key: 'margen', label: 'Margen', render: (row) => percent(row.margen) },
    ],
  },
  paquetes: {
    title: 'Reporte por paquetes',
    cards: [
      ['Paquete con mayor utilidad', (resumen) => resumen.paquete || 'Sin datos'],
      ['Contratos', (resumen) => resumen.contratos || 0],
      ['Ingresos', (resumen) => money(resumen.ingresos)],
      ['Margen', (resumen) => percent(resumen.margen)],
    ],
    columns: [
      { key: 'paquete', label: 'Paquete' },
      { key: 'contratos', label: 'Contratos' },
      { key: 'ingresos', label: 'Ingresos', render: (row) => money(row.ingresos) },
      { key: 'utilidad', label: 'Utilidad', render: (row) => money(row.utilidad) },
      { key: 'margen', label: 'Margen', render: (row) => percent(row.margen) },
    ],
  },
};

export default function Reportes() {
  const [filters, setFilters] = useState({ desde: currentMonth, hasta: currentMonth, tipo: 'financiero' });
  const { data: reporte, loading, error } = useApiData(
    () => obtenerReporte(filters.tipo, { desde: filters.desde, hasta: filters.hasta }),
    null,
    [filters.tipo, filters.desde, filters.hasta],
  );
  const config = reportConfig[filters.tipo];
  const rows = reporte?.resultados || [];
  const resumen = reporte?.resumen || {};

  return (
    <section className="page-stack report-print-area">
      <PageHeader title="Reportes" description="Consulta filtrable por periodo con lectura comercial y financiera." />
      <FilterBar>
        <FormField label="Desde">
          <input type="month" value={filters.desde} onChange={(event) => setFilters({ ...filters, desde: event.target.value })} />
        </FormField>
        <FormField label="Hasta">
          <input type="month" value={filters.hasta} onChange={(event) => setFilters({ ...filters, hasta: event.target.value })} />
        </FormField>
        <FormField label="Tipo de reporte">
          <select value={filters.tipo} onChange={(event) => setFilters({ ...filters, tipo: event.target.value })}>
            <option value="financiero">Financiero</option>
            <option value="comercial">Comercial</option>
            <option value="eventos">Eventos</option>
            <option value="paquetes">Paquetes</option>
          </select>
        </FormField>
      </FilterBar>

      {loading ? <p className="muted">Cargando reporte real...</p> : null}
      {error ? <p className="alert alert-error">{error}</p> : null}

      <article className="panel">
        <h2>{config.title}</h2>
        <p className="muted">Periodo: {filters.desde} a {filters.hasta}</p>
      </article>

      <div className="grid-4">
        {config.cards.map(([label, value]) => (
          <article className="panel" key={label}>
            <h2>{label}</h2>
            <strong>{value(resumen)}</strong>
          </article>
        ))}
      </div>

      <DataTable
        columns={config.columns}
        emptyMessage="No hay registros disponibles."
        rows={rows}
      />

      <article className="panel">
        <h2>Interpretacion del reporte</h2>
        <ul className="analysis-list">
          {(reporte?.interpretacion || ['No hay datos suficientes para este periodo.']).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <div className="inline-actions no-print">
        <Button type="button" variant="secondary" onClick={() => window.print()}><Printer size={18} />Imprimir reporte</Button>
      </div>
    </section>
  );
}
