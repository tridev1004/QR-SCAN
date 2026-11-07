import { useEffect, useState } from "react";
import { EmployeeEarningsRow, EmployeeHistoryBoard } from "../components/EmployeeQrBoard";
import { ListPager } from "../components/ListPager";
import { usePayments } from "../hooks/usePayments";

const PAGE_SIZE = 8;

export function EmployeeHistoryPage() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const { payments, earnings, total, hasMore, loading, error } = usePayments("employee", {
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
    <section className="emp-dash">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Past work</p>
          <h1>QR history</h1>
          <p className="muted">Passed, failed, and expired scans. Search by session code.</p>
        </div>
      </div>

      {earnings ? <EmployeeEarningsRow earnings={earnings} /> : null}

      <label className="emp-search">
        Search by session code
        <input
          value={search}
          placeholder="e.g. PAY-001"
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}
      {loading && payments.length === 0 ? <p>Loading history…</p> : null}

      {earnings ? (
        <EmployeeHistoryBoard history={payments} successRewardInr={earnings.successRewardInr} />
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
