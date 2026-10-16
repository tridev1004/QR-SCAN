import { useEffect, useState } from "react";
import { paymentApi } from "../api/paymentApi";
import { formatInr } from "../state/money";

interface Statistics {
  from: string;
  to: string;
  passed: number;
  failed: number;
  expired: number;
  paidInr: number;
  unpaidInr: number;
}

export function AdminStatisticsPage() {
  const [from, setFrom] = useState(() => istDate(-29));
  const [to, setTo] = useState(() => istDate(0));
  const [stats, setStats] = useState<Statistics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!from || !to || from > to) {
      setError("Choose a valid date range.");
      return;
    }
    let cancelled = false;
    paymentApi
      .statistics({ from, to })
      .then((result) => {
        if (!cancelled) {
          setStats(result);
          setError("");
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load statistics");
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Statistics</h1>
          <p className="muted">Dates use India time. Paid is money marked paid in the range. Unpaid is earnings from passed QRs in the range minus that paid amount.</p>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm text-muted-foreground">
          From
          <input
            className="h-9 rounded-lg border border-input bg-background px-2 text-foreground"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm text-muted-foreground">
          To
          <input
            className="h-9 rounded-lg border border-input bg-background px-2 text-foreground"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {stats ? (
        <div className="stat-row">
          <article className="stat-card">
            <p className="eyebrow">Passed</p>
            <strong>{stats.passed}</strong>
          </article>
          <article className="stat-card">
            <p className="eyebrow">Failed</p>
            <strong>{stats.failed}</strong>
          </article>
          <article className="stat-card">
            <p className="eyebrow">Expired</p>
            <strong>{stats.expired}</strong>
          </article>
          <article className="stat-card">
            <p className="eyebrow">Paid</p>
            <strong>{formatInr(stats.paidInr)}</strong>
          </article>
          <article className="stat-card">
            <p className="eyebrow">Unpaid</p>
            <strong>{formatInr(stats.unpaidInr)}</strong>
          </article>
        </div>
      ) : error ? null : (
        <p>Loading statistics…</p>
      )}
    </section>
  );
}

function istDate(offsetDays: number): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const start = new Date(`${today}T00:00:00+05:30`).getTime() + offsetDays * 24 * 60 * 60 * 1000;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(start));
}
