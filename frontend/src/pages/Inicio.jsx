import {
  AlertCircle,
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  FileBarChart,
  HandCoins,
  Package,
  ReceiptText,
  Tags,
  Users,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import MetricCard from '../components/cards/MetricCard';
import QuickActionCard from '../components/cards/QuickActionCard';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import useApiData from '../hooks/useApiData';
import isotipoRancho from '../isotipo-rancho.svg';
import { obtenerInicioResumen } from '../services/inicioService';

const dateFormatter = new Intl.DateTimeFormat('es-EC', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const emptyResumen = {
  fecha_referencia: '',
  kpis: {
    cotizaciones_nuevas: 0,
    cotizaciones_mes: 0,
    contratos_evento_mes: 0,
    eventos_realizados_mes: 0,
  },
  eventos_proximos: [],
  pendientes_importantes: [],
};

const quickActionGroups = [
  {
    title: 'Gestión comercial',
    actions: [
      {
        href: '/pre-cotizacion',
        target: '_blank',
        icon: ClipboardPlus,
        title: 'Pre-cotización pública',
        description: 'Abrir el formulario que usa el cliente externo.',
      },
      {
        to: '/cotizaciones',
        icon: ReceiptText,
        title: 'Gestionar cotizaciones',
        description: 'Ver / Registrar cotizaciones.',
      },
      {
        to: '/contratos',
        icon: ClipboardCheck,
        title: 'Gestionar contratos',
        description: 'Ver / Crear un contrato para una venta cerrada.',
      },
      {
        to: '/paquetes',
        icon: Package,
        title: 'Gestionar paquetes',
        description: 'Administrar precios por persona y paquetes activos.',
      },
    ],
  },
  {
    title: 'Finanzas y reportes',
    actions: [
      {
        to: '/costos-directos',
        icon: BadgeDollarSign,
        title: 'Costos directos',
        description: 'Ver o añadir costos asociados a un evento.',
      },
      {
        to: '/gastos-fijos',
        icon: WalletCards,
        title: 'Gastos fijos',
        description: 'Ver o añadir gastos mensuales del negocio.',
      },
      {
        to: '/dashboard-financiero',
        icon: BarChart3,
        title: 'Informe financiero mensual',
        description: 'Revisar utilidad, margen y conversión mensual.',
      },
      {
        to: '/reportes',
        icon: FileBarChart,
        title: 'Reportes',
        description: 'Consultar información comercial y financiera por periodo.',
      },
    ],
  },
];

const alertIcons = {
  paquetes_sin_precio: Tags,
  cotizaciones_nuevas_sin_contacto: ReceiptText,
  eventos_proximos_con_saldo: BadgeDollarSign,
  eventos_realizados_sin_costos: HandCoins,
  cotizaciones_sin_contrato: ClipboardCheck,
  clientes_sin_telefono: Users,
};

function capitalizeFirst(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseDateOnly(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDateLong(value) {
  const date = parseDateOnly(value) || new Date();
  return capitalizeFirst(dateFormatter.format(date));
}

function eventTitle(contrato) {
  return contrato.evento_nombre || 'Evento sin nombre';
}

function packageTitle(contrato) {
  return contrato.paquete_nombre || 'Sin paquete';
}

function PendingItem({ alert }) {
  const Icon = alertIcons[alert.tipo] || AlertCircle;
  return (
    <Link className="pending-item" to={alert.ruta}>
      <span aria-hidden="true">
        <Icon size={18} />
      </span>
      <strong>
        <small>{alert.prioridad}</small>
        {alert.texto}
      </strong>
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}

function UpcomingItem({ contrato }) {
  return (
    <Link className="upcoming-item" to={`/contratos/${contrato.id}`}>
      <div>
        <strong>{contrato.cliente_nombre || 'Cliente sin registrar'}</strong>
        <span>{eventTitle(contrato)} - {packageTitle(contrato)}</span>
      </div>
      <div className="upcoming-meta">
        <time dateTime={contrato.fecha_evento}>{contrato.fecha_evento || 'Fecha no registrada'}</time>
        <StatusBadge value={contrato.estado_contrato} />
        <StatusBadge value={contrato.estado_pago} />
      </div>
    </Link>
  );
}

export default function Inicio() {
  const { data: resumen, loading, error } = useApiData(() => obtenerInicioResumen(), emptyResumen, []);
  const kpis = resumen.kpis || emptyResumen.kpis;
  const eventosProximos = resumen.eventos_proximos || [];
  const pendientesImportantes = resumen.pendientes_importantes || [];
  const fechaReferencia = resumen.fecha_referencia || new Date().toISOString().slice(0, 10);

  return (
    <section className="inicio-page">
      <header className="inicio-hero">
        <div>
          <h1>
            Bienvenido
            <img className="inicio-brand-mark" src={isotipoRancho} alt="" aria-hidden="true" />
          </h1>
          <time dateTime={fechaReferencia}>{formatDateLong(fechaReferencia)}</time>
          <p>Resumen operativo y accesos rápidos para la gestión diaria.</p>
        </div>
      </header>

      <div className="inicio-kpi-grid">
        <MetricCard
          icon={ClipboardList}
          title="Cotizaciones nuevas"
          value={kpis.cotizaciones_nuevas}
          description="Solicitudes en estado nuevo."
        />
        <MetricCard
          icon={ReceiptText}
          title="Cotizaciones del mes"
          value={kpis.cotizaciones_mes}
          description="Total de cotizaciones creadas durante el mes actual."
        />
        <MetricCard
          icon={CalendarClock}
          title="Contratos con evento este mes"
          value={kpis.contratos_evento_mes}
          description="Contratos confirmados cuyo evento está programado dentro del mes actual."
        />
        <MetricCard
          icon={CheckCircle2}
          title="Eventos realizados del mes"
          value={kpis.eventos_realizados_mes}
          description="Eventos confirmados del mes actual con fecha igual o anterior a hoy."
        />
      </div>

      {loading ? <p className="muted">Cargando resumen operativo...</p> : null}
      {error ? <p className="alert alert-error">{error}</p> : null}

      <section className="inicio-section">
        <div className="inicio-section-heading">
          <h2>Accesos rápidos</h2>
        </div>
        {quickActionGroups.map((group) => (
          <div className="quick-action-group" key={group.title}>
            <h3>{group.title}</h3>
            <div className="quick-action-grid">
              {group.actions.map((action) => (
                <QuickActionCard key={action.title} {...action} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="inicio-section">
        <div className="inicio-section-heading">
          <h2>Estado de operaciones</h2>
        </div>
        <div className="operations-grid">
          <article className="operations-panel">
            <div className="operations-panel-heading">
              <div>
                <h3>Eventos próximos</h3>
                <p>Contratos confirmados ordenados por fecha de evento.</p>
              </div>
              <CalendarCheck2 size={22} aria-hidden="true" />
            </div>

            {eventosProximos.length > 0 ? (
              <div className="upcoming-list">
                {eventosProximos.map((contrato) => (
                  <UpcomingItem contrato={contrato} key={contrato.id} />
                ))}
              </div>
            ) : (
              <p className="empty-state">No hay eventos programados próximamente.</p>
            )}

            <div className="operations-footer">
              <Button as={Link} to={`/contratos?desde=${fechaReferencia}`} variant="secondary">
                Ver contratos próximos
                <ArrowRight size={16} />
              </Button>
            </div>
          </article>

          <article className="operations-panel">
            <div className="operations-panel-heading">
              <div>
                <h3>Pendientes importantes</h3>
                <p>Alertas automáticas de seguimiento diario.</p>
              </div>
              <AlertCircle size={22} aria-hidden="true" />
            </div>

            {pendientesImportantes.length > 0 ? (
              <div className="pending-list">
                {pendientesImportantes.map((alert) => <PendingItem alert={alert} key={alert.tipo} />)}
              </div>
            ) : (
              <p className="empty-state">No hay pendientes importantes por ahora.</p>
            )}
          </article>
        </div>
      </section>
    </section>
  );
}
