import { Logo } from '@/components/logo'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How editingpdf.in handles your documents and data — we do not store your files.',
}

export default function PrivacyPage() {
  const updated = 'June 2026'
  return (
    <main className="mx-auto min-h-[100dvh] max-w-3xl px-5 py-10 sm:py-14">
      <Link href="/" className="inline-flex">
        <Logo />
      </Link>

      <h1 className="mt-8 text-2xl font-semibold tracking-tight sm:text-3xl">Privacy Policy</h1>
      <p className="mt-1 text-sm text-neutral-500">Last updated: {updated}</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        <section>
          <h2 className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Your documents stay yours
          </h2>
          <p>
            EditingPDF (editingpdf.in) is a browser-based PDF editor. When you open or edit a PDF,
            the file is processed in your browser. We do not sell your documents, and we do not use
            their contents for advertising.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
            What we collect
          </h2>
          <p>
            We collect the minimum needed to run the service: basic, anonymized usage and error
            diagnostics that help us keep the editor fast and reliable. Where the service performs
            server-side export or rendering, files are transmitted securely and removed after the
            operation completes.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Cookies and storage
          </h2>
          <p>
            We use essential browser storage to remember your editor preferences. We do not use
            third-party advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Contact
          </h2>
          <p>
            Questions about privacy? Reach us at{' '}
            <a
              href="mailto:privacy@editingpdf.in"
              className="text-rose-600 hover:underline dark:text-rose-400"
            >
              privacy@editingpdf.in
            </a>
            .
          </p>
        </section>

        <p className="text-xs text-neutral-400">
          This summary is provided for transparency and may be updated as the service evolves.
        </p>
      </div>

      <div className="mt-10 border-t border-neutral-200 pt-4 text-xs text-neutral-400 dark:border-neutral-800">
        <Link href="/" className="hover:text-neutral-700 hover:underline dark:hover:text-neutral-200">
          ← Back to editor
        </Link>
        <span className="mx-2">·</span>
        <Link
          href="/terms"
          className="hover:text-neutral-700 hover:underline dark:hover:text-neutral-200"
        >
          Terms &amp; Conditions
        </Link>
      </div>
    </main>
  )
}
