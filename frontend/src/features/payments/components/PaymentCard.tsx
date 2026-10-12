import { PaymentSession } from "../types/payment.types";
import { isTerminal } from "../types/payment.types";
import { statusLabel } from "../state/paymentEvents";
import { PaymentQr } from "./PaymentQr";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { PaymentTimer } from "./PaymentTimer";

export function PaymentCard({
  payment,
  qrImage,
  resultLabel,
}: {
  payment: PaymentSession;
  qrImage?: string | null;
  resultLabel?: string;
}) {
  const terminal = isTerminal(payment.status);
  return (
    <article className="payment-card">
      <header>
        <div>
          <p className="eyebrow">Google Cloud Verification</p>
          <h2>{payment.code}</h2>
        </div>
        <PaymentStatusBadge status={payment.status} />
      </header>
      <PaymentQr src={terminal ? null : qrImage} />
      {!terminal ? <p>Scan using your UPI app</p> : null}
      <p className="countdown-label">
        Expires in <PaymentTimer expiresAt={payment.expiresAt} active={!terminal} />
      </p>
      <p className={`status-copy status-${payment.status.toLowerCase()}`}>
        {[statusMark(payment.status), statusLabel(payment.status)].filter(Boolean).join(" ")}
      </p>
      {resultLabel ? <p className="earn-result">{resultLabel}</p> : null}
    </article>
  );
}

function statusMark(status: PaymentSession["status"]): string {
  if (status === "SUCCESS") return "✅";
  if (status === "FAILED") return "❌";
  if (status === "EXPIRED") return "⌛";
  return "";
}
