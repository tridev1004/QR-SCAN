import { isTerminal, PaymentSession, PaymentStreamEvent } from "../types/payment.types";
import { PublicUser } from "../../../auth/AuthContext";

export function formatRemaining(expiresAt: string | undefined, now: number): string {
  if (!expiresAt) {
    return "--:--";
  }
  const remainingMs = new Date(expiresAt).getTime() - now;
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function statusLabel(status: PaymentSession["status"]): string {
  switch (status) {
    case "SUCCESS":
      return "Verification successful";
    case "FAILED":
      return "Verification failed";
    case "EXPIRED":
      return "QR expired";
    case "QR_READY":
      return "QR ready";
    case "DETECTED":
      return "QR detected";
    default:
      return "Waiting for verification...";
  }
}

export function applyPaymentEvent(
  sessions: PaymentSession[],
  event: PaymentStreamEvent,
  viewer: Pick<PublicUser, "id" | "role">,
): PaymentSession[] {
  if (!canViewerSee(event, viewer)) {
    if (event.type === "payment-assigned") {
      return sessions.filter((session) => session.id !== event.data.id);
    }
    return sessions;
  }

  if (event.type === "payment-status") {
    if (viewer.role !== "ADMIN" && !event.data.assignedEmployeeId && isTerminal(event.data.status)) {
      return sessions.filter((session) => session.id !== event.data.paymentSessionId);
    }
    return sessions.map((session) =>
      session.id === event.data.paymentSessionId
        ? {
            ...session,
            status: event.data.status,
            errorMessage: event.data.errorMessage,
            completedAt: event.data.completedAt,
            assignedEmployeeId: event.data.assignedEmployeeId ?? session.assignedEmployeeId,
          }
        : session,
    );
  }

  const index = sessions.findIndex((session) => session.id === event.data.id);
  if (index === -1) {
    return [event.data, ...sessions];
  }
  return sessions.map((session) => (session.id === event.data.id ? event.data : session));
}

export function holderLabel(
  payment: Pick<PaymentSession, "assignedEmployeeId" | "broadcast">,
  names: Map<string, string>,
): string {
  if (payment.assignedEmployeeId) {
    return names.get(payment.assignedEmployeeId) ?? "Reserved";
  }
  if (payment.broadcast) {
    return "Waiting to be reserved";
  }
  return "Unassigned";
}

function canViewerSee(event: PaymentStreamEvent, viewer: Pick<PublicUser, "id" | "role">): boolean {
  if (viewer.role === "ADMIN") {
    return true;
  }
  if (viewer.role !== "EMPLOYEE") {
    return false;
  }
  if (event.type === "payment-created" && event.data.broadcast && !event.data.assignedEmployeeId) {
    return true;
  }
  if (event.type === "payment-status" && !event.data.assignedEmployeeId) {
    return true;
  }
  return event.data.assignedEmployeeId === viewer.id;
}
