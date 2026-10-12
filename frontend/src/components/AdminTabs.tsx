import { NavLink, Outlet } from "react-router-dom";

export function AdminTabs() {
  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Dashboard</h1>
      </div>
      <nav className="tabs" aria-label="Admin sections">
        <NavLink to="/admin/users" end>
          Employees
        </NavLink>
        <NavLink to="/admin/payments">Sessions</NavLink>
      </nav>
      <Outlet />
    </section>
  );
}
