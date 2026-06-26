import type { EditorNode } from '@/store/editor'

// Module-level image cache so the render loop can draw images once decoded.
const imageCache = new Map<string, HTMLImageElement>()

export function getCachedImage(src: string): HTMLImageElement | null {
  const existing = imageCache.get(src)
  if (existing) {
    return existing.complete && existing.naturalWidth > 0 ? existing : null
  }
  if (typeof window === 'undefined') return null
  const img = new window.Image()
  img.src = src
  imageCache.set(src, img)
  return null
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src)
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return Promise.resolve(cached)
  }
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      imageCache.set(src, img)
      resolve(img)
    }
    img.onerror = reject
    img.src = src
  })
}

function roundRectPath(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

export function wrapText(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = []
  for (const rawLine of text.split('\n')) {
    if (rawLine === '') {
      lines.push('')
      continue
    }
    const words = rawLine.split(' ')
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (ctx.measureText(candidate).width > maxWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = candidate
      }
    }
    if (current) lines.push(current)
  }
  return lines
}

type AnyCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export function drawNode(ctx: AnyCtx, node: EditorNode): void {
  if (!node.visible) return

  ctx.save()
  ctx.globalAlpha = node.opacity

  // Rotate around the node center
  if (node.rotation) {
    const cx = node.x + node.width / 2
    const cy = node.y + node.height / 2
    ctx.translate(cx, cy)
    ctx.rotate((node.rotation * Math.PI) / 180)
    ctx.translate(-cx, -cy)
  }

  const fillColor = node.fill.type === 'solid' && node.fill.color ? node.fill.color : '#000000'

  if (node.type === 'ellipse') {
    ctx.beginPath()
    ctx.ellipse(
      node.x + node.width / 2,
      node.y + node.height / 2,
      Math.abs(node.width / 2),
      Math.abs(node.height / 2),
      0,
      0,
      Math.PI * 2
    )
    ctx.fillStyle = fillColor
    ctx.fill()
    if (node.stroke) {
      ctx.lineWidth = node.stroke.width
      ctx.strokeStyle = node.stroke.color
      ctx.stroke()
    }
  } else if (node.type === 'image') {
    const img = node.src ? getCachedImage(node.src) : null
    if (img) {
      drawImageFit(ctx, img, node)
    } else {
      // Placeholder while loading / empty
      ctx.fillStyle = fillColor
      ctx.fillRect(node.x, node.y, node.width, node.height)
      ctx.fillStyle = '#9ca3af'
      ctx.font = '14px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Image', node.x + node.width / 2, node.y + node.height / 2)
    }
    if (node.stroke) {
      ctx.lineWidth = node.stroke.width
      ctx.strokeStyle = node.stroke.color
      ctx.strokeRect(node.x, node.y, node.width, node.height)
    }
  } else if (node.type === 'text') {
    drawText(ctx, node)
  } else {
    // rectangle / frame
    const radius = node.cornerRadius ?? 0
    roundRectPath(ctx, node.x, node.y, node.width, node.height, radius)
    ctx.fillStyle = fillColor
    ctx.fill()
    if (node.stroke) {
      ctx.lineWidth = node.stroke.width
      ctx.strokeStyle = node.stroke.color
      ctx.stroke()
    }
  }

  ctx.restore()
}

function drawImageFit(ctx: AnyCtx, img: HTMLImageElement, node: EditorNode): void {
  const { x, y, width, height } = node
  ctx.save()
  roundRectPath(ctx, x, y, width, height, 0)
  ctx.clip()

  const iw = img.naturalWidth
  const ih = img.naturalHeight
  if (node.fit === 'fill' || !node.fit) {
    ctx.drawImage(img, x, y, width, height)
  } else {
    const boxRatio = width / height
    const imgRatio = iw / ih
    let dw = width
    let dh = height
    if (node.fit === 'contain' ? imgRatio > boxRatio : imgRatio < boxRatio) {
      dw = width
      dh = width / imgRatio
    } else {
      dh = height
      dw = height * imgRatio
    }
    const dx = x + (width - dw) / 2
    const dy = y + (height - dh) / 2
    ctx.drawImage(img, dx, dy, dw, dh)
  }
  ctx.restore()
}

function drawText(ctx: AnyCtx, node: EditorNode): void {
  const style = node.textStyle
  if (!style) return
  const color = node.fill.type === 'solid' && node.fill.color ? node.fill.color : '#18181b'

  ctx.save()
  ctx.beginPath()
  ctx.rect(node.x, node.y, node.width, node.height)
  ctx.clip()

  ctx.fillStyle = color
  ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`
  ctx.textBaseline = 'top'
  ctx.textAlign =
    style.textAlign === 'center' ? 'center' : style.textAlign === 'right' ? 'right' : 'left'

  let text = node.text ?? ''
  if (style.textTransform === 'uppercase') text = text.toUpperCase()
  else if (style.textTransform === 'lowercase') text = text.toLowerCase()

  const lineHeight = style.fontSize * style.lineHeight
  const lines = wrapText(ctx, text, node.width)
  const totalHeight = lines.length * lineHeight
  let startY = node.y
  if (style.verticalAlign === 'middle') startY = node.y + (node.height - totalHeight) / 2
  else if (style.verticalAlign === 'bottom') startY = node.y + (node.height - totalHeight)

  const tx =
    style.textAlign === 'center'
      ? node.x + node.width / 2
      : style.textAlign === 'right'
        ? node.x + node.width
        : node.x

  lines.forEach((line, i) => {
    ctx.fillText(line, tx, startY + i * lineHeight)
  })
  ctx.restore()
}
