import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { adminHomePath, isAdminPortalRole } from "../auth/roles";
import { applyPublicMeta } from "../seo/applyPublicMeta";

const REWARD_INR = 40;

export function HomePage() {
  const { user } = useAuth();

  useEffect(() => {
    applyPublicMeta("/");
  }, []);

  if (isAdminPortalRole(user?.role)) {
    return <Navigate to={adminHomePath(user?.role)} replace />;
  }
  if (user?.role === "EMPLOYEE") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="home">
      <a className="home-skip" href="#how-it-works">
        Skip to how it works
      </a>

      <header className="home-nav">
        <Link to="/" className="home-brand" aria-label="QRSCAN home">
          <span className="home-brand-mark" aria-hidden="true">
            ₹
          </span>
          <span className="home-brand-name">QRSCAN</span>
        </Link>
        <nav className="home-nav-links" aria-label="Account">
          <Link to="/login" className="home-link">
            Sign in
          </Link>
          <Link to="/signup" className="home-cta home-cta-sm">
            <span className="home-cta-full">Start earning</span>
            <span className="home-cta-short">Join free</span>
          </Link>
        </nav>
      </header>

      <main>
        <section className="home-hero" aria-labelledby="home-hero-title">
          <div className="home-hero-copy">
            <p className="home-kicker">Free online work · Paid in rupees</p>
            <h1 id="home-hero-title" className="home-brand-hero">
              QRSCAN
            </h1>
            <p className="home-headline">
              Want free money online? Sign up and earn ₹{REWARD_INR} for every successful scan.
            </p>
            <p className="home-lede">
              Real part-time online work in India. No joining fee. Legitimate UPI payouts for passed QR scans.
            </p>
            <div className="home-actions">
              <Link to="/signup" className="home-cta">
                <span className="home-cta-full">Sign up free — earn ₹{REWARD_INR}/scan</span>
                <span className="home-cta-short">Sign up free · ₹{REWARD_INR}/scan</span>
              </Link>
              <Link to="/login" className="home-ghost">
                I already have an account
              </Link>
            </div>
          </div>

          <div className="home-hero-visual" aria-hidden="true">
            <div className="home-orbit">
              <div className="home-reward">
                <span className="home-reward-label">Per successful scan</span>
                <strong className="home-reward-amount">₹{REWARD_INR}</strong>
                <span className="home-reward-sub">Paid to your UPI</span>
              </div>
              <div className="home-qr">
                <span className="home-qr-scan" />
                <div className="home-qr-grid">
                  {Array.from({ length: 36 }, (_, index) => (
                    <i key={index} className={index % 5 === 0 || index % 7 === 0 ? "on" : undefined} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="home-section" aria-labelledby="how-title">
          <h2 id="how-title">How free money online works here</h2>
          <p className="home-section-lede">
            Simple online work: open the app, scan the live QR we send, and earn when the scan succeeds.
          </p>
          <ol className="home-steps">
            <li>
              <span className="home-step-num">01</span>
              <h3>Sign up free</h3>
              <p>Create your account in minutes. No deposit, no “unlock” fee, no software charge.</p>
            </li>
            <li>
              <span className="home-step-num">02</span>
              <h3>Scan live QRs</h3>
              <p>When a payment QR is ready, you reserve it and complete a successful scan.</p>
            </li>
            <li>
              <span className="home-step-num">03</span>
              <h3>Get paid ₹{REWARD_INR}</h3>
              <p>Every passed scan adds ₹{REWARD_INR} to your earnings. Add your UPI ID and get paid.</p>
            </li>
          </ol>
        </section>

        <section className="home-section home-trust" aria-labelledby="trust-title">
          <h2 id="trust-title">Legitimate earnings. Clear rules.</h2>
          <p className="home-section-lede">
            QRSCAN is built for people searching for free money online, online work from home, and real part-time earning
            — with transparent payouts, not fake task scams.
          </p>
          <ul className="home-trust-list">
            <li>
              <strong>₹{REWARD_INR} fixed reward</strong>
              <span>You earn a clear amount for each successful scan — not vague “task points”.</span>
            </li>
            <li>
              <strong>Free to join</strong>
              <span>We never ask you to pay to start, upgrade, or withdraw your own earnings.</span>
            </li>
            <li>
              <strong>UPI payouts</strong>
              <span>Save your UPI ID or payout QR so admins can pay you the legitimate way.</span>
            </li>
            <li>
              <strong>Work when QRs are live</strong>
              <span>Flexible online work: take available scans and grow your balance over time.</span>
            </li>
          </ul>
        </section>

        <section className="home-section home-seo" aria-labelledby="seo-title">
          <h2 id="seo-title">Earn money online in India with QRSCAN</h2>
          <p>
            Looking for <strong>free money</strong>, <strong>free money online</strong>, or genuine{" "}
            <strong>online work</strong> you can do from your phone? QRSCAN pays ₹{REWARD_INR} for every successful QR
            scan. Sign up free, complete scans when they appear, and withdraw through UPI. It is practical part-time
            online earning — not a lottery, not a loan, and not a fee-based “task app”.
          </p>
        </section>

        <section className="home-finale" aria-labelledby="finale-title">
          <h2 id="finale-title">Ready to earn free money online?</h2>
          <p>Join QRSCAN, scan successfully, and get ₹{REWARD_INR} every time it passes.</p>
          <Link to="/signup" className="home-cta">
            Create free account
          </Link>
        </section>
      </main>

      <footer className="home-footer">
        <div>
          <strong>QRSCAN</strong>
          <p>Free online work · ₹{REWARD_INR} per successful scan · Legitimate UPI payouts</p>
        </div>
        <nav aria-label="Footer">
          <Link to="/signup">Sign up</Link>
          <Link to="/login">Sign in</Link>
        </nav>
      </footer>

      <div className="home-sticky" role="region" aria-label="Quick signup">
        <div className="home-sticky-copy">
          <strong>₹{REWARD_INR} / successful scan</strong>
          <span>Free signup · UPI payouts</span>
        </div>
        <Link to="/signup" className="home-cta home-cta-sm">
          Sign up
        </Link>
      </div>
    </div>
  );
}
