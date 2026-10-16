import { PaymentStatus } from "../../domain/enums/PaymentStatus";
import { PaymentSessionDto } from "../../application/dto/payment.dto";

export type PaymentStreamEvent =
  | {
      type: "payment-created";
      data: PaymentSessionDto;
    }
  | {
      type: "payment-status";
      data: {
        paymentSessionId: string;
        status: PaymentStatus;
        errorMessage?: string;
        completedAt?: string;
        assignedEmployeeId?: string;
      };
    }
  | {
      type: "payment-assigned";
      data: PaymentSessionDto;
    }
  | {
      type: "payout-updated";
      data: {
        employeeId: string;
        paidInr: number;
        unpaidInr: number;
        earnedInr: number;
      };
    }
  | {
      type: "pause-cleared";
      data: { employeeId: string };
    };

type Listener = (event: PaymentStreamEvent) => void;

export class PaymentEventBus {
  private readonly listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(event: PaymentStreamEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        this.listeners.delete(listener);
      }
    }
  }
}
