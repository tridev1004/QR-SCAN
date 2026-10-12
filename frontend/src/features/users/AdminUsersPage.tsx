import { FormEvent, useEffect, useRef, useState } from "react";
import { paymentApi } from "../payments/api/paymentApi";
import { formatInr } from "../payments/state/money";
import { Employee } from "../payments/types/payment.types";

const PAGE_SIZE = 8;

export function AdminUsersPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [rewardDrafts, setRewardDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const nextOffset = useRef(0);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);
  hasMoreRef.current = hasMore;

  async function loadFirst() {
    const page = await paymentApi.listEmployees({ limit: PAGE_SIZE, offset: 0 });
    setEmployees(page.employees);
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
      const page = await paymentApi.listEmployees({ limit: PAGE_SIZE, offset: nextOffset.current });
      setEmployees((current) => {
        const seen = new Set(current.map((employee) => employee.id));
        return [...current, ...page.employees.filter((employee) => !seen.has(employee.id))];
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
    let cancelled = false;
    loadFirst()
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
  }, []);

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

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await paymentApi.createEmployee({ name, email, password });
      setName("");
      setEmail("");
      setPassword("");
      setNotice("Employee created");
      await loadFirst();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the account");
    } finally {
      setSaving(false);
    }
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
      <form className="panel create-grid" onSubmit={onCreate}>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={6} required />
        </label>
        <button type="submit" disabled={saving}>
          {saving ? "Creating…" : "Add employee"}
        </button>
      </form>
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
              <div>
                <h2>{employee.name}</h2>
                <p className="muted">{employee.email}</p>
              </div>
              <span className={employee.active ? "pill pill-on" : "pill"}>{employee.active ? "Active" : "Inactive"}</span>
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
  );
}
