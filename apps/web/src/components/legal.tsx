'use client'

import { Heart, Server, ShieldCheck, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

/**
 * Small-font legal line: copyright + Privacy / Terms + Why Ads popup modal.
 */
export function LegalLinks({
  className = '',
  align = 'center',
}: {
  className?: string
  align?: 'center' | 'start'
}) {
  const [showWhyAds, setShowWhyAds] = useState(false)
  const year = new Date().getFullYear()
  const justify = align === 'start' ? 'justify-start text-left' : 'justify-center'

  return (
    <>
      <div
        className={`flex flex-wrap items-center ${justify} gap-x-2 gap-y-0.5 text-[10px] leading-tight text-neutral-400 ${className}`}
      >
        <span className="hidden sm:inline">© {year} editingpdf.in. All rights reserved.</span>
        <span className="hidden sm:inline" aria-hidden="true">·</span>
        <Link
          href="/privacy"
          className="hover:text-rose-600 hover:underline dark:hover:text-rose-400"
        >
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <Link
          href="/terms"
          className="hover:text-rose-600 hover:underline dark:hover:text-rose-400"
        >
          Terms
        </Link>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => setShowWhyAds(true)}
          className="inline-flex items-center gap-0.5 font-medium text-neutral-500 hover:text-rose-600 hover:underline dark:text-neutral-400 dark:hover:text-rose-400"
        >
          Why Ads?
        </button>
      </div>

      {showWhyAds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
            <button
              onClick={() => setShowWhyAds(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                <Heart size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  Why does EditingPDF show ads?
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Transparency and our commitment to you
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
              <div className="flex gap-2.5 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/40">
                <Server className="h-4 w-4 shrink-0 text-neutral-500" />
                <div>
                  <strong className="text-neutral-800 dark:text-neutral-200">Server & Infrastructure:</strong> EditingPDF is 100% free and open-source, developed without corporate sponsorships. Minimal non-intrusive ads help cover server hosting and domain costs.
                </div>
              </div>

              <div className="flex gap-2.5 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/40">
                <Sparkles className="h-4 w-4 shrink-0 text-neutral-500" />
                <div>
                  <strong className="text-neutral-800 dark:text-neutral-200">Permanently Free:</strong> No subscriptions, no sign-ups, and no paywalls. Every feature is unlocked for all users.
                </div>
              </div>

              <div className="flex gap-2.5 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/40">
                <ShieldCheck className="h-4 w-4 shrink-0 text-neutral-500" />
                <div>
                  <strong className="text-neutral-800 dark:text-neutral-200">100% Client-Side Privacy:</strong> All PDF editing and processing runs completely inside your browser. We never upload, store, or sell your documents or images.
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowWhyAds(false)}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
