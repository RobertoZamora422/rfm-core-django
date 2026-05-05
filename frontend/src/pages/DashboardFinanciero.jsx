import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleDollarSign,
  Minus,
  PackageCheck,
  ReceiptText,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import FilterBar from '../components/ui/FilterBar';
import FormField from '../components/ui/FormField';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import { useState } from 'react';
import useApiData from '../hooks/useApiData';
import { obtenerDashboardFinanciero } from '../services/finanzasService';
import { money, percent } from '../utils/formatters';

const current = new Date();
const defaultPeriod = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;

const chartColors = {
  ingresos: '#2563eb',
  costos: '#f97316',
  gastos: '#7c3aed',
  utilidad: '#059669',
  margen: '#0f766e',
  anterior: '#94a3b8',
  actual: '#4f46e5',
  pendiente: '#dc2626',
};

function parsePeriod(period) {
  const [anio, mes] = period.split('-').map(Number);
  return { anio, mes };
}

function hasChartData(rows, keys) {
  return Array.isArray(rows) && rows.some((row) => keys.some((key) => Number(row[key] || 0) !== 0));
}

function compactMoney(value) {
  const number = Number(value || 0);
  if (Math.abs(number) >= 1000) return `$${(number / 1000).toFixed(1)}k`;
  return `$${number.toFixed(0)}`;
}

function tooltipMoney(value, name) {
  return [money(value), name];
}

function tooltipNumber(value, name) {
  return [Number(value || 0).toFixed(2), name];
}

function EmptyState({ children }) {
  return <p className="empty-state">{children}</p>;
}

function Trend({ comparison }) {
  const direction = comparison?.direccion || 'none';
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : direction === 'flat' ? Minus : null;

  return (
    <div className={`financial-trend trend-${direction}`}>
      {Icon ? <Icon size={16} /> : null}
      <span>{comparison?.texto || 'Sin datos suficientes para comparar'}</span>
      {comparison?.texto_diferencia ? <small>{comparison.texto_diferencia}</small> : null}
    </div>
  );
}

function FinancialKpiCard({ item, variant }) {
  const value = Number(item?.valor || 0);
  const isEmpty = value === 0;

  return (
    <article className={`financial-kpi-card ${variant ? `financial-kpi-${variant}` : ''}`}>
      <div className="financial-kpi-heading">
        <span>{item?.titulo}</span>
      </div>
      <strong>{money(value)}</strong>
      {item?.margen !== undefined ? <p>Margen: <b>{percent(item.margen)}</b></p> : null}
      {item?.proporcion_ingresos ? <p>{item.proporcion_ingresos.texto}</p> : null}
      {item?.detalle ? <p>{item.detalle}</p> : null}
      {isEmpty && item?.estado_vacio ? <p className="financial-empty-note">{item.estado_vacio}</p> : null}
      <Trend comparison={item?.comparacion} />
    </article>
  );
}

function CommercialCard({ title, value, detail, icon: Icon }) {
  return (
    <article className="commercial-card">
      <span className="commercial-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div>
        <p>{title}</p>
        <strong>{value || 'Sin datos suficientes'}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
    </article>
  );
}

function SectionHeading({ title, subtitle }) {
  return (
    <div className="dashboard-section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </div>
  );
}

function ChartPanel({ title, subtitle, hasData, emptyMessage, children }) {
  return (
    <article className="panel chart-panel">
      <div className="chart-panel-heading">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {hasData ? <div className="chart-box">{children}</div> : <EmptyState>{emptyMessage}</EmptyState>}
    </article>
  );
}

function buildPaymentRows(cobranza) {
  return [
    { estado: 'Pagados', total: cobranza?.pagados || 0, fill: '#16a34a' },
    { estado: 'Abonados', total: cobranza?.abonados || 0, fill: '#ca8a04' },
    { estado: 'Pendientes', total: cobranza?.pendientes || 0, fill: '#dc2626' },
    { estado: 'Cancelados', total: cobranza?.cancelados || 0, fill: '#6b7280' },
  ];
}

export default function DashboardFinanciero() {
  const [period, setPeriod] = useState(defaultPeriod);
  const params = parsePeriod(period);
  const { data, loading, error } = useApiData(
    () => obtenerDashboardFinanciero(params),
    null,
    [period],
  );

  const kpis = data?.kpis || {};
  const desempeno = data?.desempeno_comercial || {};
  const evolucion = data?.evolucion_mensual || [];
  const comparativo = data?.comparativo_mes_anterior;
  const paquetes = data?.rentabilidad_por_paquete || [];
  const tiposEvento = data?.analisis_por_tipo_evento || [];
  const topEventos = data?.top_eventos_rentables || [];
  const cobranza = data?.estado_pagos_cobranza || {};
  const paymentRows = buildPaymentRows(cobranza);

  return (
    <section className="page-stack financial-dashboard">
      <PageHeader
        title="Dashboard financiero"
        description="Analisis mensual del desempeno comercial y financiero."
      />
      <FilterBar>
        <FormField label="Periodo">
          <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
        </FormField>
      </FilterBar>

      {loading ? <p className="muted">Cargando indicadores financieros reales...</p> : null}
      {error ? <p className="alert alert-error">{error}</p> : null}
      {!loading && !data ? <EmptyState>Aun no hay informacion suficiente para generar una interpretacion financiera.</EmptyState> : null}

      {data ? (
        <>
          <div className="financial-kpi-grid">
            <FinancialKpiCard item={kpis.ingresos_mes} />
            <FinancialKpiCard item={kpis.costos_directos_mes} />
            <FinancialKpiCard item={kpis.utilidad_bruta} />
            <FinancialKpiCard item={kpis.gastos_fijos_mes} />
            <FinancialKpiCard item={kpis.utilidad_neta} variant="primary" />
            <FinancialKpiCard item={kpis.ticket_promedio} />
          </div>

          <section className="page-stack">
            <SectionHeading title="Desempeño comercial" />
            <div className="commercial-grid">
              <CommercialCard
                icon={PackageCheck}
                title="Paquete mas vendido"
                value={desempeno.paquete_mas_vendido?.nombre}
                detail={desempeno.paquete_mas_vendido ? `${desempeno.paquete_mas_vendido.contratos} contratos` : ''}
              />
              <CommercialCard
                icon={TrendingUp}
                title="Paquete mas rentable"
                value={desempeno.paquete_mas_rentable?.nombre}
                detail={desempeno.paquete_mas_rentable ? `Margen promedio: ${percent(desempeno.paquete_mas_rentable.margen)}` : ''}
              />
              <CommercialCard
                icon={ReceiptText}
                title="Tipo de evento mas frecuente"
                value={desempeno.tipo_evento_mas_frecuente?.nombre}
                detail={desempeno.tipo_evento_mas_frecuente ? `${desempeno.tipo_evento_mas_frecuente.eventos} eventos` : ''}
              />
              <CommercialCard
                icon={CircleDollarSign}
                title="Tipo de evento mas rentable"
                value={desempeno.tipo_evento_mas_rentable?.nombre}
                detail={desempeno.tipo_evento_mas_rentable ? `Margen promedio: ${percent(desempeno.tipo_evento_mas_rentable.margen)}` : ''}
              />
            </div>
          </section>

          <section className="page-stack">
            <SectionHeading
              title="Analisis comparativo del negocio"
              subtitle="Compara el desempeno financiero del periodo actual frente a meses anteriores."
            />
            <div className="dashboard-chart-grid">
              <ChartPanel
                title="Evolucion mensual del negocio"
                subtitle="Ingresos, costos, gastos y utilidad neta."
                hasData={hasChartData(evolucion, ['ingresos', 'costos_directos', 'gastos_fijos', 'utilidad_neta'])}
                emptyMessage="No hay suficiente informacion historica para graficar la evolucion mensual."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolucion} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="periodo_label" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} width={58} />
                    <Tooltip formatter={tooltipMoney} />
                    <Legend />
                    <Line type="monotone" dataKey="ingresos" name="Ingresos" stroke={chartColors.ingresos} strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="costos_directos" name="Costos directos" stroke={chartColors.costos} strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="gastos_fijos" name="Gastos fijos" stroke={chartColors.gastos} strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="utilidad_neta" name="Utilidad neta" stroke={chartColors.utilidad} strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel
                title="Mes actual vs mes anterior"
                subtitle={`${comparativo?.mes_actual || ''} frente a ${comparativo?.mes_anterior || ''}`}
                hasData={Boolean(comparativo?.hay_datos)}
                emptyMessage="No hay suficiente informacion para comparar con el mes anterior."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparativo?.categorias || []} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} />
                    <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} width={58} />
                    <Tooltip formatter={tooltipMoney} />
                    <Legend />
                    <Bar dataKey="anterior" name="Mes anterior" fill={chartColors.anterior} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="actual" name="Mes actual" fill={chartColors.actual} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel
                title="Rentabilidad por paquete"
                subtitle="Contratos, ingresos, utilidad y margen promedio."
                hasData={paquetes.length > 0}
                emptyMessage="Sin datos suficientes para analizar paquetes en este periodo."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={paquetes} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="nombre" tickLine={false} axisLine={false} />
                    <YAxis yAxisId="money" tickFormatter={compactMoney} tickLine={false} axisLine={false} width={58} />
                    <YAxis yAxisId="percent" orientation="right" tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} width={48} />
                    <Tooltip formatter={(value, name) => (name === 'Margen promedio' ? [`${Number(value || 0).toFixed(2)}%`, name] : tooltipMoney(value, name))} />
                    <Legend />
                    <Bar yAxisId="money" dataKey="ingresos" name="Ingresos" fill={chartColors.ingresos} radius={[6, 6, 0, 0]} />
                    <Bar yAxisId="money" dataKey="utilidad" name="Utilidad" fill={chartColors.utilidad} radius={[6, 6, 0, 0]} />
                    <Line yAxisId="percent" type="monotone" dataKey="margen_promedio" name="Margen promedio" stroke={chartColors.margen} strokeWidth={3} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel
                title="Analisis por tipo de evento"
                subtitle="Frecuencia, ingresos, utilidad y margen por tipo real de evento."
                hasData={tiposEvento.length > 0}
                emptyMessage="Sin datos suficientes para analizar tipos de evento en este periodo."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tiposEvento} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="nombre" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} width={58} />
                    <Tooltip formatter={tooltipMoney} />
                    <Legend />
                    <Bar dataKey="ingresos" name="Ingresos" fill={chartColors.ingresos} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="utilidad" name="Utilidad" fill={chartColors.utilidad} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel
                title="Top eventos rentables del mes"
                subtitle="Contratos activos ordenados por utilidad."
                hasData={topEventos.length > 0}
                emptyMessage="Aun no hay contratos confirmados para identificar eventos rentables."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={topEventos} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tickFormatter={compactMoney} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="cliente" tickLine={false} axisLine={false} width={110} />
                    <Tooltip formatter={tooltipMoney} />
                    <Bar dataKey="utilidad" name="Utilidad" fill={chartColors.utilidad} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel
                title="Estado de pagos / cobranza"
                subtitle={`Monto pendiente por cobrar: ${money(cobranza.monto_pendiente_por_cobrar)}`}
                hasData={Number(cobranza.total_contratos || 0) > 0}
                emptyMessage={cobranza.estado_vacio || 'No hay contratos registrados en este mes para analizar cobranza.'}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentRows} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="estado" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                    <Tooltip formatter={tooltipNumber} />
                    <Bar dataKey="total" name="Contratos" radius={[6, 6, 0, 0]} fill={chartColors.actual} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>

            {topEventos.length > 0 ? (
              <div className="top-events-list">
                {topEventos.map((evento) => (
                  <Link to={evento.detalle_url} className="top-event-link" key={evento.id}>
                    <span>
                      <strong>{evento.cliente}</strong>
                      <small>{evento.tipo_evento} - {evento.paquete}</small>
                    </span>
                    <b>{money(evento.utilidad)}</b>
                    <ArrowRight size={16} />
                  </Link>
                ))}
              </div>
            ) : null}
          </section>

          <article className="panel interpretation-panel">
            <div>
              <h2>Interpretacion del periodo</h2>
              <p>{data.periodo?.label}</p>
            </div>
            <ul className="analysis-list">
              {(data.interpretacion || ['Aun no hay informacion suficiente para generar una interpretacion financiera.']).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {Number(cobranza.monto_pendiente_por_cobrar || 0) > 0 ? (
              <Button as={Link} to="/contratos" variant="secondary">
                <WalletCards size={18} />
                Revisar contratos con saldo
              </Button>
            ) : null}
          </article>
        </>
      ) : null}
    </section>
  );
}
