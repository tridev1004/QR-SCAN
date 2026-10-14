import { API_BASE_URL } from "../shared/apiBase";
import { TrackedSession } from "../shared/types";
import { SessionRegistry } from "./sessionStore";

const SESSIONS_KEY = "trackedSessions";

export async function loadTrackedSessions(): Promise<TrackedSession[]> {
  const stored = await chrome.storage.session.get(SESSIONS_KEY);
  const value = stored[SESSIONS_KEY];
  return Array.isArray(value) ? (value as TrackedSession[]) : [];
}

export async function saveTrackedSessions(registry: SessionRegistry): Promise<void> {
  await chrome.storage.session.set({ [SESSIONS_KEY]: registry.list() });
}

export async function loadApiConfig(): Promise<{ apiBaseUrl: string; token: string } | null> {
  const stored = await chrome.storage.session.get(["token"]);
  if (typeof stored.token !== "string" || !stored.token) {
    return null;
  }
  return { apiBaseUrl: API_BASE_URL, token: stored.token };
}
