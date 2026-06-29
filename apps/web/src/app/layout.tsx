import '@open-pdf/ui/styles.css'
import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'

const SITE_URL = 'https://editingpdf.in'
const TITLE = 'Best Free PDF Editor Online – Edit PDF Text & Modify Documents'
const DESCRIPTION =
  'EditingPDF is a free, privacy-friendly online PDF editor. Edit PDF text, modify documents, add images and shapes, and export — all in your browser. No sign-up, no watermarks, and we never store your files.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s | EditingPDF',
  },
  description: DESCRIPTION,
  applicationName: 'EditingPDF',
  keywords: [
    'free pdf editor',
    'pdf editor online',
    'edit pdf online',
    'edit pdf text',
    'modify pdf',
    'modify documents',
    'online pdf editor free',
    'edit pdf free',
    'pdf editor no watermark',
    'privacy-friendly pdf editor',
    'browser pdf editor',
    'editingpdf',
  ],
  authors: [{ name: 'EditingPDF', url: SITE_URL }],
  creator: 'EditingPDF',
  publisher: 'EditingPDF',
  category: 'productivity',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'EditingPDF',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0a0a0a',
}

// Structured data: helps Google understand this is a free web app and can
// surface rich results. No fabricated ratings — only verifiable facts.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'EditingPDF',
  url: SITE_URL,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Any (web browser)',
  description: DESCRIPTION,
  browserRequirements: 'Requires a modern web browser. No installation needed.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  featureList: [
    'Edit PDF text',
    'Modify and rearrange document elements',
    'Add images, shapes, and annotations',
    'Export to PDF and PNG',
    'Runs in your browser — files are never uploaded or stored',
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-1P27B9B3BQ"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-1P27B9B3BQ');
          `}
        </Script>
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  )
}
