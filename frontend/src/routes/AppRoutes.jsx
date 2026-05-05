import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import Clientes from '../pages/Clientes';
import Configuracion from '../pages/Configuracion';
import Contratos from '../pages/Contratos';
import ConvertirContrato from '../pages/ConvertirContrato';
import CostosDirectos from '../pages/CostosDirectos';
import Cotizaciones from '../pages/Cotizaciones';
import DashboardFinanciero from '../pages/DashboardFinanciero';
import DetalleContrato from '../pages/DetalleContrato';
import DetalleCotizacion from '../pages/DetalleCotizacion';
import Eventos from '../pages/Eventos';
import GastosFijos from '../pages/GastosFijos';
import Inicio from '../pages/Inicio';
import Login from '../pages/Login';
import Paquetes from '../pages/Paquetes';
import PreCotizacion from '../pages/PreCotizacion';
import Reportes from '../pages/Reportes';
import ResultadoAlquiler from '../pages/ResultadoAlquiler';
import ResultadoComparacion from '../pages/ResultadoComparacion';
import ResultadoServicioCompleto from '../pages/ResultadoServicioCompleto';
import { clearSession, isAuthenticated, validateSession } from '../services/authService';

function ProtectedRoute() {
  const [status, setStatus] = useState(isAuthenticated() ? 'checking' : 'guest');

  useEffect(() => {
    if (!isAuthenticated()) {
      setStatus('guest');
      return;
    }
    let alive = true;
    validateSession()
      .then(() => {
        if (alive) setStatus('authenticated');
      })
      .catch(() => {
        clearSession();
        if (alive) setStatus('guest');
      });
    return () => {
      alive = false;
    };
  }, []);

  if (status === 'checking') {
    return <main className="route-loading">Validando sesion...</main>;
  }
  return status === 'authenticated' ? <AdminLayout /> : <Navigate replace to="/login" />;
}

function RootRedirect() {
  return <Navigate replace to={isAuthenticated() ? '/inicio' : '/login'} />;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/pre-cotizacion" element={<PreCotizacion />} />
        <Route path="/pre-cotizacion/alquiler" element={<ResultadoAlquiler />} />
        <Route path="/pre-cotizacion/servicio-completo" element={<ResultadoServicioCompleto />} />
        <Route path="/pre-cotizacion/comparacion" element={<ResultadoComparacion />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/inicio" element={<Inicio />} />
          <Route path="/dashboard-financiero" element={<DashboardFinanciero />} />
          <Route path="/paquetes" element={<Paquetes />} />
          <Route path="/cotizaciones" element={<Cotizaciones />} />
          <Route path="/cotizaciones/:id" element={<DetalleCotizacion />} />
          <Route path="/cotizaciones/:id/convertir" element={<ConvertirContrato />} />
          <Route path="/contratos" element={<Contratos />} />
          <Route path="/contratos/:id" element={<DetalleContrato />} />
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/costos-directos" element={<CostosDirectos />} />
          <Route path="/gastos-fijos" element={<GastosFijos />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/configuracion" element={<Configuracion />} />
        </Route>
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
