import { api } from "../../../api/client";
import { Employee, EmployeeEarnings, PaymentSession, PaymentStatus } from "../types/payment.types";

export interface AdminPaymentQuery {
  status?: PaymentStatus;
  employeeId?: string;
  scope?: "active" | "expired" | "all";
}

export const paymentApi = {
  listMine(): Promise<{ payments: PaymentSession[]; earnings: EmployeeEarnings }> {
    return api("/api/payments");
  },
  listAdmin(query: AdminPaymentQuery = {}): Promise<{ payments: PaymentSession[] }> {
    const params = new URLSearchParams();
    if (query.status) params.set("status", query.status);
    if (query.employeeId) params.set("employeeId", query.employeeId);
    if (query.scope) params.set("scope", query.scope);
    const suffix = params.size ? `?${params.toString()}` : "";
    return api(`/api/admin/payments${suffix}`);
  },
  listEmployees(page?: { limit: number; offset: number }): Promise<{
    employees: Employee[];
    total?: number;
    activeCount?: number;
    hasMore?: boolean;
  }> {
    if (!page) {
      return api("/api/admin/employees");
    }
    const params = new URLSearchParams({ limit: String(page.limit), offset: String(page.offset) });
    return api(`/api/admin/employees?${params.toString()}`);
  },
  createEmployee(input: { name: string; email: string; password: string }): Promise<{ employee: Employee }> {
    return api("/api/admin/employees", { method: "POST", body: JSON.stringify(input) });
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
