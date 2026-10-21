import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { paymentApi } from "../api/paymentApi";
import { PaymentDetails } from "../components/PaymentDetails";
import { usePaymentSession } from "../hooks/usePaymentSession";
import { Employee } from "../types/payment.types";

export function PaymentDetailsPage() {
  const { paymentSessionId = "" } = useParams();
  const { user } = useAuth();
  const { payment, qrImage, error, loading, reload } = usePaymentSession(paymentSessionId);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const admin = user?.role === "ADMIN";
  const sessionViewer = user?.role === "SESSION_VIEWER";

  useEffect(() => {
    if (!admin) return;
    paymentApi
      .listEmployees()
      .then((result) => setEmployees(result.employees))
      .catch(() => setEmployees([]));
  }, [admin]);

  return (
    <section>
      <Link to={admin || sessionViewer ? "/admin/payments" : "/dashboard"} className="back-link">
        Back
      </Link>
      {loading ? <p>Loading session…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {actionError ? <p className="form-error">{actionError}</p> : null}
      {payment ? (
        <PaymentDetails
          payment={payment}
          qrImage={qrImage}
          employees={employees}
          onAssign={
            admin
              ? async (employeeId) => {
                  setActionError(null);
                  try {
                    await paymentApi.assign(payment.id, employeeId);
                    await reload();
                  } catch (caught) {
                    setActionError(caught instanceof Error ? caught.message : "Unable to assign");
                  }
                }
              : undefined
          }
          onCancel={
            admin
              ? async () => {
                  setActionError(null);
                  try {
                    await paymentApi.cancel(payment.id);
                    await reload();
                  } catch (caught) {
                    setActionError(caught instanceof Error ? caught.message : "Unable to cancel");
                  }
                }
              : undefined
          }
        />
      ) : null}
    </section>
  );
}
