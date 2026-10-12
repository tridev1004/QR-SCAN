import { PaymentHistoryEntry, PaymentSession } from "../../domain/entities/PaymentSession";
import { PaymentStatus } from "../../domain/enums/PaymentStatus";

export interface PaymentSessionDto {
  id: string;
  code: string;
  status: PaymentStatus;
  assignedEmployeeId?: string;
  createdByUserId?: string;
  amount?: number;
  currency?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
  history: Array<{
    status: PaymentStatus;
    at: string;
    message?: string;
  }>;
}

export function toPaymentDto(session: PaymentSession): PaymentSessionDto {
  return {
    id: session.id,
    code: session.code,
    status: session.status,
    assignedEmployeeId: session.assignedEmployeeId,
    createdByUserId: session.createdByUserId,
    amount: session.amount,
    currency: session.currency,
    expiresAt: session.expiresAt?.toISOString(),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    completedAt: session.completedAt?.toISOString(),
    errorMessage: session.errorMessage,
    history: session.history.map(toHistoryDto),
  };
}

function toHistoryDto(entry: PaymentHistoryEntry): PaymentSessionDto["history"][number] {
  return {
    status: entry.status,
    at: entry.at.toISOString(),
    message: entry.message,
  };
}
