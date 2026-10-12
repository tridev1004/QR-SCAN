import { googleCloudSelectors } from "../shared/selectors";
import { queryAllDeep, queryDeep } from "./domQuery";

export function isQrScreen(root: ParentNode): boolean {
  return queryAllDeep(root, "h1, h2, [role='heading']").some((heading) =>
    (heading.textContent ?? "").includes(googleCloudSelectors.qrHeadingText),
  );
}

export function findQrImage(root: ParentNode): HTMLImageElement | null {
  const element = queryDeep<HTMLImageElement>(root, googleCloudSelectors.qrImage);
  const src = element?.getAttribute("src") ?? "";
  if (!element || !src.startsWith("data:image/png;base64,")) {
    return null;
  }
  return element;
}

export async function fingerprintQrImage(dataUrl: string): Promise<string> {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base64));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function safePageUrl(href: string): string {
  try {
    const url = new URL(href);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}
