const TITLE = "QRSCAN — Free Money Online | Earn ₹40 Per Successful Scan";
const DESCRIPTION =
  "Want free money online? Sign up free on QRSCAN and earn ₹40 for every successful QR scan. Legitimate online work in India with real UPI payouts. No joining fee.";

function upsertMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let node = document.head.querySelector<HTMLMetaElement>(`${selector}[${attribute}="${key}"]`);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attribute, key);
    document.head.appendChild(node);
  }
  node.content = content;
}

const SITE_ORIGIN = "https://chathere.site";

/** Fills absolute URLs so crawlers and share previews get a real origin after deploy. */
export function applyPublicMeta(pathname = "/") {
  const origin = window.location.hostname === "localhost" ? SITE_ORIGIN : window.location.origin;
  const url = `${origin}${pathname === "/" ? "/" : pathname}`;

  document.title = TITLE;
  upsertMeta('meta[name="description"]', "name", "description", DESCRIPTION);
  upsertMeta('meta[property="og:title"]', "property", "og:title", TITLE);
  upsertMeta('meta[property="og:description"]', "property", "og:description", DESCRIPTION);
  upsertMeta('meta[property="og:url"]', "property", "og:url", url);
  upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", TITLE);
  upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", DESCRIPTION);

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = url;

  const jsonLd = document.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
  if (jsonLd) {
    jsonLd.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          name: "QRSCAN",
          url: origin,
          description: DESCRIPTION,
          inLanguage: "en-IN",
          potentialAction: {
            "@type": "RegisterAction",
            target: `${origin}/signup`,
          },
        },
        {
          "@type": "Organization",
          name: "QRSCAN",
          url: origin,
          description: "Online work platform that pays ₹40 per successful QR scan.",
        },
        {
          "@type": "JobPosting",
          title: "QR Scan Operator — Earn ₹40 Per Successful Scan",
          description:
            "Part-time online work: sign up free, complete successful QR scans, and earn ₹40 per passed scan with UPI payouts.",
          datePosted: "2026-01-01",
          hiringOrganization: {
            "@type": "Organization",
            name: "QRSCAN",
            sameAs: origin,
          },
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: {
            "@type": "Country",
            name: "India",
          },
          employmentType: "PART_TIME",
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: "INR",
            value: {
              "@type": "QuantitativeValue",
              value: 40,
              unitText: "SUCCESSFUL_SCAN",
            },
          },
        },
      ],
    });
  }
}
