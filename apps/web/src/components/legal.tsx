import Link from 'next/link'

/**
 * Small-font legal line: copyright + Privacy / Terms links.
 * Reused inside popups and as a page footer so the branding and legal
 * links stay consistent across the app.
 */
export function LegalLinks({
  className = '',
  align = 'center',
}: {
  className?: string
  align?: 'center' | 'start'
}) {
  const year = new Date().getFullYear()
  const justify = align === 'start' ? 'justify-start text-left' : 'justify-center'
  return (
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
    </div>
  )
}
