import disposableDomains from "disposable-email-domains";
import wildcardDomains from "disposable-email-domains/wildcard";

const listed = new Set(disposableDomains);
const wildcards = new Set(wildcardDomains);

export function isDisposableEmail(email: string): boolean {
  const domain = email.toLowerCase().split("@").at(-1);
  if (!domain) {
    return true;
  }
  if (listed.has(domain) || wildcards.has(domain)) {
    return true;
  }
  const labels = domain.split(".");
  for (let i = 1; i < labels.length - 1; i += 1) {
    const parent = labels.slice(i).join(".");
    if (listed.has(parent) || wildcards.has(parent)) {
      return true;
    }
  }
  return false;
}
