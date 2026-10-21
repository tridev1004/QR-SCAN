import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AdminSidebar } from "./AdminSidebar";
import { EmployeeSidebar } from "./EmployeeSidebar";

export function Layout() {
  const { user, clearSession } = useAuth();
  const location = useLocation();
  const [rosterVersion, setRosterVersion] = useState(0);
  if (!user) {
    return <Navigate to={location.pathname.startsWith("/admin") ? "/admin/login" : "/login"} replace />;
  }
  if (user.role !== "ADMIN" && user.role !== "EMPLOYEE") {
    return <Navigate to="/login" replace />;
  }
  if (location.pathname.startsWith("/admin") && user.role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  if (location.pathname.startsWith("/admin")) {
    return (
      <div className="flex min-h-screen bg-background text-foreground">
        <AdminSidebar name={user.name} onSignOut={clearSession} />
        <main className="page min-w-0 flex-1">
          <Outlet context={{ rosterVersion, onEmployeeCreated: () => setRosterVersion((current) => current + 1) }} />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <EmployeeSidebar name={user.name} onSignOut={clearSession} />
      <main className="page min-w-0 flex-1 overflow-x-hidden">
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
  if (user.role === "ADMIN") {
    return <Navigate to="/admin/users" replace />;
  }
  if (user.role === "EMPLOYEE") {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
}
