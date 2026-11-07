import { Link } from "react-router-dom";
import type { ReactNode } from "react";

const HELP_EMAIL = "qrscanadmin@biski.org";

export function AuthShell({
  children,
  title,
  subtitle,
  eyebrow = "QRSCAN",
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  eyebrow?: string;
}) {
  return (
    <main className="auth-screen">
      <div className="auth-shell">
        <aside className="auth-brand-panel" aria-label="About QRSCAN">
          <Link to="/" className="auth-brand">
            <span className="auth-brand-mark" aria-hidden="true">
              ₹
            </span>
            <span className="auth-brand-name">QRSCAN</span>
          </Link>
          <p className="auth-brand-tag">Legitimate online work in India</p>
          <h1 className="auth-brand-title">Earn ₹40 for every successful scan</h1>
          <p className="auth-brand-copy">
            Free to join. No investment. Real UPI payouts. After each successful Autopay, remove the mandate and keep
            earning.
          </p>
          <ul className="auth-trust">
            <li>₹0 joining fee — never pay to start</li>
            <li>₹40 fixed reward per passed scan</li>
            <li>Payouts to your UPI ID</li>
            <li>
              Help: <a href={`mailto:${HELP_EMAIL}`}>{HELP_EMAIL}</a>
            </li>
          </ul>
        </aside>

        <section className="auth-card">
          <Link to="/" className="auth-card-brand">
            <span className="auth-brand-mark" aria-hidden="true">
              ₹
            </span>
            <span>QRSCAN</span>
          </Link>
          <p className="auth-eyebrow">{eyebrow}</p>
          <h2 className="auth-title">{title}</h2>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
          <p className="auth-help">
            Feeling stuck? Email{" "}
            <a href={`mailto:${HELP_EMAIL}`}>{HELP_EMAIL}</a> — the team will help you.
          </p>
        </section>
      </div>
    </main>
  );
}
