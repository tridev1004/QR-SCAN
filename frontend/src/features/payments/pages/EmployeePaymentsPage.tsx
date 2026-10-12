import { EmployeeQrBoard } from "../components/EmployeeQrBoard";
import { usePayments } from "../hooks/usePayments";

export function EmployeePaymentsPage() {
  const { payments, earnings, loading, error } = usePayments("employee");

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Employee</p>
          <h1>Your QRs</h1>
          <p className="muted">Earnings use the amount an admin saved for each passed QR.</p>
        </div>
      </div>
      {loading ? <p>Loading QR codes…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {!loading && earnings ? <EmployeeQrBoard payments={payments} successRewardInr={earnings.successRewardInr} /> : null}
    </section>
  );
}
