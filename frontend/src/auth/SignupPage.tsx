import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api/client";
import { AuthShell } from "./AuthShell";
import { useAuth } from "./AuthContext";
import { adminHomePath, isAdminPortalRole } from "./roles";

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

  if (isAdminPortalRole(user?.role)) {
    return <Navigate to={adminHomePath(user?.role)} replace />;
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

  if (sentTo) {
    return (
      <AuthShell
        eyebrow="Almost done"
        title="Confirm your email"
        subtitle="We sent one confirmation link. Open it to finish creating your free account."
      >
        <div className="auth-success">
          <p>
            Link sent to <strong>{sentTo}</strong>. It expires in 24 hours.
          </p>
          <p className="auth-note">Use a real email inbox — temporary emails are blocked for safety.</p>
          <Link className="auth-primary-link" to="/login">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Free to join · No investment"
      title="Create your QRSCAN account"
      subtitle="Sign up free, confirm your email once, then earn ₹40 for every successful scan."
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <label>
          Full name
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
        <ul className="auth-checklist">
          <li>No joining fee or unlock charge</li>
          <li>Email verification required</li>
          <li>Support: qrscanadmin@biski.org</li>
        </ul>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="auth-submit" type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create free account"}
        </button>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        <p className="auth-switch">
          <Link to="/">← Back to QRSCAN home</Link>
        </p>
      </form>
    </AuthShell>
  );
}
