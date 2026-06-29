import { drawNode, loadImage } from '@/lib/render'
import { PAGE_GAP, useEditorStore, type EditorNode } from '@/store/editor'


// Render a specific page of a multi-page document to an offscreen canvas at the given scale.
async function renderSinglePage(
  nodes: EditorNode[],
  pageIndex: number,
  scale: number
): Promise<HTMLCanvasElement> {
  const s = useEditorStore.getState()
  const pg = s.pages[pageIndex]!
  const pw = pg.width
  const ph = pg.height

  // Make sure every image is decoded before rasterizing.
  await Promise.all(
    nodes.filter((n) => n.type === 'image' && n.src).map((n) => loadImage(n.src!).catch(() => null))
  )

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(pw * scale)
  canvas.height = Math.round(ph * scale)
  const ctx = canvas.getContext('2d')!

  ctx.scale(scale, scale)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, pw, ph)

  // Calculate y offset for this page
  let yStart = 0
  for (let j = 0; j < pageIndex; j++) {
    yStart += s.pages[j]!.height + PAGE_GAP
  }

  ctx.save()
  // Translate to shift nodes of this page into view
  ctx.translate(0, -yStart)
  ctx.beginPath()
  ctx.rect(0, yStart, pw, ph)
  ctx.clip()

  for (const node of nodes) {
    drawNode(ctx, node)
  }
  ctx.restore()

  return canvas
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportPNG(nodes: EditorNode[], filename = 'page.png'): Promise<void> {
  const s = useEditorStore.getState()
  const pageCount = s.pages.length

  for (let i = 0; i < pageCount; i++) {
    const canvas = await renderSinglePage(nodes, i, 3)
    const name = pageCount > 1 ? `page-${i + 1}.png` : filename
    await new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) triggerDownload(blob, name)
        resolve()
      }, 'image/png')
    })
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// Build a multi-page PDF that embeds the rasterized pages as full-bleed JPEG images
export async function exportPDF(nodes: EditorNode[], filename = 'document.pdf'): Promise<void> {
  const s = useEditorStore.getState()
  const pageCount = s.pages.length

  // Generate image/jpeg byte arrays for each page
  const pageImages: { jpeg: Uint8Array; width: number; height: number; pw: number; ph: number }[] = []
  for (let i = 0; i < pageCount; i++) {
    const pg = s.pages[i]!
    const canvas = await renderSinglePage(nodes, i, 3)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const jpeg = base64ToBytes(dataUrl.split(',')[1] ?? '')
    pageImages.push({
      jpeg,
      width: canvas.width,
      height: canvas.height,
      pw: pg.width,
      ph: pg.height,
    })
  }

  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === 'string' ? enc.encode(data) : data
    chunks.push(bytes)
    length += bytes.length
  }
  const startObject = () => {
    offsets.push(length)
  }

  push('%PDF-1.4\n')

  // 1: Catalog
  startObject()
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')

  // 2: Pages
  startObject()
  const kids = Array.from({ length: pageCount }, (_, i) => `${3 + 3 * i} 0 R`).join(' ')
  push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj\n`)

  // Write objects for each page
  for (let i = 0; i < pageCount; i++) {
    const imgData = pageImages[i]!
    const pageId = 3 + 3 * i
    const contentId = 4 + 3 * i
    const imageId = 5 + 3 * i

    // Page Object
    startObject()
    push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${imgData.pw} ${imgData.ph}] ` +
        `/Resources << /XObject << /Im${i} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    )

    // Content Stream
    const content = `q\n${imgData.pw} 0 0 ${imgData.ph} 0 0 cm\n/Im${i} Do\nQ\n`
    startObject()
    push(`${contentId} 0 obj\n<< /Length ${enc.encode(content).length} >>\nstream\n`)
    push(content)
    push('endstream\nendobj\n')

    // Image XObject (JPEG)
    startObject()
    push(
      `${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgData.width} /Height ${imgData.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgData.jpeg.length} >>\nstream\n`
    )
    push(imgData.jpeg)
    push('\nendstream\nendobj\n')
  }

  // xref
  const xrefOffset = length
  const objectCount = offsets.length + 1
  let xref = `xref\n0 ${objectCount}\n0000000000 65535 f \n`
  for (const off of offsets) {
    xref += `${off.toString().padStart(10, '0')} 00000 n \n`
  }
  push(xref)
  push(`trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)

  const blob = new Blob(chunks as BlobPart[], { type: 'application/pdf' })
  triggerDownload(blob, filename)
}
