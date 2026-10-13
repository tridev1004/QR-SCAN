import { labelForScan } from "../content/scanReport";
import { injectWatcher, isWatchedUrl } from "../shared/injectWatcher";
import { ScanReport } from "../shared/messages";

const statusNode = document.querySelector<HTMLElement>("#status");
const recipientsNode = document.querySelector<HTMLElement>("#recipients");
const employeeList = document.querySelector<HTMLElement>("#employeeList");
const watchNode = document.querySelector<HTMLElement>("#watch");
const captureNode = document.querySelector<HTMLElement>("#capture");
const apiBaseUrl = document.querySelector<HTMLInputElement>("#apiBaseUrl");
const email = document.querySelector<HTMLInputElement>("#email");
const password = document.querySelector<HTMLInputElement>("#password");
const signIn = document.querySelector<HTMLButtonElement>("#signIn");
const signOut = document.querySelector<HTMLButtonElement>("#signOut");

async function refresh() {
  const stored = await chrome.storage.session.get(["apiBaseUrl", "token", "userName", "lastCapture"]);
  if (typeof stored.apiBaseUrl === "string" && apiBaseUrl) {
    apiBaseUrl.value = stored.apiBaseUrl;
  }
  if (statusNode) {
    statusNode.textContent =
      typeof stored.userName === "string" && stored.token ? `Signed in as ${stored.userName}` : "Not signed in";
  }
  if (captureNode) {
    captureNode.textContent = typeof stored.lastCapture === "string" ? stored.lastCapture : "";
  }
}

signIn?.addEventListener("click", () => {
  void (async () => {
    const base = (apiBaseUrl?.value ?? "").replace(/\/$/, "");
    const response = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email?.value ?? "", password: password?.value ?? "", portal: "admin" }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      token?: string;
      user?: { name?: string; role?: string };
    };
    if (!response.ok || !body.token || !body.user) {
      if (statusNode) statusNode.textContent = body.error ?? "Login failed";
      return;
    }
    if (body.user.role !== "ADMIN") {
      if (statusNode) statusNode.textContent = "Sign in with an admin account";
      return;
    }
    await chrome.storage.session.set({
      apiBaseUrl: base,
      token: body.token,
      userName: body.user.name ?? "Admin",
    });
    if (password) password.value = "";
    await refresh();
    await loadEmployees();
  })();
});

signOut?.addEventListener("click", () => {
  void chrome.storage.session
    .remove(["token", "userName", "selectedEmployeeId", "selectedEmployeeName"])
    .then(refresh)
    .then(loadEmployees);
});

let employeeSignature = "";

async function loadEmployees() {
  if (!recipientsNode || !employeeList) {
    return;
  }
  const stored = await chrome.storage.session.get(["apiBaseUrl", "token", "selectedEmployeeId"]);
  if (typeof stored.token !== "string" || !stored.token) {
    employeeSignature = "";
    recipientsNode.hidden = true;
    employeeList.replaceChildren();
    return;
  }
  const base = (typeof stored.apiBaseUrl === "string" ? stored.apiBaseUrl : "https://api.chathere.site").replace(/\/$/, "");
  const response = await fetch(`${base}/api/admin/employees`, {
    headers: { Authorization: `Bearer ${stored.token}` },
  });
  if (!response.ok) {
    employeeSignature = "";
    recipientsNode.hidden = false;
    employeeList.textContent = "Could not load employees. Sign in again.";
    return;
  }
  const body = (await response.json()) as { employees?: Array<{ id: string; name: string; active: boolean }> };
  const active = (body.employees ?? []).filter((employee) => employee.active);
  const selected = typeof stored.selectedEmployeeId === "string" ? stored.selectedEmployeeId : "";
  const stillThere = active.some((employee) => employee.id === selected);
  if (selected && !stillThere) {
    await chrome.storage.session.remove(["selectedEmployeeId", "selectedEmployeeName"]);
  }
  recipientsNode.hidden = false;
  const signature = `${stillThere ? selected : ""}|${active.map((employee) => `${employee.id}:${employee.name}`).join(",")}`;
  if (signature === employeeSignature) {
    return;
  }
  employeeSignature = signature;
  employeeList.replaceChildren();
  if (active.length === 0) {
    employeeList.textContent = "No active employees. Create one on the admin accounts page.";
    return;
  }
  for (const employee of active) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "employee";
    input.value = employee.id;
    input.checked = employee.id === selected;
    input.addEventListener("change", () => {
      void chrome.storage.session.set({ selectedEmployeeId: employee.id, selectedEmployeeName: employee.name });
    });
    label.append(input, document.createTextNode(employee.name));
    employeeList.append(label);
  }
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

async function watchActiveTab(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    return "Open the Google Cloud tab, then open this popup.";
  }
  const host = originOf(tab.url);
  if (!host.endsWith(".google.com") && host !== "https://google.com") {
    return "Open this popup from the Google Cloud tab that shows the QR.";
  }
  const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
  if (!frames?.length) {
    return "Could not read this tab. Refresh the Cloud page.";
  }
  for (const frame of frames) {
    if (!isWatchedUrl(frame.url)) {
      continue;
    }
    try {
      await injectWatcher(tab.id, frame.frameId);
    } catch {
      // The report loop below records frames that still have no watcher.
    }
  }
  let bestLevel = 0;
  let bestText = "";
  const seen = new Set<string>();
  const failed = new Set<string>();
  for (const frame of frames) {
    const origin = originOf(frame.url);
    if (!origin.startsWith("https://")) {
      continue;
    }
    try {
      const report = (await chrome.tabs.sendMessage(tab.id, { type: "REPORT_SCAN" }, { frameId: frame.frameId })) as
        | ScanReport
        | undefined;
      if (!report || typeof report.heading !== "boolean") {
        continue;
      }
      seen.add(origin);
      const labeled = labelForScan(report);
      if (labeled.level >= bestLevel) {
        bestLevel = labeled.level;
        bestText = labeled.text;
      }
    } catch {
      failed.add(origin);
    }
  }
  if (bestLevel > 0) {
    return bestText;
  }
  const missing = Array.from(failed)
    .filter((origin) => !seen.has(origin))
    .slice(0, 3);
  if (missing.length > 0) {
    return `Extension is not running in ${missing.join(", ")}. Reload it on chrome://extensions, then refresh the Cloud tab.`;
  }
  return "Extension is on this tab, but it cannot see the QR. Reload it on chrome://extensions, then refresh the Cloud tab.";
}

async function refreshWatch() {
  if (!watchNode) {
    return;
  }
  try {
    watchNode.textContent = await watchActiveTab();
  } catch (error) {
    watchNode.textContent = error instanceof Error ? error.message : "Could not check this tab";
  }
}

void refresh();
void loadEmployees();
void refreshWatch();
window.setInterval(() => {
  void refresh();
  void loadEmployees();
  void refreshWatch();
}, 2000);
