import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type UserRole = "ADMIN" | "EMPLOYEE" | "EXTENSION_USER" | "PAYER" | "SESSION_VIEWER";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

interface AuthState {
  token: string | null;
  user: PublicUser | null;
}

interface AuthContextValue extends AuthState {
  setSession: (token: string, user: PublicUser) => void;
  clearSession: () => void;
}

const TOKEN_KEY = "upi-monitor-token";
const USER_KEY = "upi-monitor-user";

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession(): AuthState {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const raw = sessionStorage.getItem(USER_KEY);
  if (!token || !raw) {
    return { token: null, user: null };
  }
  try {
    return { token, user: JSON.parse(raw) as PublicUser };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthState>(readSession);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      setSession(token, user) {
        sessionStorage.setItem(TOKEN_KEY, token);
        sessionStorage.setItem(USER_KEY, JSON.stringify(user));
        setSessionState({ token, user });
      },
      clearSession() {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        setSessionState({ token: null, user: null });
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
