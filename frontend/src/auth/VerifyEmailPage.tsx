import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"checking" | "done" | "error">(token ? "checking" : "error");
  const [error, setError] = useState<string | null>(token ? null : "This verification link is invalid or has expired");

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    api<{ ok: boolean }>("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(() => {
        if (!cancelled) setState("done");
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "This verification link is invalid or has expired");
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="login-screen">
      <section className="login-card">
        <p className="eyebrow">Employee</p>
        {state === "checking" ? (
          <>
            <h1>Confirming your email</h1>
            <p className="muted">This takes only a moment.</p>
          </>
        ) : null}
        {state === "done" ? (
          <>
            <h1>Email confirmed</h1>
            <p className="muted">Your account is ready. Sign in to scan QR codes sent to you.</p>
            <Link to="/login">Sign in</Link>
          </>
        ) : null}
        {state === "error" ? (
          <>
            <h1>Link not valid</h1>
            <p className="form-error">{error}</p>
            <p className="auth-switch">
              <Link to="/signup">Create an account</Link> to receive a new link.
            </p>
          </>
        ) : null}
      </section>
    </main>
  );
}
