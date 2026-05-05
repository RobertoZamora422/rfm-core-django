import {
  BarChart3,
  Boxes,
  CalendarDays,
  ClipboardList,
  DollarSign,
  FileBarChart,
  Home,
  LogOut,
  Package,
  Receipt,
  Settings,
  Users,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { logout } from '../../services/authService';

const sections = [
  {
    title: 'Principal',
    items: [
      { to: '/inicio', label: 'Inicio', icon: Home },
      { to: '/dashboard-financiero', label: 'Dashboard financiero', icon: BarChart3 },
    ],
  },
  {
    title: 'Comercial',
    items: [
      { to: '/paquetes', label: 'Paquetes', icon: Package },
      { to: '/cotizaciones', label: 'Cotizaciones', icon: ClipboardList },
      { to: '/contratos', label: 'Contratos', icon: Receipt },
      { to: '/eventos', label: 'Eventos', icon: CalendarDays },
      { to: '/clientes', label: 'Clientes', icon: Users },
    ],
  },
  {
    title: 'Finanzas',
    items: [
      { to: '/costos-directos', label: 'Costos directos', icon: Boxes },
      { to: '/gastos-fijos', label: 'Gastos fijos', icon: DollarSign },
      { to: '/reportes', label: 'Reportes', icon: FileBarChart },
    ],
  },
  {
    title: 'Sistema',
    items: [{ to: '/configuracion', label: 'Configuración', icon: Settings }],
  },
];

export default function Sidebar({ onNavigate }) {
  const navigate = useNavigate();

  async function handleLogout() {
    onNavigate?.();
    await logout();
    navigate('/login');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <strong>Rancho Flor María</strong>
        <span>Sistema Administrativo</span>
      </div>

      {sections.map((section) => (
        <nav className="sidebar-section" key={section.title}>
          <span className="sidebar-section-title">{section.title}</span>
          {section.items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} className="menu-item" to={item.to} onClick={onNavigate}>
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      ))}

      <button className="logout-button" type="button" onClick={handleLogout}>
        <LogOut size={18} />
        <span>Cerrar sesión</span>
      </button>
    </aside>
  );
}
