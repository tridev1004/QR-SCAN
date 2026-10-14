import { labelForScan } from "../content/scanReport";
import { API_BASE_URL } from "../shared/apiBase";
import { injectWatcher, isWatchedUrl } from "../shared/injectWatcher";
import { ScanReport } from "../shared/messages";

const statusNode = document.querySelector<HTMLElement>("#status");
const signInForm = document.querySelector<HTMLFormElement>("#signInForm");
const recipientsNode = document.querySelector<HTMLElement>("#recipients");
const recipientLabel = document.querySelector<HTMLElement>("#recipientLabel");
const employeeCount = document.querySelector<HTMLElement>("#employeeCount");
const employeeSearch = document.querySelector<HTMLInputElement>("#employeeSearch");
const employeeList = document.querySelector<HTMLElement>("#employeeList");
const watchNode = document.querySelector<HTMLElement>("#watch");
const captureNode = document.querySelector<HTMLElement>("#capture");
const email = document.querySelector<HTMLInputElement>("#email");
const password = document.querySelector<HTMLInputElement>("#password");
const signIn = document.querySelector<HTMLButtonElement>("#signIn");
const signOut = document.querySelector<HTMLButtonElement>("#signOut");
const sendQr = document.querySelector<HTMLButtonElement>("#sendQr");

function setStatus(text: string, kind: "idle" | "in" | "error") {
  if (!statusNode) {
    return;
  }
  statusNode.textContent = text;
  statusNode.classList.toggle("is-in", kind === "in");
  statusNode.classList.toggle("is-error", kind === "error");
}

async function refresh() {
  const stored = await chrome.storage.session.get(["token", "userName", "lastCapture"]);
  const signedIn = typeof stored.userName === "string" && typeof stored.token === "string" && stored.token.length > 0;
  setStatus(signedIn ? `Signed in as ${stored.userName}` : "Not signed in", signedIn ? "in" : "idle");
  if (signInForm) {
    signInForm.hidden = signedIn;
  }
  if (captureNode) {
    captureNode.textContent = typeof stored.lastCapture === "string" ? stored.lastCapture : "";
  }
}

signInForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  void (async () => {
    if (signIn) signIn.disabled = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
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
        setStatus(body.error ?? "Login failed", "error");
        return;
      }
      if (body.user.role !== "ADMIN") {
        setStatus("Sign in with an admin account", "error");
        return;
      }
      await chrome.storage.session.remove(["apiBaseUrl"]);
      await chrome.storage.session.set({
        token: body.token,
        userName: body.user.name ?? "Admin",
      });
      if (password) password.value = "";
      await refresh();
      await loadEmployees();
    } finally {
      if (signIn) signIn.disabled = false;
    }
  })();
});

signOut?.addEventListener("click", () => {
  if (employeeSearch) employeeSearch.value = "";
  void chrome.storage.session
    .remove(["apiBaseUrl", "token", "userName", "selectedEmployeeId", "selectedEmployeeName"])
    .then(refresh)
    .then(loadEmployees);
});

type ListedEmployee = { id: string; name: string };

let employeeSignature = "";
let activeEmployees: ListedEmployee[] = [];
let selectedEmployeeId = "";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

function renderEmployees() {
  if (!employeeList) {
    return;
  }
  const query = (employeeSearch?.value ?? "").trim().toLowerCase();
  const shown = activeEmployees.filter((employee) => employee.name.toLowerCase().includes(query));
  const selected = activeEmployees.find((employee) => employee.id === selectedEmployeeId);
  if (recipientLabel) {
    recipientLabel.textContent = selected ? `Sending to ${selected.name}` : "All active employees can reserve";
  }
  if (employeeCount) {
    employeeCount.textContent =
      activeEmployees.length === 0
        ? ""
        : query
          ? `${shown.length} of ${activeEmployees.length}`
          : `${activeEmployees.length} active`;
  }
  employeeList.replaceChildren();
  if (activeEmployees.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No active employees. Create one on the admin accounts page.";
    employeeList.append(empty);
    return;
  }
  if (shown.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No employees match that search.";
    employeeList.append(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  if (!query) {
    const everyone = document.createElement("label");
    everyone.className = "employee";
    const everyoneInput = document.createElement("input");
    everyoneInput.type = "radio";
    everyoneInput.name = "employee";
    everyoneInput.value = "";
    everyoneInput.checked = !selectedEmployeeId;
    everyoneInput.addEventListener("change", () => {
      selectedEmployeeId = "";
      employeeSignature = `|${activeEmployees.map((item) => `${item.id}:${item.name}`).join(",")}`;
      if (recipientLabel) recipientLabel.textContent = "All active employees can reserve";
      void chrome.storage.session.remove(["selectedEmployeeId", "selectedEmployeeName"]);
    });
    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.textContent = "All";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = "All active employees";
    everyone.append(everyoneInput, avatar, name);
    fragment.append(everyone);
  }
  for (const employee of shown) {
    const label = document.createElement("label");
    label.className = "employee";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "employee";
    input.value = employee.id;
    input.checked = employee.id === selectedEmployeeId;
    input.addEventListener("change", () => {
      selectedEmployeeId = employee.id;
      employeeSignature = `${employee.id}|${activeEmployees.map((item) => `${item.id}:${item.name}`).join(",")}`;
      if (recipientLabel) recipientLabel.textContent = `Sending to ${employee.name}`;
      void chrome.storage.session.set({ selectedEmployeeId: employee.id, selectedEmployeeName: employee.name });
    });
    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.textContent = initials(employee.name);
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = employee.name;
    label.append(input, avatar, name);
    fragment.append(label);
  }
  employeeList.append(fragment);
}

employeeSearch?.addEventListener("input", () => {
  renderEmployees();
});

sendQr?.addEventListener("click", () => {
  if (!sendQr) {
    return;
  }
  sendQr.disabled = true;
  sendQr.textContent = "Sending…";
  chrome.runtime.sendMessage({ type: "SEND_QR" }, () => {
    sendQr.disabled = false;
    sendQr.textContent = "Send";
    void refresh();
  });
});

async function loadEmployees() {
  if (!recipientsNode || !employeeList) {
    return;
  }
  const stored = await chrome.storage.session.get(["token", "selectedEmployeeId"]);
  if (typeof stored.token !== "string" || !stored.token) {
    employeeSignature = "";
    activeEmployees = [];
    selectedEmployeeId = "";
    recipientsNode.hidden = true;
    employeeList.replaceChildren();
    return;
  }
  const response = await fetch(`${API_BASE_URL}/api/admin/employees`, {
    headers: { Authorization: `Bearer ${stored.token}` },
  });
  if (!response.ok) {
    employeeSignature = "";
    activeEmployees = [];
    recipientsNode.hidden = false;
    if (recipientLabel) recipientLabel.textContent = "Employees";
    if (employeeCount) employeeCount.textContent = "";
    employeeList.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Could not load employees. Sign in again.";
    employeeList.append(empty);
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
  const nextSelected = stillThere ? selected : "";
  const signature = `${nextSelected}|${active.map((employee) => `${employee.id}:${employee.name}`).join(",")}`;
  if (signature === employeeSignature) {
    return;
  }
  employeeSignature = signature;
  activeEmployees = active;
  selectedEmployeeId = nextSelected;
  renderEmployees();
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
