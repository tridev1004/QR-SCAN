import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api/client";
import { PublicUser, useAuth } from "./AuthContext";

export function LoginPage({ portal }: { portal: "employee" | "admin" }) {
  const { user, setSession } = useAuth();
  const [email, setEmail] = useState(portal === "admin" ? "admin@company.local" : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user?.role === "ADMIN") {
    return <Navigate to="/admin/users" replace />;
  }
  if (user?.role === "EMPLOYEE") {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await api<{ token: string; user: PublicUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, portal }),
      });
      if (portal === "employee" && result.user.role !== "EMPLOYEE") {
        setError("Use the admin sign-in");
        return;
      }
      if (portal === "admin" && result.user.role !== "ADMIN") {
        setError("Use the employee sign-in");
        return;
      }
      setSession(result.token, result.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <p className="eyebrow">{portal === "admin" ? "Admin" : "Employee"}</p>
        <h1>{portal === "admin" ? "Admin sign in" : "Employee sign in"}</h1>
        <p className="muted">
          {portal === "admin"
            ? "Create employee accounts and choose who can receive a QR."
            : "Sign in to scan the QR an admin sends to you."}
        </p>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" required />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        {portal === "employee" ? (
          <p className="auth-switch">
            New here? <Link to="/signup">Create an account</Link>
          </p>
        ) : null}
      </form>
    </main>
  );
}
