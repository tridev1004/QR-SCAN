import { PaymentCardGrid } from "./PaymentCardGrid";
import { formatInr } from "../state/money";
import { isTerminal, PaymentSession } from "../types/payment.types";

export function EmployeeQrBoard({
  payments,
  successRewardInr,
}: {
  payments: PaymentSession[];
  successRewardInr: number;
}) {
  const passed = payments.filter((payment) => payment.status === "SUCCESS");
  const failed = payments.filter((payment) => payment.status === "FAILED");
  const expired = payments.filter((payment) => payment.status === "EXPIRED");
  const live = payments.filter((payment) => !isTerminal(payment.status));
  const earnedInr = passed.length * successRewardInr;

  return (
    <>
      <div className="stat-row">
        <article className="stat-card">
          <p className="eyebrow">Per passed QR</p>
          <strong>{formatInr(successRewardInr)}</strong>
        </article>
        <article className="stat-card">
          <p className="eyebrow">Passed</p>
          <strong>{passed.length}</strong>
        </article>
        <article className="stat-card">
          <p className="eyebrow">Failed</p>
          <strong>{failed.length}</strong>
        </article>
        <article className="stat-card">
          <p className="eyebrow">Earned</p>
          <strong>{formatInr(earnedInr)}</strong>
        </article>
      </div>
      <QrGroup title="Ready to scan" payments={live} empty="No QR is waiting to be scanned." />
      <QrGroup
        title="Passed"
        payments={passed}
        successRewardInr={successRewardInr}
        empty="No passed QR yet."
      />
      <QrGroup title="Failed" payments={failed} empty="No failed QR yet." />
      {expired.length > 0 ? <QrGroup title="Expired" payments={expired} empty="" /> : null}
    </>
  );
}

function QrGroup({
  title,
  payments,
  empty,
  successRewardInr,
}: {
  title: string;
  payments: PaymentSession[];
  empty: string;
  successRewardInr?: number;
}) {
  return (
    <section className="qr-group">
      <h2 className="section-title">{title}</h2>
      {payments.length === 0 ? <p className="muted">{empty}</p> : null}
      <PaymentCardGrid payments={payments} successRewardInr={successRewardInr} />
    </section>
  );
}
