import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  xtreamLogin,
  xtreamLogout,
  type XtreamCredentials,
} from '../api/xtreamClient';
import type { XtreamAuthResponse, XtreamServerInfo, XtreamUserInfo } from '../types/xtream';

const STORAGE_USER = 'xtream_user';
const STORAGE_SESSION = 'xtream_session';
/** Legacy key — cleared on read so password is not kept after upgrade */
const STORAGE_PASS_LEGACY = 'xtream_pass';

function readStoredCreds(): XtreamCredentials | null {
  const username = sessionStorage.getItem(STORAGE_USER)?.trim();
  const sessionToken = sessionStorage.getItem(STORAGE_SESSION)?.trim() || undefined;
  sessionStorage.removeItem(STORAGE_PASS_LEGACY);
  if (!username || !sessionToken) return null;
  return { username, sessionToken };
}

interface PlayerSessionContextValue {
  creds: XtreamCredentials | null;
  userInfo: XtreamUserInfo | null;
  serverInfo: XtreamServerInfo | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  restoreSession: () => Promise<boolean>;
}

const PlayerSessionContext = createContext<PlayerSessionContextValue | null>(null);

export function PlayerSessionProvider({ children }: { children: ReactNode }) {
  const [creds, setCreds] = useState<XtreamCredentials | null>(() => readStoredCreds());
  const [userInfo, setUserInfo] = useState<XtreamUserInfo | null>(null);
  const [serverInfo, setServerInfo] = useState<XtreamServerInfo | null>(null);

  const persist = useCallback((c: XtreamCredentials | null) => {
    sessionStorage.removeItem(STORAGE_PASS_LEGACY);
    if (c?.sessionToken) {
      sessionStorage.setItem(STORAGE_USER, c.username);
      sessionStorage.setItem(STORAGE_SESSION, c.sessionToken);
    } else {
      sessionStorage.removeItem(STORAGE_USER);
      sessionStorage.removeItem(STORAGE_SESSION);
    }
    setCreds(c?.sessionToken ? { username: c.username, sessionToken: c.sessionToken } : null);
  }, []);

  const applyAuth = useCallback(
    (username: string, auth: XtreamAuthResponse & { player_session?: string }) => {
      const token = auth.player_session?.trim();
      if (!token) {
        throw new Error('Serwer nie zwrócił sesji playera — zaktualizuj API Xtream na studio.');
      }
      persist({ username, sessionToken: token });
      setUserInfo(auth.user_info ?? null);
      setServerInfo(auth.server_info ?? null);
    },
    [persist],
  );

  const login = useCallback(
    async (username: string, password: string) => {
      const trimmedUser = username.trim();
      if (!trimmedUser || !password) {
        throw new Error('Podaj login i hasło');
      }
      const auth = await xtreamLogin({ username: trimmedUser, password });
      applyAuth(trimmedUser, auth);
    },
    [applyAuth],
  );

  const logout = useCallback(() => {
    const current = creds;
    persist(null);
    setUserInfo(null);
    setServerInfo(null);
    if (current) {
      void xtreamLogout(current);
    }
  }, [creds, persist]);

  const restoreSession = useCallback(async () => {
    const stored = readStoredCreds();
    if (!stored) return false;
    try {
      const auth = await xtreamLogin(stored);
      applyAuth(stored.username, auth);
      return true;
    } catch {
      persist(null);
      setUserInfo(null);
      setServerInfo(null);
      return false;
    }
  }, [applyAuth, persist]);

  const value = useMemo<PlayerSessionContextValue>(
    () => ({
      creds,
      userInfo,
      serverInfo,
      isAuthenticated: !!creds?.sessionToken && !!userInfo,
      login,
      logout,
      restoreSession,
    }),
    [creds, userInfo, serverInfo, login, logout, restoreSession],
  );

  return (
    <PlayerSessionContext.Provider value={value}>{children}</PlayerSessionContext.Provider>
  );
}

export function usePlayerSession(): PlayerSessionContextValue {
  const ctx = useContext(PlayerSessionContext);
  if (!ctx) throw new Error('usePlayerSession must be used within PlayerSessionProvider');
  return ctx;
}
