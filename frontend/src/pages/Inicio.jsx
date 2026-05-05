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
import { contratosService } from '../services/contratosService';
import { cotizacionesService } from '../services/cotizacionesService';
import { paquetesService } from '../services/paquetesService';
import isotipoRancho from '../isotipo-rancho.svg';

const dateFormatter = new Intl.DateTimeFormat('es-EC', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

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

function capitalizeFirst(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateLong(date) {
  return capitalizeFirst(dateFormatter.format(date));
}

function parseDateOnly(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function normalize(value) {
  return String(value || '').toLowerCase();
}

function getToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toDateValue(date) {
  return date.toISOString().slice(0, 10);
}

function isSameMonth(date, baseDate) {
  return date?.getFullYear() === baseDate.getFullYear() && date?.getMonth() === baseDate.getMonth();
}

function isOnOrAfter(date, baseDate) {
  return date && date.getTime() >= baseDate.getTime();
}

function isOnOrBefore(date, baseDate) {
  return date && date.getTime() <= baseDate.getTime();
}

function isPendingConfirmation(contrato) {
  return normalize(contrato.estado_contrato) === 'pendiente_confirmacion';
}

function isActiveContract(contrato) {
  return normalize(contrato.estado_contrato) !== 'cancelado';
}

function isConfirmedOrActiveContract(contrato) {
  return isActiveContract(contrato) && !isPendingConfirmation(contrato);
}

function getPendingBalance(contrato) {
  if (contrato.saldo_pendiente !== undefined && contrato.saldo_pendiente !== null) {
    return Number(contrato.saldo_pendiente || 0);
  }
  if (normalize(contrato.estado_pago) === 'pagado') return 0;
  return Number(contrato.valor_final || 0);
}

function hasPhone(value) {
  return Boolean(String(value || '').trim());
}

function eventTitle(contrato) {
  return contrato.evento_nombre || 'Evento sin nombre';
}

function packageTitle(contrato) {
  return contrato.paquete_nombre || 'Sin paquete';
}

function getEventBadgeValue(contrato) {
  return contrato.estado_pago || contrato.estado_contrato || 'pendiente';
}

function getUpcomingContracts(contratos, today) {
  return contratos
    .filter((contrato) => {
      const eventDate = parseDateOnly(contrato.fecha_evento);
      return isConfirmedOrActiveContract(contrato) && isOnOrAfter(eventDate, today);
    })
    .sort((a, b) => parseDateOnly(a.fecha_evento) - parseDateOnly(b.fecha_evento));
}

function buildOperationalKpis({ cotizaciones, contratos, today }) {
  return {
    cotizacionesNuevas: cotizaciones.filter((item) => ['nuevo', 'nueva', 'pendiente'].includes(normalize(item.estado))).length,
    cotizacionesMes: cotizaciones.filter((item) => isSameMonth(new Date(item.fecha_registro), today)).length,
    contratosEventoMes: contratos.filter((contrato) => {
      const eventDate = parseDateOnly(contrato.fecha_evento);
      return isConfirmedOrActiveContract(contrato) && isSameMonth(eventDate, today);
    }).length,
    eventosRealizadosMes: contratos.filter((contrato) => {
      const eventDate = parseDateOnly(contrato.fecha_evento);
      return isConfirmedOrActiveContract(contrato) && isSameMonth(eventDate, today) && isOnOrBefore(eventDate, today);
    }).length,
  };
}

function buildPendingAlerts({ cotizaciones, contratos, paquetes, today }) {
  const in15Days = addDays(today, 15);
  const paquetesSinPrecio = paquetes.filter((paquete) => paquete.activo && Number(paquete.precio_por_persona || 0) <= 0).length;
  const cotizacionesNuevas = cotizaciones.filter((item) => (
    ['nuevo', 'nueva', 'pendiente', 'pendiente_revision'].includes(normalize(item.estado)) && !item.ultimo_contacto
  )).length;
  const eventosConSaldo = contratos.filter((contrato) => {
    const eventDate = parseDateOnly(contrato.fecha_evento);
    return isConfirmedOrActiveContract(contrato)
      && isOnOrAfter(eventDate, today)
      && isOnOrBefore(eventDate, in15Days)
      && getPendingBalance(contrato) > 0;
  }).length;
  const realizadosSinCostos = contratos.filter((contrato) => {
    const eventDate = parseDateOnly(contrato.fecha_evento);
    return isConfirmedOrActiveContract(contrato)
      && eventDate
      && eventDate.getTime() < today.getTime()
      && Number(contrato.total_costos_directos || 0) <= 0;
  }).length;
  const contratosPendientes = contratos.filter((contrato) => isPendingConfirmation(contrato)).length;
  const clientesSinTelefono = new Set();

  cotizaciones
    .filter((item) => !['descartado', 'convertido'].includes(normalize(item.estado)))
    .forEach((item) => {
      if (!hasPhone(item.cliente_telefono)) clientesSinTelefono.add(item.cliente || item.cliente_nombre || item.id);
    });

  contratos
    .filter((contrato) => isActiveContract(contrato))
    .forEach((contrato) => {
      if (!hasPhone(contrato.cliente_telefono)) clientesSinTelefono.add(contrato.cotizacion || contrato.cliente_nombre || contrato.id);
    });

  return [
    paquetesSinPrecio > 0
      ? {
          to: '/paquetes',
          icon: Tags,
          priority: 'Alta prioridad',
          text: `${paquetesSinPrecio} paquetes activos no tienen precio por persona definido.`,
        }
      : null,
    cotizacionesNuevas > 0
      ? {
          to: '/cotizaciones',
          icon: ReceiptText,
          priority: 'Alta prioridad',
          text: `${cotizacionesNuevas} cotizaciones nuevas están pendientes de revisión o contacto.`,
        }
      : null,
    eventosConSaldo > 0
      ? {
          to: `/contratos?desde=${toDateValue(today)}`,
          icon: BadgeDollarSign,
          priority: 'Alta prioridad',
          text: `${eventosConSaldo} eventos próximos tienen saldo o pago pendiente en los próximos 15 días.`,
        }
      : null,
    realizadosSinCostos > 0
      ? {
          to: '/costos-directos',
          icon: HandCoins,
          priority: 'Alta prioridad',
          text: `${realizadosSinCostos} eventos realizados no tienen costos directos registrados.`,
        }
      : null,
    contratosPendientes > 0
      ? {
          to: '/contratos',
          icon: ClipboardCheck,
          priority: 'Media prioridad',
          text: `${contratosPendientes} contratos están pendientes de confirmación.`,
        }
      : null,
    clientesSinTelefono.size > 0
      ? {
          to: '/clientes',
          icon: Users,
          priority: 'Media prioridad',
          text: `${clientesSinTelefono.size} clientes con gestión activa no tienen teléfono registrado.`,
        }
      : null,
  ].filter(Boolean).slice(0, 5);
}

function PendingItem({ alert }) {
  const Icon = alert.icon;
  return (
    <Link className="pending-item" to={alert.to}>
      <span aria-hidden="true">
        <Icon size={18} />
      </span>
      <strong>
        <small>{alert.priority}</small>
        {alert.text}
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
        <span>{eventTitle(contrato)} · {packageTitle(contrato)}</span>
      </div>
      <div className="upcoming-meta">
        <time dateTime={contrato.fecha_evento}>{contrato.fecha_evento || 'Fecha no registrada'}</time>
        <StatusBadge value={getEventBadgeValue(contrato)} />
      </div>
    </Link>
  );
}

export default function Inicio() {
  const today = getToday();
  const { data: cotizaciones, loading: loadingCotizaciones, error: cotizacionesError } = useApiData(() => cotizacionesService.list(), [], []);
  const { data: contratos, loading: loadingContratos, error: contratosError } = useApiData(() => contratosService.list(), [], []);
  const { data: paquetes, loading: loadingPaquetes, error: paquetesError } = useApiData(() => paquetesService.list(), [], []);
  const {
    cotizacionesNuevas,
    cotizacionesMes,
    contratosEventoMes,
    eventosRealizadosMes,
  } = buildOperationalKpis({ cotizaciones, contratos, today });
  const proximosContratos = getUpcomingContracts(contratos, today);
  const visibleUpcoming = proximosContratos.slice(0, 5);
  const pendingAlerts = buildPendingAlerts({ cotizaciones, contratos, paquetes, today });
  const isLoading = loadingCotizaciones || loadingContratos || loadingPaquetes;
  const errors = [cotizacionesError, contratosError, paquetesError].filter(Boolean);

  return (
    <section className="inicio-page">
      <header className="inicio-hero">
        <div>
          <h1>
            Bienvenido
            <img className="inicio-brand-mark" src={isotipoRancho} alt="" aria-hidden="true" />
          </h1>
          <time dateTime={toDateValue(today)}>{formatDateLong(today)}</time>
          <p>Resumen operativo y accesos rápidos para la gestión diaria.</p>
        </div>
      </header>

      <div className="inicio-kpi-grid">
        <MetricCard
          icon={ClipboardList}
          title="Cotizaciones nuevas"
          value={cotizacionesNuevas}
          description="Solicitudes en estado Nueva o pendientes de contacto."
        />
        <MetricCard
          icon={ReceiptText}
          title="Cotizaciones del mes"
          value={cotizacionesMes}
          description="Total de cotizaciones creadas durante el mes actual."
        />
        <MetricCard
          icon={CalendarClock}
          title="Contratos con evento este mes"
          value={contratosEventoMes}
          description="Contratos confirmados cuyo evento está programado dentro del mes actual."
        />
        <MetricCard
          icon={CheckCircle2}
          title="Eventos realizados del mes"
          value={eventosRealizadosMes}
          description="Eventos del mes actual con fecha igual o anterior a la fecha actual."
        />
      </div>

      {isLoading ? <p className="muted">Cargando resumen operativo...</p> : null}
      {errors.map((error, index) => <p className="alert alert-error" key={`${error}-${index}`}>{error}</p>)}

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
                <p>Contratos activos ordenados por fecha de evento.</p>
              </div>
              <CalendarCheck2 size={22} aria-hidden="true" />
            </div>

            {visibleUpcoming.length > 0 ? (
              <div className="upcoming-list">
                {visibleUpcoming.map((contrato) => (
                  <UpcomingItem contrato={contrato} key={contrato.id} />
                ))}
              </div>
            ) : (
              <p className="empty-state">No hay eventos programados próximamente.</p>
            )}

            <div className="operations-footer">
              <Button as={Link} to={`/contratos?desde=${toDateValue(today)}`} variant="secondary">
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

            {pendingAlerts.length > 0 ? (
              <div className="pending-list">
                {pendingAlerts.map((alert) => <PendingItem alert={alert} key={alert.text} />)}
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
