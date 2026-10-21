import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { PaymentCardGrid } from "../components/PaymentCardGrid";
import { PaymentTable } from "../components/PaymentTable";
import { ListPager } from "../components/ListPager";
import { usePayments } from "../hooks/usePayments";
import { paymentApi } from "../api/paymentApi";
import { isTerminal, Employee, PaymentSession } from "../types/payment.types";

const PAGE_SIZE = 8;

export function AdminPaymentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCancel = user?.role === "ADMIN";
  const { payments: livePayments, loading, error, cancel } = usePayments("admin", { scope: "active", limit: 50 });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<PaymentSession[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const live = livePayments.filter((payment) => !isTerminal(payment.status));
  const names = new Map(employees.map((employee) => [employee.id, employee.name]));
  const liveSignature = livePayments.map((payment) => `${payment.id}:${payment.status}:${payment.assignedEmployeeId ?? ""}`).join("|");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOffset(0);
      setQ(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    paymentApi
      .listEmployees()
      .then((result) => {
        if (!cancelled) setEmployees(result.employees);
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    paymentApi
      .listAdmin({ q: q || undefined, limit: PAGE_SIZE, offset })
      .then((result) => {
        if (cancelled) return;
        setRows(result.payments);
        setTotal(result.total);
        setHasMore(result.hasMore);
        setPageError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setPageError(caught instanceof Error ? caught.message : "Unable to load sessions");
      });
    return () => {
      cancelled = true;
    };
  }, [q, offset, liveSignature]);

  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">Sessions</p>
        <h1>Live QRs</h1>
        <p className="muted">New QRs and reservations show up here without a refresh.</p>
      </div>
      {loading && live.length === 0 ? <p>Loading QR codes…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {!loading && live.length === 0 ? <p className="muted">No live QR yet. Send one from the extension.</p> : null}
      <PaymentCardGrid payments={live} holderNames={names} showQr={user?.role === "ADMIN"} />
      <h2 className="section-title">All sessions</h2>
      <label className="mb-3 grid max-w-xs gap-1 text-sm text-muted-foreground">
        Search sessions
        <input
          className="h-8 rounded-lg border border-input bg-background px-2 text-foreground"
          value={search}
          placeholder="Session code"
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {pageError ? <p className="form-error">{pageError}</p> : null}
      <PaymentTable
        payments={rows}
        employees={employees}
        onOpen={(id) => navigate(`/admin/payments/${id}`)}
        onCancel={
          canCancel
            ? async (id) => {
                const payment = await cancel(id);
                setRows((current) => current.map((row) => (row.id === id ? payment : row)));
                return payment;
              }
            : undefined
        }
      />
      <ListPager
        offset={offset}
        count={rows.length}
        total={total}
        hasMore={hasMore}
        onPrevious={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
        onNext={() => setOffset((current) => current + PAGE_SIZE)}
      />
    </section>
  );
}
