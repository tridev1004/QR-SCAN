import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api/client";
import { AuthShell } from "./AuthShell";
import { PublicUser, useAuth } from "./AuthContext";
import { adminHomePath, isAdminPortalRole } from "./roles";

export function LoginPage({ portal }: { portal: "employee" | "admin" }) {
  const { user, setSession } = useAuth();
  const [email, setEmail] = useState(portal === "admin" ? "admin@company.local" : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAdminPortalRole(user?.role)) {
    return <Navigate to={adminHomePath(user?.role)} replace />;
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
      if (portal === "admin" && !isAdminPortalRole(result.user.role)) {
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

  if (portal === "admin") {
    return (
      <main className="auth-screen auth-screen-admin">
        <form className="auth-card auth-card-solo" onSubmit={onSubmit}>
          <p className="auth-eyebrow">Admin portal</p>
          <h2 className="auth-title">Admin sign in</h2>
          <p className="auth-subtitle">Sign in to manage sessions, payouts, and employees.</p>
          <div className="auth-form">
            <label>
              Email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="username"
                required
              />
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
            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to earn"
      subtitle="Open live QR scans, earn ₹40 on every success, and manage your UPI payout details."
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <label>
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="username"
            required
          />
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
        <ul className="auth-checklist">
          <li>Same account you created on signup</li>
          <li>Earnings credited only on successful scans</li>
          <li>Need help? qrscanadmin@biski.org</li>
        </ul>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="auth-submit" type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <p className="auth-switch">
          New here? <Link to="/signup">Create a free account</Link>
        </p>
        <p className="auth-switch">
          <Link to="/">← Back to QRSCAN home</Link>
        </p>
      </form>
    </AuthShell>
  );
}
