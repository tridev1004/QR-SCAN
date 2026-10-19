import { api } from "../../../api/client";
import { BroadcastNotice, Employee, EmployeeEarnings, PaymentSession, PaymentStatus, PayoutReport } from "../types/payment.types";

export interface AdminPaymentQuery {
  status?: PaymentStatus;
  employeeId?: string;
  scope?: "active" | "expired" | "finished" | "all";
  limit?: number;
  offset?: number;
  q?: string;
}

export interface PaymentPage {
  payments: PaymentSession[];
  total: number;
  hasMore: boolean;
}

export interface EmployeePaymentPage extends PaymentPage {
  live: PaymentSession[];
  earnings: EmployeeEarnings;
  cooldownUntil?: string;
}

function paymentQuery(query: AdminPaymentQuery): string {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.employeeId) params.set("employeeId", query.employeeId);
  if (query.scope) params.set("scope", query.scope);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  if (query.q) params.set("q", query.q);
  const suffix = params.size ? `?${params.toString()}` : "";
  return suffix;
}

export const paymentApi = {
  listMine(query: Pick<AdminPaymentQuery, "limit" | "offset" | "q"> = {}): Promise<EmployeePaymentPage> {
    return api(`/api/payments${paymentQuery(query)}`);
  },
  listAdmin(query: AdminPaymentQuery = {}): Promise<PaymentPage> {
    return api(`/api/admin/payments${paymentQuery(query)}`);
  },
  listEmployees(page?: { limit: number; offset: number; q?: string }): Promise<{
    employees: Employee[];
    total?: number;
    activeCount?: number;
    hasMore?: boolean;
  }> {
    if (!page) {
      return api("/api/admin/employees");
    }
    const params = new URLSearchParams({ limit: String(page.limit), offset: String(page.offset) });
    if (page.q) params.set("q", page.q);
    return api(`/api/admin/employees?${params.toString()}`);
  },
  payoutReport(page: { limit: number; offset: number; q?: string; unpaid?: boolean }): Promise<PayoutReport> {
    const params = new URLSearchParams({ limit: String(page.limit), offset: String(page.offset) });
    if (page.q) params.set("q", page.q);
    if (page.unpaid) params.set("unpaid", "1");
    return api(`/api/admin/payouts?${params.toString()}`);
  },
  employeePayoutQr(id: string): Promise<{ qrImage: string }> {
    return api(`/api/admin/employees/${id}/payout-qr`);
  },
  markEmployeePaid(id: string): Promise<{ employee: Employee }> {
    return api(`/api/admin/employees/${id}/paid`, { method: "POST" });
  },
  markEmployeeUnpaid(id: string): Promise<{ employee: Employee }> {
    return api(`/api/admin/employees/${id}/unpaid`, { method: "POST" });
  },
  uploadPayoutQr(qrImage: string): Promise<void> {
    return api("/api/payments/payout-qr", { method: "POST", body: JSON.stringify({ qrImage }) });
  },
  ownPayout(): Promise<{ qrImage: string | null; upiId: string }> {
    return api("/api/payments/payout");
  },
  saveUpiId(upiId: string): Promise<void> {
    return api("/api/payments/payout-upi", { method: "POST", body: JSON.stringify({ upiId }) });
  },
  ownPayoutQr(): Promise<{ qrImage: string }> {
    return api("/api/payments/payout-qr");
  },
  broadcasts(): Promise<{ broadcasts: BroadcastNotice[] }> {
    return api("/api/payments/broadcasts");
  },
  sendBroadcast(input: { message: string; durationMinutes: number }): Promise<{ broadcast: BroadcastNotice }> {
    return api("/api/admin/broadcasts", { method: "POST", body: JSON.stringify(input) });
  },
  stopBroadcast(id: string): Promise<void> {
    return api(`/api/admin/broadcasts/${id}`, { method: "DELETE" });
  },
  statistics(range: { from: string; to: string }): Promise<{
    from: string;
    to: string;
    passed: number;
    failed: number;
    expired: number;
    paidInr: number;
    unpaidInr: number;
  }> {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    return api(`/api/admin/statistics?${params.toString()}`);
  },
  extensionUsers(range: { from: string; to: string }): Promise<{
    passedCount: number;
    failedCount: number;
    earnedInr: number;
    paidInr: number;
    unpaidInr: number;
    users: Array<{
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
    }>;
  }> {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    return api(`/api/admin/extension-users?${params.toString()}`);
  },
  markExtensionUserPaid(id: string, range: { from: string; to: string }): Promise<{ paidInr: number }> {
    return api(`/api/admin/extension-users/${id}/paid`, { method: "POST", body: JSON.stringify(range) });
  },
  createEmployee(input: { name: string; email: string; password: string; role: "EMPLOYEE" | "EXTENSION_USER" }): Promise<{ employee: Employee }> {
    return api("/api/admin/employees", { method: "POST", body: JSON.stringify(input) });
  },
  clearEmployeePause(id: string): Promise<{ employee: Employee }> {
    return api(`/api/admin/employees/${id}/resume`, { method: "POST" });
  },
  setEmployeeActive(id: string, active: boolean): Promise<{ employee: Employee }> {
    return api(`/api/admin/employees/${id}`, { method: "PATCH", body: JSON.stringify({ active }) });
  },
  setEmployeeRewards(input: {
    successRewardInr: number;
    all?: boolean;
    employeeIds?: string[];
  }): Promise<{ updated: number; successRewardInr: number }> {
    return api("/api/admin/employees/rewards", { method: "POST", body: JSON.stringify(input) });
  },
  deleteEmployees(input: { inactive?: boolean; employeeIds?: string[] }): Promise<{ deleted: number }> {
    return api("/api/admin/employees/delete", { method: "POST", body: JSON.stringify(input) });
  },
  setEmployeeReward(id: string, successRewardInr: number): Promise<{ employee: Employee }> {
    return api(`/api/admin/employees/${id}/reward`, {
      method: "PATCH",
      body: JSON.stringify({ successRewardInr }),
    });
  },
  setEmployeePassword(id: string, password: string): Promise<void> {
    return api(`/api/admin/employees/${id}/password`, { method: "PATCH", body: JSON.stringify({ password }) });
  },
  deleteEmployee(id: string): Promise<void> {
    return api(`/api/admin/employees/${id}`, { method: "DELETE" });
  },
  get(id: string): Promise<{ payment: PaymentSession }> {
    return api(`/api/payments/${id}`);
  },
  async getQr(id: string): Promise<string | null> {
    try {
      const result = await api<{ qrImage: string }>(`/api/payments/${id}/qr`);
      return result.qrImage;
    } catch (error) {
      if (error instanceof Error && error.message.includes("no longer available")) {
        return null;
      }
      throw error;
    }
  },
  reserve(id: string): Promise<{ payment: PaymentSession }> {
    return api(`/api/payments/${id}/reserve`, { method: "POST" });
  },
  assign(id: string, employeeId: string): Promise<{ payment: PaymentSession }> {
    return api(`/api/admin/payments/${id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ employeeId }),
    });
  },
  cancel(id: string): Promise<{ payment: PaymentSession }> {
    return api(`/api/admin/payments/${id}/cancel`, { method: "POST" });
  },
};
