import { useEffect, useState } from "react";
import { formatRemaining } from "../state/paymentEvents";

export function PaymentTimer({ expiresAt, active }: { expiresAt?: string; active: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  if (!active) {
    return <span className="timer muted">--:--</span>;
  }

  return <time className="timer">{formatRemaining(expiresAt, now)}</time>;
}
