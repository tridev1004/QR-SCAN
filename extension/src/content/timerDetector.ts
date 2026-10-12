import { googleCloudSelectors } from "../shared/selectors";
import { queryAllDeep, queryDeep } from "./domQuery";

export function readTimer(root: ParentNode): string | null {
  const element = queryDeep<HTMLElement>(root, googleCloudSelectors.timer);
  const text = element?.textContent?.trim() ?? "";
  return text || null;
}

export function readCountdown(root: ParentNode): string | null {
  const marked = readTimer(root);
  if (marked && parseTimerToSeconds(marked) !== null) {
    return marked;
  }
  const heading = queryAllDeep(root, "h1, h2, [role='heading']").find((node) =>
    (node.textContent ?? "").includes(googleCloudSelectors.qrHeadingText),
  );
  let scope: Element | null = heading ?? null;
  for (let depth = 0; depth < 6 && scope; depth += 1) {
    const match = (scope.textContent ?? "").match(/\b(\d{1,2}:\d{2})\b/);
    if (match && parseTimerToSeconds(match[1]) !== null) {
      return match[1];
    }
    scope = scope.parentElement;
  }
  return null;
}

export function parseTimerToSeconds(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const seconds = Number(match[2]);
  if (seconds > 59) {
    return null;
  }
  return Number(match[1]) * 60 + seconds;
}

export function expiresAtFromTimer(timerText: string, nowMs: number): string | null {
  const seconds = parseTimerToSeconds(timerText);
  if (seconds === null) {
    return null;
  }
  return new Date(nowMs + seconds * 1000).toISOString();
}
