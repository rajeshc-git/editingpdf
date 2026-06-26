'use client'

import { createNode, DEFAULT_TEXT_STYLE, type EditorNode } from '@/store/editor'

export interface ImportedPdf {
  nodes: EditorNode[]
  pageWidth: number
  pageHeight: number
  pageCount: number
}

// PDF transform composition (matches pdfjs Util.transform: result = m1 x m2)
function mul(m1: number[], m2: number[]): number[] {
  return [
    m1[0]! * m2[0]! + m1[2]! * m2[1]!,
    m1[1]! * m2[0]! + m1[3]! * m2[1]!,
    m1[0]! * m2[2]! + m1[2]! * m2[3]!,
    m1[1]! * m2[2]! + m1[3]! * m2[3]!,
    m1[0]! * m2[4]! + m1[2]! * m2[5]! + m1[4]!,
    m1[1]! * m2[4]! + m1[3]! * m2[5]! + m1[5]!,
  ]
}

// Convert a decoded pdf.js image object to a PNG data URL.
function imageToDataURL(img: {
  width: number
  height: number
  kind?: number
  data?: Uint8ClampedArray | Uint8Array
  bitmap?: CanvasImageSource
}): string | null {
  const { width, height } = img
  if (!width || !height) return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0, width, height)
  } else if (img.data) {
    const out = ctx.createImageData(width, height)
    const src = img.data
    const expectedRGBA = width * height * 4
    const expectedRGB = width * height * 3
    if (src.length === expectedRGBA) {
      out.data.set(src.subarray(0, expectedRGBA))
    } else if (src.length === expectedRGB) {
      for (let i = 0, j = 0; i < src.length; i += 3, j += 4) {
        out.data[j] = src[i]!
        out.data[j + 1] = src[i + 1]!
        out.data[j + 2] = src[i + 2]!
        out.data[j + 3] = 255
      }
    } else {
      return null
    }
    ctx.putImageData(out, 0, 0)
  } else {
    return null
  }

  try {
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

async function getImageObject(
  page: { objs: { get: (n: string, cb: (o: unknown) => void) => void; has?: (n: string) => boolean } },
  name: string
): Promise<{ width: number; height: number; kind?: number; data?: Uint8ClampedArray; bitmap?: CanvasImageSource } | null> {
  return new Promise((resolve) => {
    let done = false
    const finish = (o: unknown) => {
      if (done) return
      done = true
      resolve((o as never) ?? null)
    }
    try {
      page.objs.get(name, finish)
    } catch {
      resolve(null)
    }
    // Safety timeout in case the object never resolves
    setTimeout(() => finish(null), 4000)
  })
}

export async function importPdf(file: File | ArrayBuffer): Promise<ImportedPdf> {
  // Lazy-load pdf.js so it stays out of the initial page bundle.
  const pdfjsLib = await import('pdfjs-dist')
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  }

  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 1 })
  const pageWidth = viewport.width
  const pageHeight = viewport.height

  const nodes: EditorNode[] = []
  let count = 0

  // ---- Text -> editable text nodes ----
  try {
    const textContent = await page.getTextContent()
    for (const raw of textContent.items as Array<Record<string, unknown>>) {
      if (!('str' in raw)) continue
      const str = String(raw.str ?? '')
      if (!str.trim()) continue
      const t = raw.transform as number[]
      if (!t || t.length < 6) continue
      const fontSize = Math.hypot(t[2]!, t[3]!) || Math.abs(t[3]!) || 12
      const x = t[4]!
      const baseline = t[5]!
      const top = pageHeight - baseline - fontSize
      const itemWidth = typeof raw.width === 'number' ? (raw.width as number) : str.length * fontSize * 0.5
      const node = createNode(
        'text',
        x,
        Math.max(0, top),
        Math.max(itemWidth, 4),
        fontSize * 1.35,
        ++count
      )
      node.text = str
      node.name = str.slice(0, 24).trim() || 'Text'
      node.fill = { type: 'solid', color: '#18181b' }
      node.textStyle = {
        ...DEFAULT_TEXT_STYLE,
        fontSize,
        lineHeight: 1.15,
        textAlign: 'left',
      }
      nodes.push(node)
    }
  } catch {
    // text extraction failed — continue with whatever we have
  }

  // ---- Images -> image nodes (placed via tracked CTM) ----
  try {
    const opList = await page.getOperatorList()
    const OPS = pdfjsLib.OPS
    let ctm = [1, 0, 0, 1, 0, 0]
    const stack: number[][] = []
    const placements: { name: string; ctm: number[] }[] = []

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i]
      const args = opList.argsArray[i] as number[]
      if (fn === OPS.save) {
        stack.push(ctm.slice())
      } else if (fn === OPS.restore) {
        ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0]
      } else if (fn === OPS.transform) {
        ctm = mul(ctm, args)
      } else if (
        fn === OPS.paintImageXObject ||
        fn === OPS.paintImageXObjectRepeat
      ) {
        const name = (opList.argsArray[i] as unknown[])[0]
        if (typeof name === 'string') placements.push({ name, ctm: ctm.slice() })
      }
    }

    // De-dupe identical placements (repeats), then build nodes
    const seen = new Set<string>()
    for (const p of placements) {
      const w = Math.hypot(p.ctm[0]!, p.ctm[1]!)
      const h = Math.hypot(p.ctm[2]!, p.ctm[3]!)
      if (w < 2 || h < 2) continue
      const x = p.ctm[4]!
      const top = pageHeight - p.ctm[5]! - h
      const key = `${p.name}:${Math.round(x)}:${Math.round(top)}:${Math.round(w)}:${Math.round(h)}`
      if (seen.has(key)) continue
      seen.add(key)

      const imgObj = await getImageObject(page as never, p.name)
      if (!imgObj) continue
      const src = imageToDataURL(imgObj)
      if (!src) continue

      const node = createNode('image', x, Math.max(0, top), w, h, ++count)
      node.src = src
      node.fit = 'fill'
      node.name = 'Image'
      nodes.push(node)
    }
  } catch {
    // image extraction failed — keep text nodes
  }

  // Images should sit beneath text in z-order
  nodes.sort((a, b) => {
    const rank = (n: EditorNode) => (n.type === 'image' ? 0 : 1)
    return rank(a) - rank(b)
  })

  return { nodes, pageWidth, pageHeight, pageCount: pdf.numPages }
}
