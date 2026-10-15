import { ReactNode } from "react";
import { PaymentCardGrid } from "./PaymentCardGrid";
import { formatInr } from "../state/money";
import { EmployeeEarnings, isTerminal, PaymentSession } from "../types/payment.types";

export function EmployeeQrBoard({
  live,
  history,
  earnings,
  onReserve,
  reserveLocked = false,
  historyControls,
}: {
  live: PaymentSession[];
  history: PaymentSession[];
  earnings: EmployeeEarnings;
  onReserve?: (id: string) => Promise<unknown>;
  reserveLocked?: boolean;
  historyControls?: ReactNode;
}) {
  const passed = history.filter((payment) => payment.status === "SUCCESS");
  const failed = history.filter((payment) => payment.status === "FAILED");
  const expired = history.filter((payment) => payment.status === "EXPIRED");
  const open = live.filter((payment) => payment.broadcast && !payment.assignedEmployeeId && !isTerminal(payment.status));
  const ready = live.filter((payment) => !payment.broadcast && !isTerminal(payment.status));

  return (
    <>
      <div className="stat-row">
        <article className="stat-card">
          <p className="eyebrow">Per passed QR</p>
          <strong>{formatInr(earnings.successRewardInr)}</strong>
        </article>
        <article className="stat-card">
          <p className="eyebrow">Passed</p>
          <strong>{earnings.passedCount}</strong>
        </article>
        <article className="stat-card">
          <p className="eyebrow">Failed</p>
          <strong>{earnings.failedCount}</strong>
        </article>
        <article className="stat-card">
          <p className="eyebrow">Today</p>
          <strong>{formatInr(earnings.todayEarnedInr ?? 0)}</strong>
        </article>
        <article className="stat-card">
          <p className="eyebrow">Overall</p>
          <strong>{formatInr(earnings.earnedInr)}</strong>
        </article>
        <article className="stat-card">
          <p className="eyebrow">Paid</p>
          <strong>{formatInr(earnings.paidInr ?? 0)}</strong>
        </article>
        <article className="stat-card">
          <p className="eyebrow">Unpaid</p>
          <strong>{formatInr(earnings.unpaidInr ?? 0)}</strong>
        </article>
      </div>
   
      {reserveLocked ? (
        <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          You already have two QRs reserved. Finish them as passed, failed, or expired to reserve more.
        </p>
      ) : null}
      <QrGroup
        title="Reserve a QR"
        payments={open}
        empty="No QR is waiting to be reserved."
        onReserve={onReserve}
        reserveLocked={reserveLocked}
      />
      <QrGroup title="Ready to scan" payments={ready} empty="No QR is waiting to be scanned." />
      {historyControls}
      <QrGroup
        title="Passed"
        payments={passed}
        successRewardInr={earnings.successRewardInr}
        empty="No passed QR on this page."
      />
      <QrGroup title="Failed" payments={failed} empty="No failed QR on this page." />
      {expired.length > 0 ? <QrGroup title="Expired" payments={expired} empty="" /> : null}
    </>
  );
}

function QrGroup({
  title,
  payments,
  empty,
  successRewardInr,
  onReserve,
  reserveLocked,
}: {
  title: string;
  payments: PaymentSession[];
  empty: string;
  successRewardInr?: number;
  onReserve?: (id: string) => Promise<unknown>;
  reserveLocked?: boolean;
}) {
  return (
    <section className="qr-group">
      <h2 className="section-title">{title}</h2>
      {payments.length === 0 ? <p className="muted">{empty}</p> : null}
      <PaymentCardGrid payments={payments} successRewardInr={successRewardInr} onReserve={onReserve} reserveLocked={reserveLocked} />
    </section>
  );
}
