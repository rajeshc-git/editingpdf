import { Logo } from '@/components/logo'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'The terms that govern your use of editingpdf.in.',
}

export default function TermsPage() {
  const updated = 'June 2026'
  return (
    <main className="mx-auto min-h-[100dvh] max-w-3xl px-5 py-10 sm:py-14">
      <Link href="/" className="inline-flex">
        <Logo />
      </Link>

      <h1 className="mt-8 text-2xl font-semibold tracking-tight sm:text-3xl">Terms &amp; Conditions</h1>
      <p className="mt-1 text-sm text-neutral-500">Last updated: {updated}</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        <section>
          <h2 className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Acceptance of terms
          </h2>
          <p>
            By using EditingPDF (editingpdf.in) you agree to these Terms &amp; Conditions. If you do
            not agree, please do not use the service.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Acceptable use
          </h2>
          <p>
            You are responsible for the documents you process and must have the right to edit them.
            Do not use the service to handle unlawful content or to infringe the rights of others.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Service &ldquo;as is&rdquo;
          </h2>
          <p>
            The service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis
            without warranties of any kind. We work to keep it reliable, but we do not guarantee
            uninterrupted or error-free operation.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Limitation of liability
          </h2>
          <p>
            To the maximum extent permitted by law, editingpdf.in shall not be liable for any
            indirect or consequential loss arising from your use of the service. Always keep a
            backup of important documents.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Contact
          </h2>
          <p>
            Questions about these terms? Reach us at{' '}
            <a
              href="mailto:support@editingpdf.in"
              className="text-rose-600 hover:underline dark:text-rose-400"
            >
              support@editingpdf.in
            </a>
            .
          </p>
        </section>
      </div>

      <div className="mt-10 border-t border-neutral-200 pt-4 text-xs text-neutral-400 dark:border-neutral-800">
        <Link href="/" className="hover:text-neutral-700 hover:underline dark:hover:text-neutral-200">
          ← Back to editor
        </Link>
        <span className="mx-2">·</span>
        <Link
          href="/privacy"
          className="hover:text-neutral-700 hover:underline dark:hover:text-neutral-200"
        >
          Privacy Policy
        </Link>
      </div>
    </main>
  )
}
