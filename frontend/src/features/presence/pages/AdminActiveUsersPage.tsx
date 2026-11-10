import { useCallback, useEffect, useState } from "react";
import { api } from "../../../api/client";

interface ActiveUser {
  userId: string;
  name: string;
  email: string;
  role: string;
  lastSeenAt: string;
  connected: boolean;
}

interface PresenceResponse {
  employeeCount: number;
  totalCount: number;
  users: ActiveUser[];
}

export function AdminActiveUsersPage() {
  const [data, setData] = useState<PresenceResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const result = await api<PresenceResponse>("/api/admin/presence");
      setData(result);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load active users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Active now</h1>
          <p className="muted">
            Employees currently logged in and using the site. Updates every 10 seconds. Someone counts as active if their
            dashboard is open or they sent a heartbeat in the last ~90 seconds.
          </p>
        </div>
      </div>

      <div className="stat-row mb-5">
        <article className="stat-card">
          <p className="eyebrow">Employees online</p>
          <strong>{data?.employeeCount ?? (loading ? "…" : 0)}</strong>
        </article>
        <article className="stat-card">
          <p className="eyebrow">All signed-in roles</p>
          <strong>{data?.totalCount ?? (loading ? "…" : 0)}</strong>
        </article>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {!loading && (data?.users.length ?? 0) === 0 ? (
        <p className="muted">No employees are active on the site right now.</p>
      ) : null}

      <div className="grid gap-3">
        {data?.users.map((user) => (
          <article key={user.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{user.name}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div className="text-right text-sm">
              <p className={user.connected ? "font-semibold text-emerald-700" : "text-muted-foreground"}>
                {user.connected ? "Live connection" : "Recently active"}
              </p>
              <p className="text-xs text-muted-foreground">{formatSeen(user.lastSeenAt)}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatSeen(value: string): string {
  const seen = new Date(value);
  const seconds = Math.max(0, Math.round((Date.now() - seen.getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return seen.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", second: "2-digit" });
}
