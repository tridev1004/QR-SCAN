import { useState } from "react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AdminSidebar } from "./AdminSidebar";

export function Layout() {
  const { user, clearSession } = useAuth();
  const location = useLocation();
  const [rosterVersion, setRosterVersion] = useState(0);
  if (!user) {
    return <Navigate to={location.pathname.startsWith("/admin") ? "/admin/login" : "/login"} replace />;
  }
  if (location.pathname.startsWith("/admin") && user.role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  if (location.pathname.startsWith("/admin")) {
    return (
      <div className="flex min-h-screen bg-background text-foreground">
        <AdminSidebar name={user.name} onSignOut={clearSession} onEmployeeCreated={() => setRosterVersion((current) => current + 1)} />
        <main className="page min-w-0 flex-1">
          <Outlet context={{ rosterVersion }} />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <strong>UPI QR Monitor</strong>
          <span>{user.name}</span>
        </div>
        <nav>
          <NavLink to="/dashboard">My sessions</NavLink>
          <button type="button" onClick={clearSession}>
            Sign out
          </button>
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}

export function HomeRedirect() {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={user.role === "ADMIN" ? "/admin/users" : "/dashboard"} replace />;
}
