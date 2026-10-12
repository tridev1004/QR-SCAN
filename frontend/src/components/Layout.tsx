import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function Layout() {
  const { user, clearSession } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate to={location.pathname.startsWith("/admin") ? "/admin/login" : "/login"} replace />;
  }
  if (location.pathname.startsWith("/admin") && user.role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <strong>UPI QR Monitor</strong>
          <span>{user.name}</span>
        </div>
        <nav>
          {user.role === "ADMIN" ? null : <NavLink to="/dashboard">My sessions</NavLink>}
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
