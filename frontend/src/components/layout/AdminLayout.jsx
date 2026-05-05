import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

export default function AdminLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  function handleMenuToggle() {
    if (window.matchMedia('(max-width: 900px)').matches) {
      setIsMobileMenuOpen((current) => !current);
      return;
    }

    setIsSidebarCollapsed((current) => !current);
  }

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
  }

  return (
    <div
      className={[
        'admin-layout',
        isSidebarCollapsed ? 'sidebar-collapsed' : '',
        isMobileMenuOpen ? 'sidebar-mobile-open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Sidebar onNavigate={closeMobileMenu} />
      <button className="sidebar-overlay" type="button" aria-label="Cerrar menú" onClick={closeMobileMenu} />
      <div className="admin-shell">
        <Header isMenuOpen={isMobileMenuOpen} onMenuToggle={handleMenuToggle} />
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
