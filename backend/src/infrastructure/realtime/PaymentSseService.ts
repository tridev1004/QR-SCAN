import { Response } from "express";
import { PublicUser } from "../../domain/entities/User";
import { UserRole } from "../../domain/enums/UserRole";
import { PaymentEventBus, PaymentStreamEvent } from "./PaymentEventBus";

export function eventSessionId(event: PaymentStreamEvent): string {
  if (event.type === "payment-status") {
    return event.data.paymentSessionId;
  }
  return event.data.id;
}

export function canReceivePaymentEvent(user: PublicUser, event: PaymentStreamEvent): boolean {
  if (user.role === UserRole.ADMIN) {
    return true;
  }
  if (user.role !== UserRole.EMPLOYEE) {
    return false;
  }
  if (event.type === "payment-assigned") {
    return true;
  }
  if (!event.data.assignedEmployeeId) {
    if (event.type === "payment-created") {
      return event.data.broadcast === true;
    }
    return event.type === "payment-status";
  }
  return event.data.assignedEmployeeId === user.id;
}

export class PaymentSseService {
  constructor(private readonly bus: PaymentEventBus) {}

  connect(user: PublicUser, res: Response, paymentSessionId?: string): void {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write(": connected\n\n");

    let unsubscribe = () => undefined;
    let ping: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (ping) clearInterval(ping);
      unsubscribe();
    };
    unsubscribe = this.bus.subscribe((event) => {
      try {
        if (!canReceivePaymentEvent(user, event)) {
          return;
        }
        if (paymentSessionId && eventSessionId(event) !== paymentSessionId) {
          return;
        }
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event.data)}\n\n`);
      } catch {
        stop();
      }
    });

    ping = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        stop();
      }
    }, 20000);

    res.on("close", () => {
      stop();
    });
  }
}
