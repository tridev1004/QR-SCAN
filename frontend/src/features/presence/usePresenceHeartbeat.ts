import { useEffect } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

const HEARTBEAT_MS = 30_000;

export function usePresenceHeartbeat(enabled: boolean) {
  const { token } = useAuth();

  useEffect(() => {
    if (!enabled || !token) {
      return;
    }

    let cancelled = false;

    async function ping() {
      try {
        await api("/api/presence/heartbeat", { method: "POST" });
      } catch {
        // Ignore — offline or expired session; auth layer handles 401.
      }
    }

    void ping();
    const timer = window.setInterval(() => {
      if (!cancelled) {
        void ping();
      }
    }, HEARTBEAT_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void ping();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, token]);
}
