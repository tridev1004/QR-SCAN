import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { AdminLoginRoute, RequireAdmin } from "./guards";

const employee = {
  id: "rahul",
  name: "Rahul",
  email: "rahul@company.local",
  role: "EMPLOYEE" as const,
  active: true,
};

const admin = {
  id: "admin",
  name: "Admin",
  email: "admin@company.local",
  role: "ADMIN" as const,
  active: true,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/dashboard" element={<p>Employee home</p>} />
          <Route path="/admin/login" element={<AdminLoginRoute />} />
          <Route path="/admin" element={<RequireAdmin />}>
            <Route path="users" element={<p>Admin accounts</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("admin route protection", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes("/api/auth/me")) {
          return json({ user: employee });
        }
        return json({});
      }),
    );
  });

  it("sends a signed-in employee away from the admin sign-in", () => {
    sessionStorage.setItem("upi-monitor-token", "employee-token");
    sessionStorage.setItem("upi-monitor-user", JSON.stringify(employee));
    renderAt("/admin/login");
    expect(screen.getByText("Employee home")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Admin sign in" })).not.toBeInTheDocument();
  });

  it("sends a signed-in employee away from the admin dashboard", () => {
    sessionStorage.setItem("upi-monitor-token", "employee-token");
    sessionStorage.setItem("upi-monitor-user", JSON.stringify(employee));
    renderAt("/admin/users");
    expect(screen.getByText("Employee home")).toBeInTheDocument();
    expect(screen.queryByText("Admin accounts")).not.toBeInTheDocument();
  });

  it("does not open the admin dashboard when the stored role was changed", async () => {
    sessionStorage.setItem("upi-monitor-token", "employee-token");
    sessionStorage.setItem("upi-monitor-user", JSON.stringify({ ...employee, role: "ADMIN" }));
    renderAt("/admin/users");
    expect(await screen.findByText("Employee home")).toBeInTheDocument();
    expect(screen.queryByText("Admin accounts")).not.toBeInTheDocument();
  });

  it("opens the admin dashboard only after the server confirms an admin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ user: admin })),
    );
    sessionStorage.setItem("upi-monitor-token", "admin-token");
    sessionStorage.setItem("upi-monitor-user", JSON.stringify(admin));
    renderAt("/admin/users");
    expect(await screen.findByText("Admin accounts")).toBeInTheDocument();
  });
});
