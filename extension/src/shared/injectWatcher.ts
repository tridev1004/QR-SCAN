const watchedOrigins = [
  "https://console.cloud.google.com",
  "https://payments.google.com",
  "https://pay.google.com",
  "https://accounts.google.com",
];

export function isWatchedUrl(url: string): boolean {
  try {
    return watchedOrigins.includes(new URL(url).origin);
  } catch {
    return false;
  }
}

export async function injectWatcher(tabId: number, frameId: number): Promise<void> {
  await chrome.scripting
    .executeScript({
      target: { tabId, frameIds: [frameId] },
      files: ["dist/shadowHook.js"],
      world: "MAIN",
      injectImmediately: true,
    })
    .catch(() => undefined);
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    files: ["dist/content.js"],
    injectImmediately: true,
  });
}
