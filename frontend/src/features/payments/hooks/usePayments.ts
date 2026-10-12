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

  return { payments, earnings, loading, error, reload };
}
