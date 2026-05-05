import { Menu, UserCircle, X } from 'lucide-react';
import { getStoredUser } from '../../services/authService';

export default function Header({ isMenuOpen, onMenuToggle }) {
  const user = getStoredUser();

  return (
    <header className="topbar">
      <div className="topbar-main">
        <button
          className="topbar-menu-button"
          type="button"
          aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={isMenuOpen}
          onClick={onMenuToggle}
        >
          {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className="topbar-brand">
          <strong>Rancho Flor María</strong>
          <span>Sistema Administrativo</span>
        </div>
        <span className="topbar-title">Sistema de pre-cotización, gestión comercial y rentabilidad</span>
      </div>

      <div className="topbar-user">
        <span>{user?.username || 'Administrador'}</span>
        <span className="topbar-avatar">
          <UserCircle size={20} />
        </span>
      </div>
    </header>
  );
}
