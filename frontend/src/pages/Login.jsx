import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import logoRancho from '../logo-rancho.svg';
import { login } from '../services/authService';

export default function Login() {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function updateCredential(field, value) {
    setCredentials((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!credentials.username.trim() || !credentials.password.trim()) {
      setError('Ingresa tu usuario y contraseña.');
      return;
    }

    setLoading(true);
    try {
      await login(credentials);
      navigate('/inicio');
    } catch {
      setError('No se pudo iniciar sesión. Verifica que Django esté activo y las credenciales sean correctas.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={handleSubmit}>
        <div className="login-header">
          <img className="login-logo" src={logoRancho} alt="Rancho Flor María" />
          <h1>PANEL ADMINISTRATIVO</h1>
          <span className="login-divider" aria-hidden="true" />
          <p>Accede al sistema para gestionar cotizaciones, contratos y análisis del negocio.</p>
        </div>

        <div className="login-form-fields">
          <div className="login-field">
            <label htmlFor="username">Usuario</label>
            <div className="login-input-wrap">
              <User size={21} aria-hidden="true" />
              <input
                id="username"
                autoComplete="username"
                value={credentials.username}
                onChange={(event) => updateCredential('username', event.target.value)}
                placeholder="Ingresa tu usuario"
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="password">Contraseña</label>
            <div className="login-input-wrap">
              <Lock size={21} aria-hidden="true" />
              <input
                id="password"
                autoComplete="current-password"
                type={showPassword ? 'text' : 'password'}
                value={credentials.password}
                onChange={(event) => updateCredential('password', event.target.value)}
                placeholder="Ingresa tu contraseña"
              />
              <button
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff size={21} aria-hidden="true" /> : <Eye size={21} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>

        {error ? <p className="login-error">{error}</p> : null}

        <Button className="login-submit" disabled={loading} type="submit">
          {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
        </Button>

        <footer className="login-footer">© 2026 Rancho Flor María</footer>
      </form>
    </main>
  );
}
