import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { holderLabel } from "../state/paymentEvents";
import { Employee, PaymentSession } from "../types/payment.types";
import { isTerminal } from "../types/payment.types";
import { statusLabel } from "../state/paymentEvents";
import { PaymentQr } from "./PaymentQr";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { PaymentTimer } from "./PaymentTimer";

export function PaymentDetails({
  payment,
  qrImage,
  employees,
  onAssign,
  onCancel,
}: {
  payment: PaymentSession;
  qrImage?: string | null;
  employees?: Employee[];
  onAssign?: (employeeId: string) => Promise<void>;
  onCancel?: () => Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState(payment.assignedEmployeeId ?? "");
  const [busy, setBusy] = useState(false);
  const terminal = isTerminal(payment.status);
  const names = new Map((employees ?? []).map((employee) => [employee.id, employee.name]));

  useEffect(() => {
    setEmployeeId(payment.assignedEmployeeId ?? "");
  }, [payment.assignedEmployeeId]);

  async function assign(event: FormEvent) {
    event.preventDefault();
    if (!onAssign || !employeeId) return;
    setBusy(true);
    try {
      await onAssign(employeeId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="details">
      <div className="details-main">
        <p className="eyebrow">Payment session</p>
        <h1>{payment.code}</h1>
        <PaymentStatusBadge status={payment.status} />
        <p className="status-copy">{statusLabel(payment.status)}</p>
        <PaymentQr src={terminal ? null : qrImage} />
        <p>
          Expires in <PaymentTimer expiresAt={payment.expiresAt} active={!terminal} />
        </p>
        <dl>
          <div>
            <dt>Reserved by</dt>
            <dd>{holderLabel(payment, names)}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{new Date(payment.createdAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Expiration</dt>
            <dd>{payment.expiresAt ? new Date(payment.expiresAt).toLocaleString() : "Unknown"}</dd>
          </div>
          {payment.errorMessage ? (
            <div>
              <dt>Note</dt>
              <dd>{payment.errorMessage}</dd>
            </div>
          ) : null}
        </dl>
        {onAssign && !terminal ? (
          <form onSubmit={assign} className="inline-form">
            <label>
              Employee
              <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                <option value="">Select employee</option>
                {employees?.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={busy || !employeeId}>
              {payment.assignedEmployeeId ? "Reassign" : "Assign"}
            </button>
          </form>
        ) : null}
        {onCancel && !terminal ? (
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Cancel this QR? The employee will see it as failed.")) {
                setBusy(true);
                void onCancel().finally(() => setBusy(false));
              }
            }}
          >
            {busy ? "Cancelling…" : "Cancel QR"}
          </Button>
        ) : null}
        {terminal ? (
          <p className="muted">To try again, generate a new QR in Google Cloud. The extension will open a new session.</p>
        ) : null}
      </div>
      <aside>
        <h2>History</h2>
        <ol className="history">
          {payment.history.map((entry, index) => (
            <li key={`${entry.status}-${entry.at}-${index}`}>
              <strong>{entry.status}</strong>
              <span>{new Date(entry.at).toLocaleString()}</span>
              {entry.message ? <span>{entry.message}</span> : null}
            </li>
          ))}
        </ol>
      </aside>
    </section>
  );
}
