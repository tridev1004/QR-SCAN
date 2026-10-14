import { useState } from "react";
import { PaymentCard } from "./PaymentCard";
import { useQrImage } from "../hooks/useQrImage";
import { holderLabel } from "../state/paymentEvents";
import { formatInr } from "../state/money";
import { PaymentSession } from "../types/payment.types";

export function PaymentCardGrid({
  payments,
  successRewardInr,
  onReserve,
  holderNames,
}: {
  payments: PaymentSession[];
  successRewardInr?: number;
  onReserve?: (id: string) => Promise<unknown>;
  holderNames?: Map<string, string>;
}) {
  return (
    <div className="card-grid">
      {payments.map((payment) => (
        <LivePaymentCard
          key={payment.id}
          payment={payment}
          successRewardInr={successRewardInr}
          onReserve={onReserve}
          holderNames={holderNames}
        />
      ))}
    </div>
  );
}

function LivePaymentCard({
  payment,
  successRewardInr,
  onReserve,
  holderNames,
}: {
  payment: PaymentSession;
  successRewardInr?: number;
  onReserve?: (id: string) => Promise<unknown>;
  holderNames?: Map<string, string>;
}) {
  const claimable = payment.broadcast === true && !payment.assignedEmployeeId;
  const qrImage = useQrImage(payment.id, payment.status, !claimable);
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const resultLabel =
    payment.status === "SUCCESS" && successRewardInr !== undefined ? `Result ${formatInr(successRewardInr)}` : undefined;

  return (
    <PaymentCard
      payment={payment}
      qrImage={qrImage}
      resultLabel={resultLabel}
      reserving={reserving}
      reserveError={reserveError}
      holderLabel={
        holderNames
          ? payment.assignedEmployeeId
            ? `Reserved by ${holderLabel(payment, holderNames)}`
            : holderLabel(payment, holderNames)
          : undefined
      }
      onReserve={() => {
        if (!onReserve || reserving) {
          return;
        }
        setReserveError(null);
        setReserving(true);
        void onReserve(payment.id)
          .catch((caught: unknown) => {
            setReserveError(caught instanceof Error ? caught.message : "Could not reserve this QR");
          })
          .finally(() => setReserving(false));
      }}
    />
  );
}
