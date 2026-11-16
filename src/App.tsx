import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { usePlayerSession } from './context/PlayerSessionContext';
import LoginPage from './pages/LoginPage';
import PlayerPage from './pages/PlayerPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, restoreSession } = usePlayerSession();
  const [checking, setChecking] = useState(!isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    void restoreSession().finally(() => {
      if (!cancelled) setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, restoreSession]);

  if (checking) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <PlayerPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
