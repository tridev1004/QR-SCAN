export interface ScanReport {
  frameUrl: string;
  heading: boolean;
  image: boolean;
  timer: string | null;
}

export type ExtensionMessage =
  | {
      type: "SCAN_STATUS";
      payload: ScanReport;
    }
  | {
      type: "QR_OBSERVED";
      payload: {
        qrFingerprint: string;
        qrImage: string;
        expiresAt: string;
        sourceUrl: string;
      };
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
  | { ok: true; backendPaymentSessionId?: string; pending?: boolean }
  | { ok: false; error: string };
