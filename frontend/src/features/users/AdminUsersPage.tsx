import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { paymentApi } from "../payments/api/paymentApi";
import { formatInr } from "../payments/state/money";
import { Employee } from "../payments/types/payment.types";

const PAGE_SIZE = 8;

export function AdminUsersPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [rewardDrafts, setRewardDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPrice, setBulkPrice] = useState("40");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const qRef = useRef("");
  const { rosterVersion } = useOutletContext<{ rosterVersion: number }>();
  const seenRoster = useRef(rosterVersion);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const nextOffset = useRef(0);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);
  hasMoreRef.current = hasMore;

  async function loadFirst(query = qRef.current) {
    const page = await paymentApi.listEmployees({ limit: PAGE_SIZE, offset: 0, q: query || undefined });
    setEmployees(sortEmployees(page.employees));
    setTotal(page.total ?? page.employees.length);
    setActiveCount(page.activeCount ?? page.employees.filter((employee) => employee.active).length);
    setHasMore(page.hasMore ?? false);
    nextOffset.current = page.employees.length;
  }

  async function loadMore() {
    if (loadingMoreRef.current || !hasMoreRef.current) {
      return;
    }
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await paymentApi.listEmployees({
        limit: PAGE_SIZE,
        offset: nextOffset.current,
        q: qRef.current || undefined,
      });
      setEmployees((current) => {
        const seen = new Set(current.map((employee) => employee.id));
        return sortEmployees([...current, ...page.employees.filter((employee) => !seen.has(employee.id))]);
      });
      setTotal(page.total ?? 0);
      setActiveCount(page.activeCount ?? 0);
      setHasMore(page.hasMore ?? false);
      nextOffset.current += page.employees.length;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load more employees");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    qRef.current = q;
    let cancelled = false;
    loadFirst(q)
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load accounts");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  useEffect(() => {
    if (seenRoster.current === rosterVersion) {
      return;
    }
    seenRoster.current = rosterVersion;
    loadFirst()
      .then(() => setNotice("Employee created"))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Unable to load accounts");
      });
  }, [rosterVersion]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreRef.current();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, employees.length]);

  function patchEmployee(id: string, patch: Partial<Employee>) {
    setEmployees((current) => current.map((employee) => (employee.id === id ? { ...employee, ...patch } : employee)));
  }

  async function saveReward(employee: Employee) {
    const raw = (rewardDrafts[employee.id] ?? String(employee.successRewardInr ?? 0)).trim();
    if (!/^\d+$/.test(raw)) {
      setNotice(null);
      setError("Enter a whole rupee amount");
      return;
    }
    setError(null);
    setNotice(null);
    try {
      const successRewardInr = Number(raw);
      await paymentApi.setEmployeeReward(employee.id, successRewardInr);
      patchEmployee(employee.id, { successRewardInr });
      setNotice(`Passed QR pay is ${formatInr(successRewardInr)} for ${employee.name}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the payout");
    }
  }

  async function changePassword(employee: Employee) {
    const nextPassword = (passwordDrafts[employee.id] ?? "").trim();
    if (nextPassword.length < 6) {
      setNotice(null);
      setError("Password must be at least 6 characters");
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await paymentApi.setEmployeePassword(employee.id, nextPassword);
      setPasswordDrafts((current) => ({ ...current, [employee.id]: "" }));
      setNotice(`Password updated for ${employee.name}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change the password");
    }
  }

  async function remove(employee: Employee) {
    if (!window.confirm(`Delete ${employee.name}? They will no longer be able to sign in.`)) {
      return;
    }
    setError(null);
    try {
      await paymentApi.deleteEmployee(employee.id);
      setEmployees((current) => current.filter((item) => item.id !== employee.id));
      setTotal((current) => Math.max(0, current - 1));
      if (employee.active) {
        setActiveCount((current) => Math.max(0, current - 1));
      }
      nextOffset.current = Math.max(0, nextOffset.current - 1);
      setNotice(`${employee.name} deleted`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the account");
    }
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function parseBulkPrice(): number | null {
    const raw = bulkPrice.trim();
    if (!/^\d+$/.test(raw)) {
      setNotice(null);
      setError("Enter a whole rupee amount");
      return null;
    }
    return Number(raw);
  }

  async function applyPrice(all: boolean) {
    const successRewardInr = parseBulkPrice();
    if (successRewardInr === null) return;
    const employeeIds = [...selected];
    if (!all && employeeIds.length === 0) {
      setError("Select at least one employee");
      return;
    }
    const label = all ? "every employee" : `${employeeIds.length} selected`;
    if (!window.confirm(`Set ${formatInr(successRewardInr)} per passed QR for ${label}?`)) return;
    setBulkBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await paymentApi.setEmployeeRewards({ successRewardInr, all, employeeIds });
      setRewardDrafts({});
      setNotice(`Passed QR pay is ${formatInr(successRewardInr)} for ${result.updated} employees`);
      await loadFirst();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the payout");
    } finally {
      setBulkBusy(false);
    }
  }

  async function deleteSelected() {
    const employeeIds = [...selected];
    if (employeeIds.length === 0) return;
    if (!window.confirm(`Delete ${employeeIds.length} selected employees? They will no longer be able to sign in.`)) return;
    setBulkBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await paymentApi.deleteEmployees({ employeeIds });
      setSelected(new Set());
      setNotice(`${result.deleted} employees deleted`);
      await loadFirst();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the accounts");
    } finally {
      setBulkBusy(false);
    }
  }

  async function deleteInactive() {
    if (!window.confirm("Delete every inactive employee? Active accounts stay.")) return;
    setBulkBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await paymentApi.deleteEmployees({ inactive: true });
      setSelected(new Set());
      setNotice(result.deleted === 0 ? "No inactive employees to delete" : `${result.deleted} inactive employees deleted`);
      await loadFirst();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete inactive accounts");
    } finally {
      setBulkBusy(false);
    }
  }

  async function clearPause(employee: Employee) {
    setError(null);
    setNotice(null);
    try {
      await paymentApi.clearEmployeePause(employee.id);
      patchEmployee(employee.id, { cooldownUntil: undefined });
      setNotice(`${employee.name} can receive QRs again`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove the pause");
    }
  }

  async function toggle(employee: Employee) {
    setError(null);
    try {
      const nextActive = !employee.active;
      await paymentApi.setEmployeeActive(employee.id, nextActive);
      patchEmployee(employee.id, { active: nextActive });
      setActiveCount((current) => Math.max(0, current + (nextActive ? 1 : -1)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the account");
    }
  }

  return (
    <div className="admin-panel">
      <div className="page-heading">
        <p className="eyebrow">Employees</p>
        <h1>Accounts</h1>
        <p className="muted">Names stay in alphabetical order. Add an account from New employee.</p>
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
      <div>
      <label className="mb-3 grid max-w-xs gap-1 text-sm text-muted-foreground">
        Search
        <input
          className="h-8 rounded-lg border border-input bg-background px-2 text-foreground"
          value={search}
          placeholder="Name or email"
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <p className="muted employee-summary">
        {activeCount} active of {total} {total === 1 ? "employee" : "employees"} can receive a QR.
      </p>
      {notice ? <p className="muted">{notice}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p>Loading employees…</p> : null}
      {!loading && employees.length === 0 ? <p className="muted">No employees yet.</p> : null}
      <div className="employee-list">
        {employees.map((employee) => (
          <article className="panel employee-card" key={employee.id}>
            <header>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-primary"
                  checked={selected.has(employee.id)}
                  aria-label={`Select ${employee.name}`}
                  onChange={() => toggleSelected(employee.id)}
                />
                <div>
                  <h2>{employee.name}</h2>
                  <p className="muted">{employee.email}</p>
                </div>
              </div>
              <span className={employee.active && !isPaused(employee) ? "pill pill-on" : "pill"}>{accountStatus(employee)}</span>
            </header>
            <div className="employee-actions">
              <form
                className="row-actions"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveReward(employee);
                }}
              >
                <label>
                  ₹ per passed QR
                  <input
                    className="reward-input"
                    inputMode="numeric"
                    aria-label={`Rupees per passed QR for ${employee.name}`}
                    value={rewardDrafts[employee.id] ?? String(employee.successRewardInr ?? 0)}
                    onChange={(event) =>
                      setRewardDrafts((current) => ({ ...current, [employee.id]: event.target.value }))
                    }
                  />
                </label>
                <button type="submit" className="secondary">
                  Save pay
                </button>
              </form>
              <form
                className="row-actions"
                onSubmit={(event) => {
                  event.preventDefault();
                  void changePassword(employee);
                }}
              >
                <label>
                  New password
                  <input
                    type="password"
                    minLength={6}
                    placeholder="At least 6 characters"
                    aria-label={`New password for ${employee.name}`}
                    autoComplete="new-password"
                    value={passwordDrafts[employee.id] ?? ""}
                    onChange={(event) =>
                      setPasswordDrafts((current) => ({ ...current, [employee.id]: event.target.value }))
                    }
                  />
                </label>
                <button type="submit" className="secondary">
                  Save password
                </button>
              </form>
              <div className="row-actions">
                {isPaused(employee) ? (
                  <button type="button" className="secondary" onClick={() => void clearPause(employee)}>
                    Remove pause
                  </button>
                ) : null}
                <button type="button" className="secondary" onClick={() => void toggle(employee)}>
                  {employee.active ? "Mark inactive" : "Mark active"}
                </button>
                <button type="button" className="danger" onClick={() => void remove(employee)}>
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {hasMore ? (
        <div ref={sentinelRef} className="scroll-sentinel">
          {loadingMore ? "Loading more employees…" : ""}
        </div>
      ) : null}
      </div>
      <aside className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="text-sm font-medium text-foreground">Payout</h2>
          <p className="text-xs text-muted-foreground">Set the same amount for the people you select, or for every employee.</p>
        </div>
        <label className="grid gap-1 text-sm text-muted-foreground">
          ₹ per passed QR
          <input
            className="h-8 w-28 rounded-lg border border-input bg-background px-2 text-foreground"
            inputMode="numeric"
            value={bulkPrice}
            onChange={(event) => setBulkPrice(event.target.value)}
          />
        </label>
        <Button type="button" disabled={bulkBusy || selected.size === 0} onClick={() => void applyPrice(false)}>
          Apply to selected ({selected.size})
        </Button>
        <Button type="button" variant="secondary" disabled={bulkBusy} onClick={() => void applyPrice(true)}>
          Apply to all
        </Button>
        <Button type="button" variant="destructive" disabled={bulkBusy || selected.size === 0} onClick={() => void deleteSelected()}>
          Delete selected
        </Button>
        <Button type="button" variant="outline" disabled={bulkBusy} onClick={() => void deleteInactive()}>
          Delete all inactive
        </Button>
      </aside>
      </div>
    </div>
  );
}

function sortEmployees(employees: Employee[]): Employee[] {
  return [...employees].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

function isPaused(employee: Employee): boolean {
  return Boolean(employee.cooldownUntil && Date.parse(employee.cooldownUntil) > Date.now());
}

function accountStatus(employee: Employee): string {
  if (!employee.active) return "Inactive";
  if (isPaused(employee)) return "Paused";
  return "Active";
}
