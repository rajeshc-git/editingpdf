import { drawNode, loadImage } from '@/lib/render'
import { PAGE_HEIGHT, PAGE_WIDTH, useEditorStore, type EditorNode } from '@/store/editor'

function pageSize(): { width: number; height: number } {
  try {
    const s = useEditorStore.getState()
    return { width: s.pageWidth || PAGE_WIDTH, height: s.pageHeight || PAGE_HEIGHT }
  } catch {
    return { width: PAGE_WIDTH, height: PAGE_HEIGHT }
  }
}

// Render the current page to an offscreen canvas at the given scale.
async function renderPage(nodes: EditorNode[], scale: number): Promise<HTMLCanvasElement> {
  const { width: pw, height: ph } = pageSize()

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

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, pw, ph)
  ctx.clip()
  for (const node of nodes) drawNode(ctx, node)
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
  const canvas = await renderPage(nodes, 3)
  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, filename)
      resolve()
    }, 'image/png')
  })
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// Build a minimal single-page PDF that embeds the rasterized page as a
// full-bleed JPEG image (DCTDecode). Page size is the A4 point size.
export async function exportPDF(nodes: EditorNode[], filename = 'document.pdf'): Promise<void> {
  const { width: pw, height: ph } = pageSize()
  const canvas = await renderPage(nodes, 3)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
  const jpeg = base64ToBytes(dataUrl.split(',')[1] ?? '')

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
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')

  // 3: Page
  startObject()
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] ` +
      `/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`
  )

  // 4: Content stream — map the unit image square onto the full page.
  // PDF origin is bottom-left, so the image is placed at (0,0) scaled to the page.
  const content = `q\n${pw} 0 0 ${ph} 0 0 cm\n/Im0 Do\nQ\n`
  startObject()
  push(`4 0 obj\n<< /Length ${enc.encode(content).length} >>\nstream\n`)
  push(content)
  push('endstream\nendobj\n')

  // 5: Image XObject (JPEG)
  startObject()
  push(
    `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
  )
  push(jpeg)
  push('\nendstream\nendobj\n')

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
