import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { XtreamApiError } from '../api/xtreamClient';
import { APP_TITLE } from '../config/env';
import { usePlayerSession } from '../context/PlayerSessionContext';

export default function LoginPage() {
  const { login, isAuthenticated } = usePlayerSession();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof XtreamApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Logowanie nie powiodło się');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page d-flex align-items-center justify-content-center min-vh-100 p-3">
      <div className="login-card card shadow">
        <div className="card-body p-4">
          <h1 className="h4 mb-1">{APP_TITLE}</h1>
          <p className="text-muted small mb-4">
            Zaloguj się danymi subkonta Xtream (login i hasło z panelu M3U Studio).
          </p>
          <form onSubmit={(e) => void onSubmit(e)}>
            <div className="mb-3">
              <label className="form-label" htmlFor="username">
                Login
              </label>
              <input
                id="username"
                className="form-control"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="password">
                Hasło
              </label>
              <input
                id="password"
                type="password"
                className="form-control"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="alert alert-danger py-2" role="alert">
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? 'Logowanie…' : 'Zaloguj'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
