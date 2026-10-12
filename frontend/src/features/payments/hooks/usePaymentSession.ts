import { useCallback, useEffect, useState } from "react";
import { paymentApi } from "../api/paymentApi";
import { isTerminal, PaymentSession } from "../types/payment.types";
import { usePaymentEvents } from "./usePaymentEvents";

export function usePaymentSession(paymentSessionId: string) {
  const [payment, setPayment] = useState<PaymentSession | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const result = await paymentApi.get(paymentSessionId);
    setPayment(result.payment);
    if (isTerminal(result.payment.status)) {
      setQrImage(null);
      return;
    }
    setQrImage(await paymentApi.getQr(paymentSessionId));
  }, [paymentSessionId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reload()
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load session");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  usePaymentEvents((event) => {
    const eventId = event.type === "payment-status" ? event.data.paymentSessionId : event.data.id;
    if (eventId !== paymentSessionId) {
      return;
    }
    if (event.type === "payment-status") {
      setPayment((current) =>
        current
          ? {
              ...current,
              status: event.data.status,
              errorMessage: event.data.errorMessage,
              completedAt: event.data.completedAt,
              history: [
                ...current.history,
                { status: event.data.status, at: event.data.completedAt ?? new Date().toISOString(), message: event.data.errorMessage },
              ],
            }
          : current,
      );
      if (isTerminal(event.data.status)) {
        setQrImage(null);
      }
      return;
    }
    setPayment(event.data);
  });

  return { payment, qrImage, error, loading, reload };
}
