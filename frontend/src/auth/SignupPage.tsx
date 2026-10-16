import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

const EMAIL_PATTERN =
  /^(?!.*\.\.)[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

export function SignupPage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user?.role === "ADMIN") {
    return <Navigate to="/admin/users" replace />;
  }
  if (user?.role === "EMPLOYEE") {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Enter a valid email address");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api("/api/auth/signup/check", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const result = await api<{ email: string }>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email: normalizedEmail, password }),
      });
      setSentTo(result.email);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        {sentTo ? (
          <>
            <p className="eyebrow">Check your email</p>
            <h1>Confirm your account</h1>
            <p className="muted">
              We sent a confirmation link to <strong>{sentTo}</strong>. Open it to finish creating your account. The link
              expires in 24 hours.
            </p>
            <Link to="/login">Back to sign in</Link>
          </>
        ) : (
          <form className="signup-form" onSubmit={onSubmit}>
            <p className="eyebrow">Employee</p>
            <h1>Create an account</h1>
            <p className="muted">Sign up with your email. We will send one confirmation link.</p>
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
            </label>
            <label>
              Email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={254}
                pattern="^(?!.*\.\.)[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$"
                title="Enter a valid email address, such as name@company.com"
                required
              />
            </label>
            <label>
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            <label>
              Confirm password
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Create account"}
            </button>
            <p className="auth-switch">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
