import { useEffect, useState } from "react";
import { EmployeeQrBoard } from "../components/EmployeeQrBoard";
import { isTerminal } from "../types/payment.types";
import { ListPager } from "../components/ListPager";
import { usePayments } from "../hooks/usePayments";

const PAGE_SIZE = 8;

export function EmployeePaymentsPage() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const { live, payments, earnings, cooldownUntil, total, hasMore, loading, error, reserve } = usePayments("employee", {
    limit: PAGE_SIZE,
    offset,
    q: q || undefined,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOffset(0);
      setQ(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Employee</p>
          <h1>Your QRs</h1>
          <p className="muted">New QRs show up here as soon as they are sent. Earnings count every passed QR.</p>
        </div>
      </div>
      {cooldownUntil ? (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Your account is paused until {new Date(cooldownUntil).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} after two failed or expired QRs in a row. You will not receive new QRs until then.
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      {earnings || live.length > 0 ? (
        <EmployeeQrBoard
          live={cooldownUntil ? live.filter((payment) => Boolean(payment.assignedEmployeeId)) : live}
          history={payments}
          earnings={
            earnings ?? { successRewardInr: 0, passedCount: 0, failedCount: 0, earnedInr: 0 }
          }
          onReserve={reserve}
          reserveLocked={live.filter((payment) => payment.assignedEmployeeId && !isTerminal(payment.status)).length >= 2}
          historyControls={
            <label className="mt-4 grid max-w-xs gap-1 text-sm text-muted-foreground">
              Search past QRs
              <input
                className="h-8 rounded-lg border border-input bg-background px-2 text-foreground"
                value={search}
                placeholder="Session code"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          }
        />
      ) : loading ? (
        <p>Loading QR codes…</p>
      ) : null}
      {earnings ? (
      <ListPager
        offset={offset}
        count={payments.length}
        total={total}
        hasMore={hasMore}
        onPrevious={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
        onNext={() => setOffset((current) => current + PAGE_SIZE)}
      />
      ) : null}
    </section>
  );
}
