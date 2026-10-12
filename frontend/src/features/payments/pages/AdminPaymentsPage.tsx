import { useNavigate } from "react-router-dom";
import { PaymentCardGrid } from "../components/PaymentCardGrid";
import { PaymentTable } from "../components/PaymentTable";
import { usePayments } from "../hooks/usePayments";
import { isTerminal } from "../types/payment.types";

export function AdminPaymentsPage() {
  const navigate = useNavigate();
  const { payments, loading, error } = usePayments("admin");
  const livePayments = payments.filter((payment) => !isTerminal(payment.status));
  const finishedPayments = payments.filter((payment) => isTerminal(payment.status)).slice(0, 3);

  return (
    <section>
      <div className="page-heading">
        <p className="muted">Generate a QR in Google Cloud. It appears here for the employee you selected.</p>
      </div>
      {loading ? <p>Loading QR codes…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {!loading && livePayments.length === 0 ? (
        <p className="muted">No live QR yet. Generate one in the Google Cloud tab.</p>
      ) : null}
      <PaymentCardGrid payments={livePayments} />
      {finishedPayments.length > 0 ? (
        <>
          <h2 className="section-title">Payment result</h2>
          <PaymentCardGrid payments={finishedPayments} />
        </>
      ) : null}
      <h2 className="section-title">All sessions</h2>
      <PaymentTable payments={payments} employees={[]} onOpen={(id) => navigate(`/admin/payments/${id}`)} />
    </section>
  );
}
