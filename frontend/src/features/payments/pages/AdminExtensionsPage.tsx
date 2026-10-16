import { useEffect, useState } from "react";
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
}

export function AdminExtensionsPage() {
  const [rows, setRows] = useState<ExtensionRow[] | null>(null);
  const [totals, setTotals] = useState({ passedCount: 0, failedCount: 0, earnedInr: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    paymentApi
      .extensionUsers()
      .then((result) => {
        if (cancelled) return;
        setRows(result.users);
        setTotals({ passedCount: result.passedCount, failedCount: result.failedCount, earnedInr: result.earnedInr });
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load extension users");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Extensions</h1>
          <p className="muted">Passed QRs sent from each extension account. The amount is passed count times their rate, starting at ₹40.</p>
        </div>
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
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Extension user</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Passed</th>
                  <th className="px-3 py-2 font-medium">Failed</th>
                  <th className="px-3 py-2 font-medium">Rate</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-muted-foreground" colSpan={6}>
                      No extension users yet. Create one from New account.
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
