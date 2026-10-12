import { useEffect, useState } from "react";
import { isTerminal, PaymentStatus } from "../types/payment.types";
import { paymentApi } from "../api/paymentApi";

export function useQrImage(paymentSessionId: string, status: PaymentStatus): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (isTerminal(status)) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    paymentApi
      .getQr(paymentSessionId)
      .then((image) => {
        if (!cancelled) setSrc(image);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [paymentSessionId, status]);

  return src;
}
