import { googleCloudSelectors } from "../shared/selectors";
import { queryDeep } from "./domQuery";

function nodeText(root: ParentNode): string {
  const candidate = root as ParentNode & { body?: { textContent?: string | null }; textContent?: string | null };
  if (candidate.body) {
    return candidate.body.textContent ?? "";
  }
  return candidate.textContent ?? "";
}

function readable(value: string): string {
  return value.replace(/[\u2018\u2019\u201B]/g, "'");
}

export function matchesAnyIndicator(root: ParentNode, indicators: readonly string[]): boolean {
  const text = readable(nodeText(root));
  return indicators.some((indicator) => {
    if (indicator.startsWith("text:")) {
      return text.includes(readable(indicator.slice("text:".length)));
    }
    try {
      return root.querySelector(indicator) !== null || queryDeep(root, indicator) !== null;
    } catch {
      return false;
    }
  });
}

export function detectSuccess(root: ParentNode): boolean {
  return matchesAnyIndicator(root, googleCloudSelectors.successIndicators);
}

export function detectFailure(root: ParentNode): boolean {
  return matchesAnyIndicator(root, googleCloudSelectors.failureIndicators);
}

export function detectExpired(root: ParentNode): boolean {
  return matchesAnyIndicator(root, googleCloudSelectors.expiredIndicators);
}
