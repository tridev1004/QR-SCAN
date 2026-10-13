import { useEffect, useRef } from "react";
import { apiUrl } from "../../../api/client";
import { useAuth } from "../../../auth/AuthContext";
import { runPaymentEventLoop } from "../api/sse";
import { PaymentStreamEvent } from "../types/payment.types";

export function usePaymentEvents(onEvent: (event: PaymentStreamEvent) => void) {
  const { token } = useAuth();
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!token) {
      return;
    }
    const controller = new AbortController();
    void runPaymentEventLoop({
      signal: controller.signal,
      onEvent: (event) => handler.current(event),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      open: () =>
        fetch(apiUrl("/api/payments/events"), {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }),
    });
    return () => controller.abort();
  }, [token]);
}
