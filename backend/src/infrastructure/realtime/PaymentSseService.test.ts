import { describe, expect, it } from "vitest";
import { UserRole } from "../../domain/enums/UserRole";
import { PaymentStatus } from "../../domain/enums/PaymentStatus";
import { canReceivePaymentEvent } from "./PaymentSseService";
import { PublicUser } from "../../domain/entities/User";

const employeeA: PublicUser = {
  id: "emp-a",
  name: "Rahul",
  email: "rahul@company.local",
  role: UserRole.EMPLOYEE,
  active: true,
  successRewardInr: 0,
};

const employeeB: PublicUser = {
  id: "emp-b",
  name: "Aman",
  email: "aman@company.local",
  role: UserRole.EMPLOYEE,
  active: true,
  successRewardInr: 0,
};

const admin: PublicUser = {
  id: "admin",
  name: "Admin",
  email: "admin@company.local",
  role: UserRole.ADMIN,
  active: true,
  successRewardInr: 0,
};

describe("SSE authorization", () => {
  it("sends a captured QR only to the assigned employee", () => {
    const captured = {
      type: "payment-status" as const,
      data: {
        paymentSessionId: "3",
        status: PaymentStatus.QR_READY,
        assignedEmployeeId: "emp-a",
      },
    };

    expect(canReceivePaymentEvent(employeeA, captured)).toBe(true);
    expect(canReceivePaymentEvent(employeeB, captured)).toBe(false);
  });

  it("lets an admin receive every event", () => {
    expect(
      canReceivePaymentEvent(admin, {
        type: "payment-status",
        data: { paymentSessionId: "1", status: PaymentStatus.FAILED, assignedEmployeeId: "emp-b" },
      }),
    ).toBe(true);
  });
});
