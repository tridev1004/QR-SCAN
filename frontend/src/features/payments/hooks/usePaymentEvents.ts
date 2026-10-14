import { useEffect, useRef } from "react";
import { apiUrl } from "../../../api/client";
import { useAuth } from "../../../auth/AuthContext";
import { runPaymentEventLoop } from "../api/sse";
import { PaymentStreamEvent } from "../types/payment.types";

export function usePaymentEvents(
  onEvent: (event: PaymentStreamEvent) => void,
  onReconnect?: () => void,
) {
  const { token } = useAuth();
  const handler = useRef(onEvent);
  const reconnect = useRef(onReconnect);
  handler.current = onEvent;
  reconnect.current = onReconnect;

  useEffect(() => {
    if (!token) {
      return;
    }
    const controller = new AbortController();
    void runPaymentEventLoop({
      signal: controller.signal,
      onEvent: (event) => handler.current(event),
      onConnected: (attempt) => {
        if (attempt > 0) reconnect.current?.();
      },
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      open: () =>
        fetch(apiUrl("/api/payments/events"), {
          headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
          signal: controller.signal,
        }),
    });
    return () => controller.abort();
  }, [token]);
}
