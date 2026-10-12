import { Employee, PaymentSession } from "../types/payment.types";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { PaymentTimer } from "./PaymentTimer";
import { isTerminal } from "../types/payment.types";

export function PaymentTable({
  payments,
  employees,
  onOpen,
}: {
  payments: PaymentSession[];
  employees: Employee[];
  onOpen: (id: string) => void;
}) {
  const names = new Map(employees.map((employee) => [employee.id, employee.name]));

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Employee</th>
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
                <td>{payment.assignedEmployeeId ? names.get(payment.assignedEmployeeId) ?? "Assigned" : "Unassigned"}</td>
                <td>{payment.code}</td>
                <td>{new Date(payment.createdAt).toLocaleString()}</td>
                <td>
                  <PaymentTimer expiresAt={payment.expiresAt} active={!isTerminal(payment.status)} />
                </td>
                <td>
                  <PaymentStatusBadge status={payment.status} />
                </td>
                <td>
                  <button type="button" onClick={() => onOpen(payment.id)}>
                    Open
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
