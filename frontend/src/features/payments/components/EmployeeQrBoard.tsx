import { HindiText } from "./HindiText";
import { PaymentCardGrid } from "./PaymentCardGrid";
import { formatInr } from "../state/money";
import { EmployeeEarnings, isTerminal, PaymentSession } from "../types/payment.types";

export function EmployeeEarningsRow({ earnings }: { earnings: EmployeeEarnings }) {
  return (
    <div className="stat-row emp-earn-row">
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
  );
}

export function EmployeeLiveBoard({
  live,
  earnings,
  onReserve,
  reserveLocked = false,
}: {
  live: PaymentSession[];
  earnings: EmployeeEarnings;
  onReserve?: (id: string) => Promise<unknown>;
  reserveLocked?: boolean;
}) {
  const open = live.filter((payment) => payment.broadcast && !payment.assignedEmployeeId && !isTerminal(payment.status));
  const ready = live.filter((payment) => !payment.broadcast && !isTerminal(payment.status));

  return (
    <>
      <EmployeeEarningsRow earnings={earnings} />
      {reserveLocked ? (
        <p className="emp-notice emp-notice-warn">
          You already have two QRs reserved. Finish them as passed, failed, or expired to reserve more.
        </p>
      ) : null}
      {earnings.passedCount > 0 ? (
        <HindiText
          className="emp-notice emp-notice-ok"
          english="After a successful QR scan, kindly remove the mandate from your Autopay request."
          hindi="QR स्कैन सफल होने के बाद, कृपया अपने ऑटोपे अनुरोध से मैंडेट हटा दें।"
        />
      ) : null}
      <QrGroup
        title="Reserve a QR"
        payments={open}
        empty="No QR is waiting to be reserved."
        onReserve={onReserve}
        reserveLocked={reserveLocked}
      />
      <QrGroup title="Ready to scan" payments={ready} empty="No QR is waiting to be scanned right now." />
    </>
  );
}

export function EmployeeHistoryBoard({
  history,
  successRewardInr,
}: {
  history: PaymentSession[];
  successRewardInr: number;
}) {
  const passed = history.filter((payment) => payment.status === "SUCCESS");
  const failed = history.filter((payment) => payment.status === "FAILED");
  const expired = history.filter((payment) => payment.status === "EXPIRED");

  return (
    <>
      <QrGroup title="Passed" payments={passed} successRewardInr={successRewardInr} empty="No passed QR on this page." />
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
      <PaymentCardGrid
        payments={payments}
        successRewardInr={successRewardInr}
        onReserve={onReserve}
        reserveLocked={reserveLocked}
      />
    </section>
  );
}
