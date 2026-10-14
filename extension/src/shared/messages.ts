export interface ScanReport {
  frameUrl: string;
  heading: boolean;
  image: boolean;
  timer: string | null;
}

export interface HeldQr {
  qrFingerprint: string;
  qrImage: string;
  expiresAt: string;
}

export type ExtensionMessage =
  | {
      type: "SCAN_STATUS";
      payload: ScanReport;
    }
  | {
      type: "QR_OBSERVED";
      payload: HeldQr & { sourceUrl: string };
    }
  | {
      type: "SEND_QR";
      payload?: HeldQr;
    }
  | {
      type: "PAGE_STATUS";
      payload: {
        qrFingerprint: string;
        success: boolean;
        failure: boolean;
        expired: boolean;
      };
    };

export type WorkerResponse =
  | {
      ok: true;
      backendPaymentSessionId?: string;
      pending?: boolean;
      held?: boolean;
      broadcast?: boolean;
      alreadySent?: boolean;
    }
  | { ok: false; error: string };
