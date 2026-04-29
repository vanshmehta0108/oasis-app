import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Sift",
  description: "How Sift collects, uses, and protects your data.",
};

// Plain-English privacy policy. We keep it short and specific because long
// legalese is what people skip — and we'd rather they actually read this.
// Reviewed by counsel before public launch is recommended.

export default function PrivacyPolicyPage() {
  return (
    <main
      className="min-h-dvh"
      style={{
        background: "#F2F2F7",
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
      }}
    >
      <article className="max-w-2xl mx-auto px-5 prose prose-neutral">
        <Link href="/" className="text-[13px] font-medium" style={{ color: "#007AFF" }}>← Back to Sift</Link>
        <h1 className="text-[28px] font-bold tracking-tight mt-3">Privacy Policy</h1>
        <p className="text-[12px]" style={{ color: "#8E8E93" }}>Last updated: 30 April 2026</p>

        <p>
          Sift is built for people in India who want to make sense of food, beverage, and personal-care labels.
          Health information is sensitive. We treat it that way. This page tells you exactly what we collect,
          why, and how to remove it.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account info</strong> — your email and (if you sign in with Google) your name and profile picture.
          </li>
          <li>
            <strong>Health profile</strong> — health conditions and food allergies you choose to add. Used only to
            personalize the safety verdict you see on a product. You can leave this empty and the app still works.
          </li>
          <li>
            <strong>Activity</strong> — products you scan, search, save, or compare. Used to populate your history
            and to improve the catalog.
          </li>
          <li>
            <strong>Device data</strong> — IP address, browser/device type, language, and basic crash diagnostics.
            Used to keep the service running and to fix bugs.
          </li>
        </ul>

        <h2>What we do NOT do</h2>
        <ul>
          <li>We do not sell your data.</li>
          <li>We do not share your health profile with advertisers.</li>
          <li>We do not log your barcodes against your name in our analytics.</li>
        </ul>

        <h2>Where it lives</h2>
        <p>
          Account info and your health profile sit in a Supabase Postgres database hosted in the EU.
          Database row-level security ensures one user can only ever read or change their own data — never
          another user&apos;s. Background analysis uses Google&apos;s Gemini API; ingredient text is sent to
          Gemini, but never your name, email, or full health profile (only the conditions/allergies you
          chose, used to tailor the verdict).
        </p>

        <h2>How long we keep it</h2>
        <p>
          As long as you have an account. If you delete your account, your health profile, scan history,
          bookmarks, and compare list are removed within 24 hours. Community product submissions you made
          are kept (they help everyone) but anonymized — no link back to you.
        </p>

        <h2>Your rights (DPDP Act 2023)</h2>
        <ul>
          <li>
            <strong>Access:</strong> see everything we store about you in your{" "}
            <Link href="/profile" style={{ color: "#007AFF" }}>profile</Link>.
          </li>
          <li>
            <strong>Correction:</strong> edit your profile any time.
          </li>
          <li>
            <strong>Erasure:</strong> the &quot;Delete my data&quot; button in your profile triggers immediate
            removal. You will be signed out and your auth record deleted. This is irreversible.
          </li>
          <li>
            <strong>Portability:</strong> email{" "}
            <a href="mailto:privacy@sift-india.app" style={{ color: "#007AFF" }}>privacy@sift-india.app</a>{" "}
            and we&apos;ll export your data in JSON within 7 days.
          </li>
          <li>
            <strong>Grievance:</strong> for any complaint, write to the same address. We respond within 48
            hours and resolve within 30 days.
          </li>
        </ul>

        <h2>Cookies and storage</h2>
        <p>
          We use a small amount of localStorage to remember your language preference, onboarding state,
          and (for guest users) bookmarks. We do not use third-party advertising cookies. Vercel Analytics
          and Speed Insights are enabled — both are first-party, anonymized, and do not set tracking cookies.
        </p>

        <h2>Third parties we rely on</h2>
        <ul>
          <li><strong>Supabase</strong> (database + auth) — Frankfurt, EU.</li>
          <li><strong>Vercel</strong> (hosting + analytics) — global edge.</li>
          <li><strong>Google Gemini</strong> (ingredient analysis) — used per-request, no training on your data per Google&apos;s API terms.</li>
          <li><strong>Sentry</strong> (crash reporting) — stack traces only, no PII.</li>
          <li><strong>Open Food Facts</strong> (public product database) — read-only.</li>
        </ul>

        <h2>Children</h2>
        <p>
          Sift is not directed to children under 13. If you believe a child has signed up, email us and
          we will delete the account.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          If we materially change anything here, we&apos;ll show you the change inside the app before it
          takes effect — not just bury it in an updated date.
        </p>

        <h2>Contact</h2>
        <p>
          Email{" "}
          <a href="mailto:privacy@sift-india.app" style={{ color: "#007AFF" }}>privacy@sift-india.app</a>.
          We are a small team and we read every message.
        </p>
      </article>
    </main>
  );
}
