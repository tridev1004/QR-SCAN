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

          <div className="home-hero-visual">
            <div className="home-orbit">
              <div className="home-reward" aria-hidden="true">
                <span className="home-reward-label">Per successful scan</span>
                <strong className="home-reward-amount">₹{REWARD_INR}</strong>
                <span className="home-reward-sub">Paid to your UPI</span>
              </div>
              <div className="home-qr">
                <span className="home-qr-scan" aria-hidden="true" />
                <img
                  className="home-qr-img"
                  src="/hero-qr.png"
                  width={280}
                  height={280}
                  alt="Scan this QR to open QRSCAN signup"
                />
              </div>
            </div>
            <p className="home-qr-caption">Real QR — scan with any UPI / camera app to open signup</p>
          </div>
        </section>

        <section className="home-section home-plain" aria-labelledby="plain-title">
          <h2 id="plain-title">In simple words — what is QRSCAN?</h2>
          <p className="home-section-lede">
            QRSCAN is a free money online site for India. You do small phone work (scan a QR), and we pay you real rupees
            on UPI.
          </p>
          <ul className="home-plain-list">
            <li>
              <strong>You earn ₹{REWARD_INR}</strong> every time one QR scan is successful.
            </li>
            <li>
              <strong>It costs ₹0 to join</strong> — no investment, no fee to start, no “unlock” payment.
            </li>
            <li>
              <strong>Money comes to your UPI</strong> — save your UPI ID in the app after signup.
            </li>
            <li>
              <strong>Example:</strong> 5 successful scans = ₹{REWARD_INR * 5}. 10 successful scans = ₹{REWARD_INR * 10}.
            </li>
          </ul>
        </section>

        <section id="how-it-works" className="home-section" aria-labelledby="how-title">
          <h2 id="how-title">4 easy steps to earn free money</h2>
          <p className="home-section-lede">Follow these steps every time. Easy online work on your phone.</p>
          <ol className="home-steps">
            <li>
              <span className="home-step-num">01</span>
              <h3>Create free account</h3>
              <p>Sign up with your name, email, and password. Confirm your email once. No money needed to join.</p>
            </li>
            <li>
              <span className="home-step-num">02</span>
              <h3>Open a live QR and scan it</h3>
              <p>
                When a QR is available on your dashboard, open it and scan with your UPI app (GPay, PhonePe, Paytm,
                etc.).
              </p>
            </li>
            <li>
              <span className="home-step-num">03</span>
              <h3>Earn ₹{REWARD_INR} when scan succeeds</h3>
              <p>If the scan passes, ₹{REWARD_INR} is added to your earnings. Keep scanning when new QRs appear.</p>
            </li>
            <li>
              <span className="home-step-num">04</span>
              <h3>After success — remove Autopay mandate</h3>
              <p>
                As soon as Autopay / scan is successful, go to your UPI app and remove the mandate. Do this every time
                before the next scan.
              </p>
            </li>
          </ol>
        </section>

        <section className="home-section home-mandate" aria-labelledby="mandate-title">
          <h2 id="mandate-title">Must do after every successful scan</h2>
          <p className="home-section-lede">
            Don’t skip this step. After Autopay succeeds, remove the mandate immediately.
          </p>
          <div className="home-mandate-box">
            <p>
              <strong>English:</strong> After a successful QR scan, remove the mandate from your Autopay request right
              away.
            </p>
            <p>
              <strong>हिंदी:</strong> स्कैन सफल / ऑटोपे पूरा होते ही अपने UPI ऐप में जाकर ऑटोपे मैंडेट हटा दें। अगला स्कैन
              लेने से पहले यह जरूर करें।
            </p>
          </div>
        </section>

        <section className="home-section home-trust" aria-labelledby="trust-title">
          <h2 id="trust-title">Why people trust this free money online work</h2>
          <p className="home-section-lede">Clear pay. No fee games. Real UPI payouts.</p>
          <ul className="home-trust-list">
            <li>
              <strong>Fixed ₹{REWARD_INR} per success</strong>
              <span>You always know how much you earn for one passed scan.</span>
            </li>
            <li>
              <strong>Free signup — no investment</strong>
              <span>We never ask you to pay to start, upgrade, or withdraw your own earnings.</span>
            </li>
            <li>
              <strong>Paid on UPI</strong>
              <span>Add your UPI ID so admins can send your money.</span>
            </li>
            <li>
              <strong>Work when you can</strong>
              <span>Part-time online work from home on your phone when QRs are live.</span>
            </li>
          </ul>
        </section>

        <section className="home-section" aria-labelledby="who-title">
          <h2 id="who-title">Who can join and earn?</h2>
          <p className="home-section-lede">
            Anyone in India with a phone and UPI can try — students, homemakers, and people looking for part-time online
            jobs or free money online without investment.
          </p>
          <ul className="home-bullet-list">
            <li>Smartphone + any UPI app</li>
            <li>Real email address (fake/temp emails are blocked)</li>
            <li>Scan carefully — if scans fail or expire twice in a row, account pauses for a few hours</li>
            <li>After every success, remove the Autopay mandate</li>
          </ul>
        </section>

        <section className="home-section home-seo" aria-labelledby="seo-title">
          <h2 id="seo-title">Looking for free money / earn money online?</h2>
          <p>
            Many people in India search Google for <strong>free money</strong>, <strong>earn free money</strong>,{" "}
            <strong>free money online</strong>, <strong>how to earn money online</strong>,{" "}
            <strong>how to earn money online in India</strong>, <strong>earn money from home</strong>, and{" "}
            <strong>earn money without investment</strong>. QRSCAN is made for those searches — with real phone work and
            real rupees.
          </p>
          <p>
            This is not a lottery and not a loan app. It is <strong>online work</strong>: you scan a QR, and when it
            succeeds you earn ₹{REWARD_INR}. Then remove Autopay mandate and wait for the next QR. If you want{" "}
            <strong>part time online jobs</strong>, <strong>work from home jobs India</strong>,{" "}
            <strong>daily online earning</strong>, or a simple <strong>online earning site</strong>, start with free
            signup on QRSCAN.
          </p>
          <p>
            Popular searches we help with: free money online India, earn money online without investment, free online
            earning, UPI earning app work, online earning for students, and how to get free money on phone.
          </p>
        </section>

        <section className="home-section home-faq" aria-labelledby="faq-title">
          <h2 id="faq-title">Common questions about earning free money online</h2>
          <p className="home-section-lede">
            Straight answers for people googling how to earn money online without investment.
          </p>
          <div className="home-faq-list">
            <details>
              <summary>How to earn money online in India with QRSCAN?</summary>
              <p>
                Create a free account, wait for live QR scans, complete a successful scan, earn ₹{REWARD_INR}, then
                remove the Autopay mandate. Add your UPI ID so payouts can be sent.
              </p>
            </details>
            <details>
              <summary>Can I earn free money online without investment?</summary>
              <p>
                Yes. There is no joining fee, training fee, or unlock charge. You only earn when a scan succeeds — ₹
                {REWARD_INR} per success.
              </p>
            </details>
            <details>
              <summary>What should I do after Autopay / successful scan?</summary>
              <p>
                Right after a successful QR scan, remove the mandate from your Autopay request. Do this every time before
                taking the next scan.
              </p>
            </details>
            <details>
              <summary>Is this work from home / part-time online jobs?</summary>
              <p>
                Yes. It is flexible online work from home (or anywhere on your phone). Take scans when they are available
                — useful as part-time online earning beside studies or another job.
              </p>
            </details>
            <details>
              <summary>How do daily online earning and UPI payouts work?</summary>
              <p>
                Each successful scan adds ₹{REWARD_INR} to your earnings. Save your UPI ID or payout QR in the app so
                admins can pay you. Earnings depend on how many successful scans you complete.
              </p>
            </details>
          </div>
        </section>

        <section className="home-finale" aria-labelledby="finale-title">
          <h2 id="finale-title">Ready to earn free money online?</h2>
          <p>
            Join QRSCAN, scan successfully, remove the Autopay mandate, and get ₹{REWARD_INR} every time it passes.
          </p>
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
