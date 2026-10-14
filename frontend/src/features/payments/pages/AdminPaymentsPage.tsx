import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PaymentCardGrid } from "../components/PaymentCardGrid";
import { PaymentTable } from "../components/PaymentTable";
import { usePayments } from "../hooks/usePayments";
import { paymentApi } from "../api/paymentApi";
import { isTerminal, Employee } from "../types/payment.types";

export function AdminPaymentsPage() {
  const navigate = useNavigate();
  const { payments, loading, error, cancel } = usePayments("admin");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const livePayments = payments.filter((payment) => !isTerminal(payment.status));
  const finishedPayments = payments.filter((payment) => isTerminal(payment.status)).slice(0, 3);
  const names = new Map(employees.map((employee) => [employee.id, employee.name]));

  useEffect(() => {
    let cancelled = false;
    paymentApi
      .listEmployees()
      .then((result) => {
        if (!cancelled) setEmployees(result.employees);
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">Sessions</p>
        <h1>Live QRs</h1>
        <p className="muted">New QRs and reservations show up here without a refresh.</p>
      </div>
      {loading ? <p>Loading QR codes…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {!loading && livePayments.length === 0 ? (
        <p className="muted">No live QR yet. Send one from the extension.</p>
      ) : null}
      <PaymentCardGrid payments={livePayments} holderNames={names} />
      {finishedPayments.length > 0 ? (
        <>
          <h2 className="section-title">Recent results</h2>
          <PaymentCardGrid payments={finishedPayments} holderNames={names} />
        </>
      ) : null}
      <h2 className="section-title">All sessions</h2>
      <PaymentTable
        payments={payments}
        employees={employees}
        onOpen={(id) => navigate(`/admin/payments/${id}`)}
        onCancel={cancel}
      />
    </section>
  );
}
