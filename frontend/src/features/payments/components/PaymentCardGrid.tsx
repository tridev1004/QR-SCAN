import { PaymentCard } from "./PaymentCard";
import { useQrImage } from "../hooks/useQrImage";
import { formatInr } from "../state/money";
import { PaymentSession } from "../types/payment.types";

export function PaymentCardGrid({
  payments,
  successRewardInr,
}: {
  payments: PaymentSession[];
  successRewardInr?: number;
}) {
  return (
    <div className="card-grid">
      {payments.map((payment) => (
        <LivePaymentCard key={payment.id} payment={payment} successRewardInr={successRewardInr} />
      ))}
    </div>
  );
}

function LivePaymentCard({ payment, successRewardInr }: { payment: PaymentSession; successRewardInr?: number }) {
  const qrImage = useQrImage(payment.id, payment.status);
  const resultLabel =
    payment.status === "SUCCESS" && successRewardInr !== undefined ? `Result ${formatInr(successRewardInr)}` : undefined;
  return <PaymentCard payment={payment} qrImage={qrImage} resultLabel={resultLabel} />;
}
