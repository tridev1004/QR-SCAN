import { queryAllDeep } from "./domQuery";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function uniqueEmails(text: string): string[] {
  const found = text.match(EMAIL_RE) || [];
  return [...new Set(found.map((value) => value.toLowerCase()))];
}

function pickEmail(text: string): string | null {
  return uniqueEmails(text)[0] || null;
}

function labeledText(root: ParentNode): string {
  const parts: string[] = [];
  for (const element of queryAllDeep(root, "[aria-label], [alt], [title], [data-email], [data-identifier]")) {
    parts.push(
      element.getAttribute("aria-label") || "",
      element.getAttribute("alt") || "",
      element.getAttribute("title") || "",
      element.getAttribute("data-email") || "",
      element.getAttribute("data-identifier") || "",
    );
  }
  return parts.filter(Boolean).join("\n");
}

export function readAccountEmail(document: Document): string | null {
  const labeled = labeledText(document);
  const googleLines = labeled
    .split("\n")
    .filter((line) => /google account/i.test(line) || /sign.?out options/i.test(line));
  return pickEmail(googleLines.join("\n")) || pickEmail(labeled);
}
