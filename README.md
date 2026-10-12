# UPI QR Monitor

Internal tool for authorized Google Cloud UPI verification. A Chrome extension reads the QR on the Google Cloud tab. The API stores the payment session. The React dashboard shows it live to admins and assigned staff.

The dashboard never reads the Google Cloud page. The extension is the only bridge.

## Layout

```
backend/     Node.js API, MongoDB, SSE
frontend/    React dashboard
extension/   Chrome extension, Manifest V3
```

Google DOM selectors live in one file: `extension/src/shared/selectors.ts`.

## Local setup

Requirements: Node.js 20+, MongoDB on `mongodb://127.0.0.1:27017`.

```bash
npm install
copy backend\.env.example backend\.env
npm run dev:backend
npm run dev:frontend
npm run build:extension
```

MongoDB only, with Docker:

```bash
docker compose up -d
```

Dashboard: http://localhost:5173

API: http://localhost:4000

Dev accounts, created on first start when `SEED_ON_START=true`:

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@company.local | admin123 |
| Employee | rahul@company.local | employee123 |
| Employee | aman@company.local | employee123 |
| Employee | rohit@company.local | employee123 |

Change these before any shared environment. The extension must sign in as an admin. Employees use the dashboard only.

## Extension install

1. `npm run build:extension`
2. Chrome → Extensions → Developer mode → Load unpacked
3. Select the `extension` folder
4. Open the extension popup, keep the backend URL at `http://localhost:4000`, and sign in as admin
5. Open Google Cloud Console and generate the UPI QR

The extension only runs on `https://console.cloud.google.com/*`. It does not use `<all_urls>`. For a non-local API, add that origin to `host_permissions` in `extension/manifest.json` and rebuild.

## How a QR becomes a session

1. The content script watches the Google Cloud page with a debounced `MutationObserver` (about 200ms).
2. It accepts a screen only when a heading contains `Scan QR code to use UPI` and an image matches `img[alt="QR code"][src^="data:image/png;base64,"]`.
3. App icons (Amazon, GPay, Paytm, PhonePe) do not match that selector.
4. The first timer reading, such as `4:40`, becomes `expiresAt`. The dashboard counts down from that timestamp locally.
5. SHA-256 of the image is the fingerprint. A new fingerprint creates a new session. The same image does not.
6. The service worker calls `POST /api/internal/payment-sessions`, then marks the session `WAITING_FOR_PAYMENT`.
7. The mapping of fingerprint, local id, and backend id is kept in `chrome.storage.session`. The QR image itself is not stored in extension storage.

Five QRs in a row become five sessions. A newer QR does not replace an older one. Status events apply only to the fingerprint currently on screen. Older sessions stay waiting until they succeed, fail, or reach `expiresAt`.

## API

Authentication: `Authorization: Bearer <token>` from `POST /api/auth/login`.

Extension, admin only:

- `POST /api/internal/payment-sessions`
- `PATCH /api/internal/payment-sessions/:id/status`
- `POST /api/internal/payment-sessions/heartbeat`

Dashboard:

- `GET /api/payments` — sessions assigned to the signed-in user
- `GET /api/payments/:id`
- `GET /api/payments/:id/qr` — `Cache-Control: no-store, private`
- `GET /api/payments/events` — server-sent events
- `GET /api/payments/:id/events`

Admin:

- `GET /api/admin/payments?status&employeeId&from&to&scope=active|expired|all`
- `GET /api/admin/employees`
- `PATCH /api/admin/payments/:id/assign`
- `POST /api/admin/payments/:id/cancel`

Create body:

```json
{
  "localSessionId": "uuid",
  "qrFingerprint": "64-char sha256 hex",
  "qrImage": "data:image/png;base64,...",
  "expiresAt": "2026-10-01T12:04:40.000Z"
}
```

Create response:

```json
{ "paymentSessionId": "uuid", "code": "PAY-001", "status": "QR_READY" }
```

Sending the same active fingerprint again returns the existing session.

SSE events: `payment-created`, `payment-status`, `payment-assigned`. An admin receives all of them. An employee receives only events whose `assignedEmployeeId` is their own user id. The server decides that from the token, not from a query parameter.

## Permissions

Admins see every session, assign or reassign it while it is still active, and cancel it. Employees see only sessions assigned to them, including the QR and countdown. Another employee's id or session id is rejected on the server.

Allowed status flow:

`DETECTED → QR_READY → WAITING_FOR_PAYMENT → SUCCESS`

`FAILED` and `EXPIRED` are the other terminal states. A terminal session does not move again. Repeating the same terminal status is accepted and changes nothing.

## Storage

MongoDB collection `paymentsessions` stores metadata, status, assignment, fingerprint, and history. It does not store the QR image.

Collection `paymentqrcaches` holds the image until expiry or a terminal status, then deletes it. There is no Redis.

The API does not store Google cookies, tokens, or the page query string.

## Tests

```bash
npm test
```

Tests use in-memory repositories and DOM fixtures. They do not call Google or make a payment.

## Still open

Success and failure selectors are empty on purpose. Disappearance of the QR, modal, or timer is not treated as success or failure.

When a real Google result screen is available, add either a CSS selector or `text:...` to `successIndicators` or `failureIndicators` in `extension/src/shared/selectors.ts`. No other file should need a selector change.

`expiredIndicators` is also empty. Expiry is currently the captured `expiresAt`, plus a timer reading of `0:00` on the current QR. The API sweep is the source of truth and marks due sessions `EXPIRED`.

Needed from the Google success and failure screens:

- the visible heading or message text
- a stable element role, aria attribute, or alt text
- whether that element is present only after success, only after failure, or both
- one sample of the surrounding markup with generated ids and classes removed
