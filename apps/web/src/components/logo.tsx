/**
 * EditingPDF brand logo.
 *
 * A stylized PDF page (folded corner) with an edit/pen stroke across it —
 * a meaningful mark for an in-browser PDF editor. Renders an optional
 * "EditingPDF" wordmark next to the glyph.
 */
export function Logo({
  size = 28,
  withWordmark = true,
  className = '',
}: {
  size?: number
  withWordmark?: boolean
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="EditingPDF logo"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="epdf-grad" x1="2" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FB7185" />
            <stop offset="1" stopColor="#E11D48" />
          </linearGradient>
        </defs>
        {/* Document body */}
        <path
          d="M7 2.5h10.6L26 10.9V25.5a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-19a4 4 0 0 1 4-4Z"
          fill="url(#epdf-grad)"
        />
        {/* Folded corner */}
        <path d="M17.6 2.5 26 10.9h-5.4a3 3 0 0 1-3-3V2.5Z" fill="#FFFFFF" fillOpacity="0.4" />
        {/* Edit / pen stroke */}
        <path
          d="m9.8 21.7 7.9-7.9 2.5 2.5-7.9 7.9-3.3.8.8-3.3Z"
          fill="#FFFFFF"
          stroke="#FFFFFF"
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
        <path d="m18.1 13.4 1.4-1.4a1.3 1.3 0 0 1 1.8 0l.7.7a1.3 1.3 0 0 1 0 1.8l-1.4 1.4-2.5-2.5Z" fill="#FFE4E6" />
      </svg>
      {withWordmark && (
        <span className="text-base font-semibold tracking-tight sm:text-lg">
          Editing<span className="text-rose-600 dark:text-rose-400">PDF</span>
        </span>
      )}
    </span>
  )
}
