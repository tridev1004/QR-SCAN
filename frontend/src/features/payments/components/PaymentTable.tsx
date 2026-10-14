import { useState } from "react";
import { Button } from "@/components/ui/button";
import { holderLabel } from "../state/paymentEvents";
import { Employee, PaymentSession } from "../types/payment.types";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { PaymentTimer } from "./PaymentTimer";
import { isTerminal } from "../types/payment.types";

export function PaymentTable({
  payments,
  employees,
  onOpen,
  onCancel,
}: {
  payments: PaymentSession[];
  employees: Employee[];
  onOpen: (id: string) => void;
  onCancel?: (id: string) => Promise<unknown>;
}) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const names = new Map(employees.map((employee) => [employee.id, employee.name]));

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Reserved by</th>
            <th>Session</th>
            <th>Created</th>
            <th>Expires</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 ? (
            <tr>
              <td colSpan={6}>No payment sessions yet.</td>
            </tr>
          ) : (
            payments.map((payment) => (
              <tr key={payment.id}>
                <td>{holderLabel(payment, names)}</td>
                <td>{payment.code}</td>
                <td>{new Date(payment.createdAt).toLocaleString()}</td>
                <td>
                  <PaymentTimer expiresAt={payment.expiresAt} active={!isTerminal(payment.status)} />
                </td>
                <td>
                  <PaymentStatusBadge status={payment.status} />
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onOpen(payment.id)}>
                      Open
                    </Button>
                    {onCancel && !isTerminal(payment.status) ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={cancellingId === payment.id}
                        onClick={() => {
                          if (!window.confirm(`Cancel ${payment.code}? Employees will see it as failed.`)) {
                            return;
                          }
                          setCancellingId(payment.id);
                          void onCancel(payment.id).finally(() => setCancellingId(null));
                        }}
                      >
                        {cancellingId === payment.id ? "Cancelling…" : "Cancel"}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
