import { useCallback, useEffect, useRef, useState } from "react";
import { PublicUser, useAuth } from "../../../auth/AuthContext";
import { paymentApi, AdminPaymentQuery } from "../api/paymentApi";
import { applyPaymentEvent, mergeLivePayments } from "../state/paymentEvents";
import { EmployeeEarnings, isTerminal, PaymentSession, PaymentStreamEvent } from "../types/payment.types";
import { usePaymentEvents } from "./usePaymentEvents";

const EMPTY_QUERY: AdminPaymentQuery = {};

function adjustEarnings(current: EmployeeEarnings | null, previous: PaymentSession | undefined, event: PaymentStreamEvent) {
  if (!current || event.type !== "payment-status" || !previous || previous.status === event.data.status) {
    return current;
  }
  let passedCount = current.passedCount;
  let failedCount = current.failedCount;
  if (previous.status === "SUCCESS") passedCount -= 1;
  if (previous.status === "FAILED") failedCount -= 1;
  if (event.data.status === "SUCCESS") passedCount += 1;
  if (event.data.status === "FAILED") failedCount += 1;
  const earnedInr = passedCount * current.successRewardInr;
  return {
    ...current,
    passedCount,
    failedCount,
    earnedInr,
    unpaidInr: Math.max(0, earnedInr - (current.paidInr ?? 0)),
  };
}

function applyHistory(
  current: PaymentSession[],
  event: PaymentStreamEvent,
  user: PublicUser,
  live: PaymentSession[],
  firstPage: boolean,
): PaymentSession[] {
  const updated = applyPaymentEvent(current, event, user).filter((item) => current.some((row) => row.id === item.id));
  if (event.type !== "payment-status" || !isTerminal(event.data.status) || !firstPage) {
    return updated;
  }
  const previous = live.find((item) => item.id === event.data.paymentSessionId);
  if (!previous || (user.role === "EMPLOYEE" && previous.assignedEmployeeId !== user.id)) {
    return updated;
  }
  const row: PaymentSession = {
    ...previous,
    status: event.data.status,
    errorMessage: event.data.errorMessage,
    completedAt: event.data.completedAt,
    updatedAt: new Date().toISOString(),
  };
  if (updated.some((item) => item.id === row.id)) {
    return updated.map((item) => (item.id === row.id ? row : item));
  }
  return [row, ...updated];
}

export function usePayments(mode: "employee" | "admin", query: AdminPaymentQuery = EMPTY_QUERY) {
  const { user } = useAuth();
  const [live, setLive] = useState<PaymentSession[]>([]);
  const [payments, setPayments] = useState<PaymentSession[]>([]);
  const [earnings, setEarnings] = useState<EmployeeEarnings | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<string | undefined>();
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryKey = JSON.stringify(query);
  const fetching = useRef(false);
  const missed = useRef(false);
  const liveRef = useRef(live);
  const historyRef = useRef(payments);
  liveRef.current = live;
  historyRef.current = payments;

  const reload = useCallback(async () => {
    fetching.current = true;
    missed.current = false;
    try {
      if (mode === "admin") {
        const result = await paymentApi.listAdmin(query);
        setPayments((current) =>
          query.scope === "active" ? mergeLivePayments(result.payments, current, missed.current) : result.payments,
        );
        setTotal(result.total ?? result.payments.length);
        setHasMore(result.hasMore ?? false);
        return;
      }
      const result = await paymentApi.listMine(query);
      setLive((current) => mergeLivePayments(result.live ?? [], current, missed.current));
      setPayments(result.payments);
        setEarnings(result.earnings);
        setCooldownUntil(result.cooldownUntil);
      setTotal(result.total ?? result.payments.length);
      setHasMore(result.hasMore ?? false);
    } finally {
      fetching.current = false;
    }
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

  usePaymentEvents(
    (event) => {
      if (!user) return;
      if (event.type === "pause-cleared") {
        if (user.role === "EMPLOYEE" && event.data.employeeId === user.id) {
          setCooldownUntil(undefined);
          void reload();
        }
        return;
      }
      if (event.type === "payout-updated") {
        if (user.role === "EMPLOYEE" && event.data.employeeId === user.id) {
          setEarnings((current) =>
            current
              ? { ...current, paidInr: event.data.paidInr, unpaidInr: event.data.unpaidInr, earnedInr: event.data.earnedInr }
              : current,
          );
        }
        return;
      }
      if (fetching.current) missed.current = true;
      if (mode === "admin") {
        setPayments((current) => applyPaymentEvent(current, event, user));
        return;
      }
      const previous =
        liveRef.current.find((item) => event.type === "payment-status" && item.id === event.data.paymentSessionId) ??
        historyRef.current.find((item) => event.type === "payment-status" && item.id === event.data.paymentSessionId);
      const firstPage = (query.offset ?? 0) === 0 && !query.q;
      setLive((current) => applyPaymentEvent(current, event, user).filter((item) => !isTerminal(item.status)));
      setPayments((current) => applyHistory(current, event, user, liveRef.current, firstPage));
      setEarnings((current) => adjustEarnings(current, previous, event));
      if (event.type === "payment-status" && isTerminal(event.data.status)) void reload();
    },
    () => {
      void reload();
    },
  );

  const reserve = useCallback(async (id: string) => {
    try {
      const result = await paymentApi.reserve(id);
      setLive((current) => current.map((item) => (item.id === result.payment.id ? result.payment : item)));
      return result.payment;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not reserve this QR";
      if (/reserved/i.test(message)) {
        setLive((current) => current.filter((item) => item.id !== id));
      }
      throw caught;
    }
  }, []);

  const cancel = useCallback(async (id: string) => {
    const result = await paymentApi.cancel(id);
    setPayments((current) => current.map((item) => (item.id === result.payment.id ? result.payment : item)));
    setLive((current) => current.filter((item) => item.id !== id));
    return result.payment;
  }, []);

  return { live, payments, earnings, cooldownUntil, total, hasMore, loading, error, reload, reserve, cancel };
}
