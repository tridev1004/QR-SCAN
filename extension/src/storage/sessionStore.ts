import { TrackedSession, isTerminalStatus } from "../shared/types";

export class SessionRegistry {
  private sessions: TrackedSession[] = [];

  replace(sessions: TrackedSession[]): void {
    this.sessions = [...sessions];
  }

  list(): TrackedSession[] {
    return [...this.sessions];
  }

  getByFingerprint(qrFingerprint: string): TrackedSession | undefined {
    return [...this.sessions]
      .reverse()
      .find((session) => session.qrFingerprint === qrFingerprint && !isTerminalStatus(session.status));
  }

  add(session: TrackedSession): void {
    if (this.getByFingerprint(session.qrFingerprint)) {
      return;
    }
    this.sessions.push(session);
  }

  updateStatus(backendPaymentSessionId: string, status: TrackedSession["status"]): void {
    this.sessions = this.sessions.map((session) =>
      session.backendPaymentSessionId === backendPaymentSessionId ? { ...session, status } : session,
    );
  }

  activeIds(): string[] {
    return this.sessions
      .filter((session) => !isTerminalStatus(session.status))
      .map((session) => session.backendPaymentSessionId);
  }
}
