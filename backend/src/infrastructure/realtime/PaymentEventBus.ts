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
      listener(event);
    }
  }
}
