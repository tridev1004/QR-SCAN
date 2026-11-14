import { Link } from "react-router-dom";
import { EmployeeLiveBoard } from "../components/EmployeeQrBoard";
import { HindiText } from "../components/HindiText";
import { isTerminal } from "../types/payment.types";
import { useBroadcasts } from "../hooks/useBroadcasts";
import { usePayments } from "../hooks/usePayments";

export function EmployeePaymentsPage() {
  const broadcasts = useBroadcasts();
  const { live, earnings, cooldownUntil, loading, error, reserve } = usePayments("employee", {
    limit: 1,
    offset: 0,
  });

  const liveForBoard = cooldownUntil ? live.filter((payment) => Boolean(payment.assignedEmployeeId)) : live;
  const reserveLocked =
    live.filter((payment) => payment.assignedEmployeeId && !isTerminal(payment.status)).length >= 2;

  return (
    <section className="emp-dash">
      <div className="page-heading emp-dash-heading">
        <div>
          <p className="eyebrow">Live work</p>
          <h1>My sessions</h1>
          <p className="muted">Reserve a QR, scan it, earn when it passes. Past scans are in History.</p>
        </div>
        <Link className="emp-history-link" to="/history">
          View history →
        </Link>
      </div>

      <div className="emp-notices">
        {cooldownUntil ? (
          <HindiText
            className="emp-notice emp-notice-warn"
            english={`Your account is paused until ${new Date(cooldownUntil).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} after two failed or expired QRs in a row. You will not receive new QRs until then.`}
            hindi={`लगातार दो फेल या एक्सपायर QR के बाद आपका खाता ${new Date(cooldownUntil).toLocaleString("hi-IN", { timeZone: "Asia/Kolkata" })} तक रुका हुआ है। तब तक आपको नए QR नहीं मिलेंगे।`}
          />
        ) : null}

        {broadcasts.map((item) => (
          <p key={item.id} className="emp-notice emp-notice-broadcast">
            <span className="emp-notice-label">Broadcast</span>
            <span className="whitespace-pre-wrap">{item.message}</span>
            <span className="emp-notice-meta">
              Until{" "}
              {new Date(item.expiresAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </p>
        ))}

        <details className="emp-notice emp-notice-help">
          <summary>Need help or stuck on a scan?</summary>
          <p>
            Email{" "}
            <a className="font-semibold underline" href="mailto:qrscanadmin@biski.org">
              qrscanadmin@biski.org
            </a>{" "}
            — the team will help you.
          </p>
          {!cooldownUntil ? (
            <p className="mt-2">
              Tip: if two QRs fail or expire in a row, your account pauses for 2 days.
            </p>
          ) : null}
        </details>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {earnings ? (
        <EmployeeLiveBoard
          live={liveForBoard}
          earnings={earnings}
          onReserve={reserve}
          reserveLocked={reserveLocked}
        />
      ) : loading ? (
        <p>Loading QR codes…</p>
      ) : (
        <p className="muted">No live QR yet. New ones appear here when they are sent.</p>
      )}
    </section>
  );
}
