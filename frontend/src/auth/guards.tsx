import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { api } from "../api/client";
import { LoginPage } from "./LoginPage";
import { PublicUser, useAuth } from "./AuthContext";
import { adminHomePath, isAdminPortalRole } from "./roles";

export function AdminLoginRoute() {
  const { user } = useAuth();
  if (isAdminPortalRole(user?.role)) {
    return <Navigate to={adminHomePath(user?.role)} replace />;
  }
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <LoginPage portal="admin" />;
}

export function RequireAdmin() {
  const { token, user, setSession } = useAuth();
  const [gate, setGate] = useState<"checking" | "allowed" | "error">("checking");

  useEffect(() => {
    if (!token || !isAdminPortalRole(user?.role)) {
      setGate("checking");
      return;
    }
    let cancelled = false;
    api<{ user: PublicUser }>("/api/auth/me")
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (!isAdminPortalRole(result.user.role)) {
          setSession(token, result.user);
          setGate("checking");
          return;
        }
        if (result.user.role !== user?.role) {
          setSession(token, result.user);
        }
        setGate("allowed");
      })
      .catch(() => {
        if (!cancelled) {
          setGate("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, user?.role, setSession]);

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }
  if (!isAdminPortalRole(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  if (gate === "error") {
    return <p className="form-error">Could not confirm admin access.</p>;
  }
  if (gate !== "allowed") {
    return <p className="muted">Checking access…</p>;
  }
  return <Outlet />;
}
