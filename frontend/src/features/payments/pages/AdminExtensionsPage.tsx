import { useEffect, useState } from "react";
import { DateField } from "@/components/DateField";
import { Button } from "@/components/ui/button";
import { paymentApi } from "../api/paymentApi";
import { formatInr } from "../state/money";

interface ExtensionRow {
  id: string;
  name: string;
  email: string;
  active: boolean;
  successRewardInr: number;
  passedCount: number;
  failedCount: number;
  earnedInr: number;
  paidInr: number;
  unpaidInr: number;
}

export function AdminExtensionsPage() {
  const [from, setFrom] = useState(() => istDate(0));
  const [to, setTo] = useState(() => istDate(0));
  const [rows, setRows] = useState<ExtensionRow[] | null>(null);
  const [totals, setTotals] = useState({ passedCount: 0, failedCount: 0, earnedInr: 0, paidInr: 0, unpaidInr: 0 });
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!from || !to || from > to) {
      setError("Choose a valid date range.");
      return;
    }
    let cancelled = false;
    paymentApi
      .extensionUsers({ from, to })
      .then((result) => {
        if (cancelled) return;
        setRows(result.users);
        setTotals({
          passedCount: result.passedCount,
          failedCount: result.failedCount,
          earnedInr: result.earnedInr,
          paidInr: result.paidInr,
          unpaidInr: result.unpaidInr,
        });
        setError("");
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load extension users");
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, revision]);

  async function markPaid(row: ExtensionRow) {
    setBusyId(row.id);
    setError("");
    try {
      await paymentApi.markExtensionUserPaid(row.id, { from, to });
      setRevision((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not mark this extension user paid");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Extensions</h1>
          <p className="muted">Passed and failed QRs each extension account finished in the selected India-time range. Amount is passed count times their rate. Paid is what you marked paid in that range.</p>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <DateField label="From" value={from} onChange={setFrom} />
        <DateField label="To" value={to} onChange={setTo} />
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {rows ? (
        <>
          <div className="stat-row">
            <article className="stat-card">
              <p className="eyebrow">Passed</p>
              <strong>{totals.passedCount}</strong>
            </article>
            <article className="stat-card">
              <p className="eyebrow">Failed</p>
              <strong>{totals.failedCount}</strong>
            </article>
            <article className="stat-card">
              <p className="eyebrow">Amount</p>
              <strong>{formatInr(totals.earnedInr)}</strong>
            </article>
            <article className="stat-card">
              <p className="eyebrow">Paid</p>
              <strong>{formatInr(totals.paidInr)}</strong>
            </article>
            <article className="stat-card">
              <p className="eyebrow">Unpaid</p>
              <strong>{formatInr(totals.unpaidInr)}</strong>
            </article>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Extension user</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Passed</th>
                  <th className="px-3 py-2 font-medium">Failed</th>
                  <th className="px-3 py-2 font-medium">Rate</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Paid</th>
                  <th className="px-3 py-2 font-medium">Unpaid</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-muted-foreground" colSpan={9}>
                      No extension users yet. Create one from New employee.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-muted-foreground">{row.email}</div>
                      </td>
                      <td className="px-3 py-2">{row.active ? "Active" : "Inactive"}</td>
                      <td className="px-3 py-2">{row.passedCount}</td>
                      <td className="px-3 py-2">{row.failedCount}</td>
                      <td className="px-3 py-2">{formatInr(row.successRewardInr)}</td>
                      <td className="px-3 py-2">{formatInr(row.earnedInr)}</td>
                      <td className="px-3 py-2">{formatInr(row.paidInr)}</td>
                      <td className="px-3 py-2">{formatInr(row.unpaidInr)}</td>
                      <td className="px-3 py-2">
                        <Button type="button" size="sm" disabled={row.unpaidInr <= 0 || busyId === row.id} onClick={() => void markPaid(row)}>
                          Mark paid {formatInr(row.unpaidInr)}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : error ? null : (
        <p>Loading extension users…</p>
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
