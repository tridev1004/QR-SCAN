import { useEffect, useState } from "react";
import { paymentApi } from "../api/paymentApi";
import { BroadcastNotice } from "../types/payment.types";
import { usePaymentEvents } from "./usePaymentEvents";

export function useBroadcasts() {
  const [broadcasts, setBroadcasts] = useState<BroadcastNotice[]>([]);

  useEffect(() => {
    let cancelled = false;
    paymentApi
      .broadcasts()
      .then((result) => {
        if (!cancelled) setBroadcasts(result.broadcasts.filter(isCurrent));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBroadcasts((current) => current.filter(isCurrent));
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  usePaymentEvents(
    (event) => {
      if (event.type !== "broadcast") return;
      setBroadcasts((current) => {
        const rest = current.filter((item) => item.id !== event.data.id);
        if (!event.data.active || !isCurrent(event.data)) return rest;
        return [{ id: event.data.id, message: event.data.message, createdAt: event.data.createdAt, expiresAt: event.data.expiresAt }, ...rest];
      });
    },
    () => {
      void paymentApi.broadcasts().then((result) => setBroadcasts(result.broadcasts.filter(isCurrent))).catch(() => undefined);
    },
  );

  return broadcasts;
}

function isCurrent(notice: Pick<BroadcastNotice, "expiresAt">): boolean {
  return Date.parse(notice.expiresAt) > Date.now();
}
