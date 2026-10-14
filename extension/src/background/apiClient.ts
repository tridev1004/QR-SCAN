export interface ApiConfig {
  apiBaseUrl: string;
  token: string;
}

export interface CreatedPayment {
  paymentSessionId: string;
  status: string;
  code?: string;
}

export function createApiClient(fetchImpl: typeof fetch = fetch) {
  async function request<T>(config: ApiConfig, path: string, init: RequestInit): Promise<T> {
    const response = await fetchImpl(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
    });
    if (response.status === 204) {
      return undefined as T;
    }
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      throw new Error(body.error ?? "Backend request failed");
    }
    return body as T;
  }

  return {
    listActiveEmployees(config: ApiConfig) {
      return request<{ employees: Array<{ id: string; name: string; email: string; active: boolean }> }>(
        config,
        "/api/admin/employees",
        { method: "GET" },
      ).then((body) => body.employees.filter((employee) => employee.active));
    },
    createPaymentSession(
      config: ApiConfig,
      body: {
        localSessionId: string;
        assignedEmployeeId?: string;
        broadcast?: boolean;
        qrFingerprint: string;
        qrImage: string;
        expiresAt: string;
      },
    ) {
      return request<CreatedPayment>(config, "/api/internal/payment-sessions", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    updatePaymentStatus(config: ApiConfig, paymentSessionId: string, status: string) {
      return request<{ paymentSessionId: string; status: string }>(
        config,
        `/api/internal/payment-sessions/${paymentSessionId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );
    },
    heartbeat(config: ApiConfig, paymentSessionIds: string[]) {
      return request<void>(config, "/api/internal/payment-sessions/heartbeat", {
        method: "POST",
        body: JSON.stringify({ paymentSessionIds }),
      });
    },
  };
}
