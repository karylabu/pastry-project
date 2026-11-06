import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LARAVEL_BASE } from '../../services/config';
import { clearAuthState, getAuthHeaders } from '../../services/api';

const SESSION_CHECK_INTERVAL_MS = 15000;

function getStoredUser() {
  try {
    return JSON.parse(window.localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

export default function CustomerSessionMonitor() {
  const navigate = useNavigate();

  useEffect(() => {
    let disposed = false;
    let checking = false;

    const redirectToLogin = () => clearAuthState();

    const verifySession = async () => {
      const user = getStoredUser();
      if (!user?.id || String(user.role || '').trim().toLowerCase() !== 'customer' || checking) {
        return;
      }

      checking = true;
      try {
        const response = await fetch(`${LARAVEL_BASE}/api/auth/status`, {
          credentials: 'include',
          headers: getAuthHeaders(),
        });

        if (!disposed && response.status === 401) {
          redirectToLogin();
        }
      } catch {
        // A temporary network error does not invalidate the local session.
      } finally {
        checking = false;
      }
    };

    const handleAuthLogout = () => navigate('/customer/login', { replace: true });
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        verifySession();
      }
    };

    verifySession();
    const intervalId = window.setInterval(verifySession, SESSION_CHECK_INTERVAL_MS);
    window.addEventListener('focus', verifySession);
    window.addEventListener('auth:logout', handleAuthLogout);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', verifySession);
      window.removeEventListener('auth:logout', handleAuthLogout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate]);

  return null;
}
