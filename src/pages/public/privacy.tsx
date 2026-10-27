import { Link } from 'react-router-dom'
import { brand } from '@/config/brand'

export function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <h1 className="font-display text-4xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-ink-muted">Last updated: October 27, 2026</p>

      <div className="prose prose-neutral mt-10 max-w-none space-y-6 text-ink-muted dark:prose-invert">
        <p>
          This Privacy Policy describes how {brand.name} (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
          collects, uses, and protects information when you use our website and study application (the
          &quot;Service&quot;).
        </p>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Information we collect</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              <strong className="text-ink">Account information:</strong> email address and authentication
              credentials you provide when you register.
            </li>
            <li>
              <strong className="text-ink">Profile and preferences:</strong> display name, education details,
              timezone, theme, and notification settings you choose in the app.
            </li>
            <li>
              <strong className="text-ink">Study content:</strong> subjects, tasks, notes, quizzes,
              flashcards, study sessions, and AI conversation content you create or upload.
            </li>
            <li>
              <strong className="text-ink">Support messages:</strong> information you send through contact or
              support forms.
            </li>
            <li>
              <strong className="text-ink">Technical data:</strong> basic logs such as browser type, device
              information, and IP address needed to operate and secure the Service.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">How we use information</h2>
          <p className="mt-3">We use your information to:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Provide, maintain, and improve the Service</li>
            <li>Authenticate you and keep your account secure</li>
            <li>Sync your study data across devices when you are signed in</li>
            <li>Respond to support requests</li>
            <li>Send service-related notices (not marketing spam)</li>
            <li>Comply with legal obligations and enforce our Terms</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">AI features</h2>
          <p className="mt-3">
            When you use AI tutoring, prompts and responses may be processed by third-party AI providers
            under agreements that restrict use of your data for training where applicable. Do not submit
            sensitive personal information you are not comfortable sharing with such processors.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Sharing</h2>
          <p className="mt-3">
            We do not sell your personal information. We share data only with service providers that help us
            run the Service (for example, hosting and authentication), when required by law, or to protect
            rights and safety.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Retention</h2>
          <p className="mt-3">
            We retain account and study data while your account is active. You may request deletion by
            contacting us at{' '}
            <a href={`mailto:${brand.supportEmail}`} className="text-accent-600 hover:underline">
              {brand.supportEmail}
            </a>
            . Some logs may be kept for a limited period for security and legal compliance.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Security</h2>
          <p className="mt-3">
            We use industry-standard measures to protect data in transit and at rest. No method of
            transmission or storage is completely secure; use a strong, unique password for your account.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Your choices</h2>
          <p className="mt-3">
            You can update profile and notification settings in the app. You may access, correct, or delete
            much of your data by using in-app tools or contacting support.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Children</h2>
          <p className="mt-3">
            The Service is intended for users who can consent to online services under applicable law. If you
            believe a child has provided personal information without appropriate consent, contact us and we
            will take appropriate steps.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Changes</h2>
          <p className="mt-3">
            We may update this policy from time to time. We will post the revised version on this page and
            update the &quot;Last updated&quot; date.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Contact</h2>
          <p className="mt-3">
            Questions about privacy? Email{' '}
            <a href={`mailto:${brand.supportEmail}`} className="text-accent-600 hover:underline">
              {brand.supportEmail}
            </a>{' '}
            or use our{' '}
            <Link to="/contact" className="text-accent-600 hover:underline">
              contact form
            </Link>
            .
          </p>
        </section>
      </div>
    </article>
  )
}
