import { Button } from "@/components/ui/button";
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
  reserving = false,
  reserveLocked = false,
  reserveError,
  onReserve,
  holderLabel,
}: {
  payment: PaymentSession;
  qrImage?: string | null;
  resultLabel?: string;
  reserving?: boolean;
  reserveLocked?: boolean;
  reserveError?: string | null;
  onReserve?: () => void;
  holderLabel?: string;
}) {
  const terminal = isTerminal(payment.status);
  const claimable = payment.broadcast === true && !payment.assignedEmployeeId;
  return (
    <article className="payment-card">
      <header>
        <div>
          <p className="eyebrow">Google Cloud Verification</p>
          <h2>{payment.code}</h2>
        </div>
        <PaymentStatusBadge status={payment.status} />
      </header>
      {holderLabel ? <p className="text-sm font-medium text-foreground">{holderLabel}</p> : null}
      {claimable ? (
        <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
          <div className="aspect-square w-full animate-pulse bg-gradient-to-br from-stone-300 to-stone-100 blur-sm" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/50 px-4 text-center backdrop-blur-md">
            <p className="text-sm font-medium text-foreground">Someone needs to reserve this QR</p>
            {onReserve ? (
              <Button type="button" size="lg" disabled={reserving || reserveLocked} onClick={onReserve}>
                {reserving ? "Reserving…" : reserveLocked ? "Two QRs in progress" : "Reserve"}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Waiting for an employee to reserve it</p>
            )}
            {reserveError ? <p className="text-xs text-destructive">{reserveError}</p> : null}
          </div>
        </div>
      ) : (
        <PaymentQr src={terminal ? null : qrImage} />
      )}
      {!terminal && !claimable ? <p>Scan using your UPI app</p> : null}
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
