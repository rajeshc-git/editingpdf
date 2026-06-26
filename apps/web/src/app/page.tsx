import { Editor } from '@/components/editor'

export default function Home() {
  return (
    <main className="h-[100dvh] w-screen overflow-hidden">
      {/* Crawlable, accessible heading & intro for SEO. Visually hidden so the
          editor UI stays clean, but available to search engines and screen readers. */}
      <section className="sr-only">
        <h1>Best Free PDF Editor Online – Edit PDF Text &amp; Modify Documents</h1>
        <p>
          EditingPDF is a free, privacy-friendly online PDF editor. Edit PDF text, modify documents,
          add images and shapes, rearrange content, and export to PDF or PNG — all directly in your
          browser. There is no sign-up, no watermarks, and no software to install.
        </p>
        <p>
          Your privacy comes first: EditingPDF processes your files in your browser and does not
          store your documents or personal data on our servers.
        </p>
        <ul>
          <li>Free online PDF editor with no watermark</li>
          <li>Edit and replace PDF text</li>
          <li>Modify, move, and restyle document elements</li>
          <li>Add images, shapes, and annotations</li>
          <li>Export to PDF and PNG</li>
          <li>Privacy-friendly — your files never leave your browser</li>
        </ul>
      </section>
      <Editor />
    </main>
  )
}
