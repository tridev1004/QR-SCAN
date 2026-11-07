const TITLE = "QRSCAN — Earn Free Money Online India | How to Earn Money Online ₹40/Scan";
const DESCRIPTION =
  "How to earn money online in India without investment: sign up free on QRSCAN, earn ₹40 per successful QR scan, get paid on UPI. Free money online, part-time work from home.";

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
        {
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "How to earn money online in India with QRSCAN?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Sign up free on QRSCAN, complete successful QR scans when they are live, and earn ₹40 for each passed scan. Add your UPI ID to receive payouts.",
              },
            },
            {
              "@type": "Question",
              name: "Can I earn free money online without investment?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. QRSCAN does not charge a joining fee, unlock fee, or software charge. You start free and earn ₹40 per successful scan.",
              },
            },
            {
              "@type": "Question",
              name: "Is this online work from home or part-time online jobs?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "QRSCAN is flexible part-time online work you can do from your phone in India when QR scans are available.",
              },
            },
            {
              "@type": "Question",
              name: "How do UPI payouts work for daily online earning?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Save your UPI ID or payout QR in your account. Successful scans add to your earnings, and admins pay you through UPI.",
              },
            },
            {
              "@type": "Question",
              name: "What should I do after Autopay or a successful QR scan?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Right after a successful QR scan, remove the mandate from your Autopay request immediately before taking the next scan.",
              },
            },
          ],
        },
      ],
    });
  }
}
