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

  it("shows an unclaimed QR to every employee and tells the others when it is reserved", () => {
    const opened = {
      type: "payment-created" as const,
      data: {
        id: "9",
        code: "PAY-009",
        status: PaymentStatus.QR_READY,
        broadcast: true,
        createdAt: "2026-10-01T12:00:00.000Z",
        updatedAt: "2026-10-01T12:00:00.000Z",
        history: [],
      },
    };
    expect(canReceivePaymentEvent(employeeA, opened)).toBe(true);
    expect(canReceivePaymentEvent(employeeB, opened)).toBe(true);

    const reserved = {
      type: "payment-assigned" as const,
      data: { ...opened.data, broadcast: false, assignedEmployeeId: "emp-a" },
    };
    expect(canReceivePaymentEvent(employeeA, reserved)).toBe(true);
    expect(canReceivePaymentEvent(employeeB, reserved)).toBe(true);
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
