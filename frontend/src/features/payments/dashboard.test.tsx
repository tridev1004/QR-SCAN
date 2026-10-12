import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PaymentCard } from "./components/PaymentCard";
import { PaymentQr } from "./components/PaymentQr";
import { PaymentTable } from "./components/PaymentTable";
import { PaymentTimer } from "./components/PaymentTimer";
import { applyPaymentEvent } from "./state/paymentEvents";
import { PaymentSession } from "./types/payment.types";

const employees = [
  { id: "rahul", name: "Rahul", email: "rahul@company.local", active: true, successRewardInr: 0 },
  { id: "aman", name: "Aman", email: "aman@company.local", active: true, successRewardInr: 0 },
  { id: "rohit", name: "Rohit", email: "rohit@company.local", active: true, successRewardInr: 0 },
];

function session(overrides: Partial<PaymentSession>): PaymentSession {
  return {
    id: "1",
    code: "PAY-001",
    status: "WAITING_FOR_PAYMENT",
    assignedEmployeeId: "rahul",
    createdAt: "2026-10-01T12:00:00.000Z",
    updatedAt: "2026-10-01T12:00:00.000Z",
    expiresAt: "2026-10-01T12:04:40.000Z",
    history: [],
    ...overrides,
  };
}

describe("payment dashboard", () => {
  it("renders several admin sessions without mixing them", () => {
    render(
      <PaymentTable
        employees={employees}
        onOpen={() => undefined}
        payments={[
          session({ id: "1", code: "PAY-001", assignedEmployeeId: "rahul", status: "WAITING_FOR_PAYMENT" }),
          session({ id: "2", code: "PAY-002", assignedEmployeeId: "aman", status: "SUCCESS" }),
          session({ id: "3", code: "PAY-003", assignedEmployeeId: "rohit", status: "FAILED" }),
        ]}
      />,
    );
    expect(screen.getByText("Rahul")).toBeInTheDocument();
    expect(screen.getByText("Aman")).toBeInTheDocument();
    expect(screen.getByText("Rohit")).toBeInTheDocument();
    expect(screen.getByText("PAY-001")).toBeInTheDocument();
    expect(screen.getByText("PAY-002")).toBeInTheDocument();
    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("shows an assigned session, its QR, and the live countdown", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
      render(
        <PaymentCard
          payment={session({ assignedEmployeeId: "rahul" })}
          qrImage="data:image/png;base64,abc"
        />,
      );
      expect(screen.getByRole("heading", { name: "PAY-001" })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "UPI QR code" })).toHaveAttribute("src", "data:image/png;base64,abc");
      expect(screen.getByText("04:40")).toBeInTheDocument();
      expect(screen.getByText("Waiting for verification...")).toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText("04:39")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("updates only the session named in a success event", () => {
    const initial = [
      session({ id: "1", code: "PAY-001" }),
      session({ id: "2", code: "PAY-002", assignedEmployeeId: "aman" }),
    ];
    function Board() {
      const [payments, setPayments] = useState(initial);
      return (
        <div>
          <button
            type="button"
            onClick={() =>
              setPayments((current) =>
                applyPaymentEvent(
                  current,
                  {
                    type: "payment-status",
                    data: { paymentSessionId: "1", status: "SUCCESS", assignedEmployeeId: "rahul" },
                  },
                  { id: "admin", role: "ADMIN" },
                ),
              )
            }
          >
            Apply success
          </button>
          {payments.map((payment) => (
            <PaymentCard key={payment.id} payment={payment} qrImage="data:image/png;base64,abc" />
          ))}
        </div>
      );
    }
    render(<Board />);
    fireEvent.click(screen.getByRole("button", { name: "Apply success" }));
    expect(screen.getByText(/Verification successful/)).toBeInTheDocument();
    expect(screen.getByText("Waiting for verification...")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "UPI QR code" })).toHaveLength(1);
  });

  it("shows failure and expiry copy and hides the QR", () => {
    const { rerender } = render(<PaymentCard payment={session({ status: "FAILED" })} qrImage="data:image/png;base64,abc" />);
    expect(screen.getByText(/Verification failed/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    rerender(<PaymentCard payment={session({ status: "EXPIRED" })} qrImage="data:image/png;base64,abc" />);
    expect(screen.getByText(/QR expired/)).toBeInTheDocument();
    rerender(<PaymentTimer expiresAt={undefined} active={false} />);
    expect(screen.getByText("--:--")).toBeInTheDocument();
  });
});

describe("PaymentQr", () => {
  it("renders the captured image", () => {
    render(<PaymentQr src="data:image/png;base64,zzz" />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });
});
