import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { paymentApi } from "../api/paymentApi";
import { ListPager } from "../components/ListPager";
import { formatInr } from "../state/money";
import { EmployeePayoutRow, PayoutReport } from "../types/payment.types";

const PAGE_SIZE = 8;

export function AdminPayoutsPage() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [report, setReport] = useState<PayoutReport | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [qr, setQr] = useState<{ name: string; image: string | null; upiId: string } | null>(null);

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
      .payoutReport({ limit: PAGE_SIZE, offset, q: q || undefined, unpaid: unpaidOnly })
      .then((next) => {
        if (!cancelled) {
          setReport(next);
          setError("");
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load payouts");
      });
    return () => {
      cancelled = true;
    };
  }, [offset, q, unpaidOnly, revision]);

  async function clearPause(row: EmployeePayoutRow) {
    setBusyId(row.id);
    setError("");
    try {
      await paymentApi.clearEmployeePause(row.id);
      setRevision((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove the pause");
    } finally {
      setBusyId("");
    }
  }

  async function markPaid(row: EmployeePayoutRow) {
    setBusyId(row.id);
    setError("");
    try {
      await paymentApi.markEmployeePaid(row.id);
      setRevision((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not mark this employee paid");
    } finally {
      setBusyId("");
    }
  }

  async function markUnpaid(row: EmployeePayoutRow) {
    setBusyId(row.id);
    setError("");
    try {
      await paymentApi.markEmployeeUnpaid(row.id);
      setRevision((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not mark this employee unpaid");
    } finally {
      setBusyId("");
    }
  }

  async function viewPayout(row: EmployeePayoutRow) {
    setBusyId(row.id);
    setError("");
    try {
      const image = row.hasPayoutQr ? (await paymentApi.employeePayoutQr(row.id)).qrImage : null;
      setQr({ name: row.name, image, upiId: row.upiId ?? "" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open the payout details");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Payouts</h1>
          <p className="muted">Unpaid balances stay at the top. Today is counted in India time.</p>
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {report ? (
        <div className="stat-row">
          <article className="stat-card">
            <p className="eyebrow">Passed today</p>
            <strong>{report.todayPassed}</strong>
          </article>
          <article className="stat-card">
            <p className="eyebrow">Passed overall</p>
            <strong>{report.overallPassed}</strong>
          </article>
          <article className="stat-card">
            <p className="eyebrow">Amount payable</p>
            <strong>{formatInr(report.totalPayableInr)}</strong>
          </article>
        </div>
      ) : null}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="grid min-w-56 flex-1 gap-1 text-sm text-muted-foreground">
          Search employees
          <input
            className="h-8 rounded-lg border border-input bg-background px-2 text-foreground"
            value={search}
            placeholder="Name or email"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <Button
          type="button"
          size="sm"
          variant={unpaidOnly ? "default" : "outline"}
          onClick={() => {
            setUnpaidOnly((current) => !current);
            setOffset(0);
          }}
        >
          Unpaid
        </Button>
      </div>
      {report ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Employee</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Today</th>
                  <th className="px-3 py-2 font-medium">Passed</th>
                  <th className="px-3 py-2 font-medium">Earned</th>
                  <th className="px-3 py-2 font-medium">Paid</th>
                  <th className="px-3 py-2 font-medium">Unpaid</th>
                  <th className="px-3 py-2 font-medium">UPI ID</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {report.employees.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-muted-foreground" colSpan={9}>
                      No employees match this search.
                    </td>
                  </tr>
                ) : (
                  report.employees.map((row) => (
                    <tr key={row.id} className={row.unpaidInr > 0 ? "border-t border-border bg-amber-50" : "border-t border-border"}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-muted-foreground">{row.email}</div>
                      </td>
                      <td className="px-3 py-2">{activityLabel(row)}</td>
                      <td className="px-3 py-2">{row.todayPassed}</td>
                      <td className="px-3 py-2">{row.overallPassed}</td>
                      <td className="px-3 py-2">{formatInr(row.earnedInr)}</td>
                      <td className="px-3 py-2">{formatInr(row.paidInr)}</td>
                      <td className="px-3 py-2 font-medium">{formatInr(row.unpaidInr)}</td>
                      <td className="px-3 py-2">{row.upiId || "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={(!row.hasPayoutQr && !row.upiId) || busyId === row.id}
                            onClick={() => void viewPayout(row)}
                          >
                            Payout
                          </Button>
                          {row.cooldownUntil ? (
                            <Button type="button" variant="outline" size="sm" disabled={busyId === row.id} onClick={() => void clearPause(row)}>
                              Remove pause
                            </Button>
                          ) : null}
                          <Button type="button" size="sm" disabled={row.unpaidInr <= 0 || busyId === row.id} onClick={() => void markPaid(row)}>
                            Mark paid
                          </Button>
                          <Button type="button" variant="outline" size="sm" disabled={row.paidInr <= 0 || busyId === row.id} onClick={() => void markUnpaid(row)}>
                            Mark unpaid
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <ListPager
            offset={offset}
            count={report.employees.length}
            total={report.total}
            hasMore={report.hasMore}
            onPrevious={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
            onNext={() => setOffset((current) => current + PAGE_SIZE)}
          />
        </>
      ) : error ? null : (
        <p>Loading payouts…</p>
      )}
      {qr ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4" onClick={() => setQr(null)}>
          <div className="w-[min(92vw,36rem)] rounded-xl bg-card p-5" onClick={(event) => event.stopPropagation()}>
            <p className="mb-3 text-lg font-medium">{qr.name}</p>
            <p className="mb-3 text-sm text-muted-foreground">UPI ID</p>
            <p className="mb-4 break-all rounded-lg border border-border bg-background px-3 py-2 font-medium">{qr.upiId || "No UPI ID added"}</p>
            {qr.image ? (
              <img className="aspect-square w-full bg-white object-contain" alt={`${qr.name} payment QR`} src={qr.image} />
            ) : (
              <p className="text-sm text-muted-foreground">No payment QR uploaded.</p>
            )}
            <Button className="mt-3" type="button" variant="outline" onClick={() => setQr(null)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function activityLabel(row: EmployeePayoutRow): string {
  if (!row.active) return "Inactive";
  if (row.cooldownUntil) {
    return `Paused until ${new Date(row.cooldownUntil).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })}`;
  }
  return "Active";
}
