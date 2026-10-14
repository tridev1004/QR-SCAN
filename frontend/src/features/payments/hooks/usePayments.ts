import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { paymentApi, AdminPaymentQuery } from "../api/paymentApi";
import { applyPaymentEvent } from "../state/paymentEvents";
import { EmployeeEarnings, PaymentSession } from "../types/payment.types";
import { usePaymentEvents } from "./usePaymentEvents";

const EMPTY_QUERY: AdminPaymentQuery = {};

export function usePayments(mode: "employee" | "admin", query: AdminPaymentQuery = EMPTY_QUERY) {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentSession[]>([]);
  const [earnings, setEarnings] = useState<EmployeeEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryKey = JSON.stringify(query);

  const reload = useCallback(async () => {
    if (mode === "admin") {
      const result = await paymentApi.listAdmin(query);
      setPayments(result.payments);
      return;
    }
    const result = await paymentApi.listMine();
    setPayments(result.payments);
    setEarnings(result.earnings);
  }, [mode, queryKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reload()
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load payments");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  usePaymentEvents((event) => {
    if (!user) return;
    setPayments((current) => applyPaymentEvent(current, event, user));
  });

  const reserve = useCallback(async (id: string) => {
    try {
      const result = await paymentApi.reserve(id);
      setPayments((current) => current.map((item) => (item.id === result.payment.id ? result.payment : item)));
      return result.payment;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not reserve this QR";
      if (/reserved/i.test(message)) {
        setPayments((current) => current.filter((item) => item.id !== id));
      }
      throw caught;
    }
  }, []);

  const cancel = useCallback(async (id: string) => {
    const result = await paymentApi.cancel(id);
    setPayments((current) => current.map((item) => (item.id === result.payment.id ? result.payment : item)));
    return result.payment;
  }, []);

  return { payments, earnings, loading, error, reload, reserve, cancel };
}
