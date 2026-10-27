import { Link } from 'react-router-dom'
import { brand } from '@/config/brand'

export function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <h1 className="font-display text-4xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-ink-muted">Last updated: October 27, 2026</p>

      <div className="mt-10 space-y-6 text-ink-muted">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of {brand.name} (the
          &quot;Service&quot;). By creating an account or using the Service, you agree to these Terms.
        </p>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Eligibility</h2>
          <p className="mt-3">
            You must be able to form a binding contract in your jurisdiction. You are responsible for
            ensuring your use complies with school or employer policies that apply to you.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Your account</h2>
          <p className="mt-3">
            Keep your login credentials confidential. You are responsible for activity under your account.
            Notify us promptly at{' '}
            <a href={`mailto:${brand.supportEmail}`} className="text-accent-600 hover:underline">
              {brand.supportEmail}
            </a>{' '}
            if you suspect unauthorized access.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Acceptable use</h2>
          <p className="mt-3">You agree not to:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Use the Service for unlawful purposes or to violate others&apos; rights</li>
            <li>Upload malware, spam, or content that is harassing or infringing</li>
            <li>Attempt to bypass security or access others&apos; data without permission</li>
            <li>Misuse AI features to generate harmful, deceptive, or academic-dishonesty content</li>
            <li>Scrape or overload the Service in ways that impair others</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Your content</h2>
          <p className="mt-3">
            You retain ownership of study content you create. You grant us a limited license to host, process,
            and display that content solely to operate and improve the Service for you.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">AI disclaimer</h2>
          <p className="mt-3">
            AI-generated responses may be incomplete or incorrect. They are learning aids, not professional,
            medical, or legal advice. You remain responsible for verifying information and following your
            institution&apos;s academic integrity rules.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Free service (v1)</h2>
          <p className="mt-3">
            Core features are offered free in version 1. We may introduce paid plans later with advance notice.
            We may modify or discontinue features with reasonable notice where practicable.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Disclaimer of warranties</h2>
          <p className="mt-3">
            The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any
            kind, express or implied, including merchantability, fitness for a particular purpose, and
            non-infringement.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Limitation of liability</h2>
          <p className="mt-3">
            To the maximum extent permitted by law, we are not liable for indirect, incidental, special,
            consequential, or punitive damages, or for loss of data, profits, or grades arising from your use
            of the Service. Our total liability for any claim related to the Service is limited to the amount
            you paid us in the twelve months before the claim (which may be zero for free use).
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Termination</h2>
          <p className="mt-3">
            You may stop using the Service at any time. We may suspend or terminate access if you violate
            these Terms or if necessary to protect the Service or other users.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Changes</h2>
          <p className="mt-3">
            We may update these Terms. Continued use after changes become effective constitutes acceptance of
            the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Contact</h2>
          <p className="mt-3">
            Questions about these Terms? Contact{' '}
            <a href={`mailto:${brand.supportEmail}`} className="text-accent-600 hover:underline">
              {brand.supportEmail}
            </a>{' '}
            or visit our{' '}
            <Link to="/contact" className="text-accent-600 hover:underline">
              contact page
            </Link>
            . See also our{' '}
            <Link to="/privacy" className="text-accent-600 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </div>
    </article>
  )
}
