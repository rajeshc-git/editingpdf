'use client'

import { drawNode, loadImage } from '@/lib/render'
import {
  createNode,
  useEditorStore,
  PAGE_GAP,
  type EditorNode,
} from '@/store/editor'
import type { Tool } from '@open-pdf/types'
import { Maximize2, Minus, Pencil, Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const HANDLE_SIZE = 8
const HANDLE_HIT = 10
const MIN_SIZE = 2

// Handle order: nw, n, ne, e, se, s, sw, w
const HANDLE_DEFS = [
  { fx: 0, fy: 0 },
  { fx: 0.5, fy: 0 },
  { fx: 1, fy: 0 },
  { fx: 1, fy: 0.5 },
  { fx: 1, fy: 1 },
  { fx: 0.5, fy: 1 },
  { fx: 0, fy: 1 },
  { fx: 0, fy: 0.5 },
]
const HANDLE_CURSORS = [
  'nwse-resize',
  'ns-resize',
  'nesw-resize',
  'ew-resize',
  'nwse-resize',
  'ns-resize',
  'nesw-resize',
  'ew-resize',
]

const CREATE_TOOLS: Tool[] = ['rectangle', 'ellipse', 'frame']

type InteractionMode = 'idle' | 'create' | 'move' | 'resize' | 'marquee' | 'pan'

interface Interaction {
  mode: InteractionMode
  startWorld: { x: number; y: number }
  lastWorld: { x: number; y: number }
  startScreen: { x: number; y: number }
  startPan: { x: number; y: number }
  handleIndex: number
  createId: string | null
  origin: EditorNode[] // snapshot of nodes being resized
  historyPushed: boolean
  marquee: { x: number; y: number; w: number; h: number } | null
}

function freshInteraction(): Interaction {
  return {
    mode: 'idle',
    startWorld: { x: 0, y: 0 },
    lastWorld: { x: 0, y: 0 },
    startScreen: { x: 0, y: 0 },
    startPan: { x: 0, y: 0 },
    handleIndex: -1,
    createId: null,
    origin: [],
    historyPushed: false,
    marquee: null,
  }
}

function pointInNode(px: number, py: number, n: EditorNode): boolean {
  // Hit-test in node-local space to respect rotation
  const cx = n.x + n.width / 2
  const cy = n.y + n.height / 2
  let lx = px
  let ly = py
  if (n.rotation) {
    const rad = (-n.rotation * Math.PI) / 180
    const dx = px - cx
    const dy = py - cy
    lx = cx + dx * Math.cos(rad) - dy * Math.sin(rad)
    ly = cy + dx * Math.sin(rad) + dy * Math.cos(rad)
  }
  return lx >= n.x && lx <= n.x + n.width && ly >= n.y && ly <= n.y + n.height
}

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const interaction = useRef<Interaction>(freshInteraction())
  const pendingImagePoint = useRef<{ x: number; y: number } | null>(null)
  // Multi-touch (pinch-zoom / two-finger pan) state
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const gesture = useRef<{
    dist: number
    zoom: number
    panX: number
    panY: number
    worldX: number
    worldY: number
  } | null>(null)

  const [cursor, setCursor] = useState('default')
  const [activePage, setActivePage] = useState(0)

  const editingId = useEditorStore((s) => s.editingId)
  const nodes = useEditorStore((s) => s.nodes)
  const zoom = useEditorStore((s) => s.zoom)
  const panX = useEditorStore((s) => s.panX)
  const panY = useEditorStore((s) => s.panY)
  const docVersion = useEditorStore((s) => s.docVersion)
  const pages = useEditorStore((s) => s.pages)

  // Track active page based on vertical viewport intersection
  useEffect(() => {
    if (pages.length <= 1) return

    let cumulativeHeight = 0
    let detectedIndex = 0
    const el = containerRef.current
    const viewportCenter = el ? el.clientHeight / 2 : 300
    
    let minDistance = Infinity
    for (let i = 0; i < pages.length; i++) {
      const pg = pages[i]!
      const pageHeight = pg.height
      const pageCenterWorld = cumulativeHeight + pageHeight / 2
      const pageCenterScreen = pageCenterWorld * zoom + panY
      const dist = Math.abs(pageCenterScreen - viewportCenter)
      if (dist < minDistance) {
        minDistance = dist
        detectedIndex = i
      }
      cumulativeHeight += pageHeight + PAGE_GAP
    }
    setActivePage(detectedIndex)
  }, [panY, zoom, pages])

  // Convert a pointer event to world (page) coordinates
  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect()
    const s = useEditorStore.getState()
    return {
      x: (clientX - rect.left - s.panX) / s.zoom,
      y: (clientY - rect.top - s.panY) / s.zoom,
    }
  }, [])

  const handleAt = useCallback((world: { x: number; y: number }, n: EditorNode) => {
    const s = useEditorStore.getState()
    for (let i = 0; i < HANDLE_DEFS.length; i++) {
      const def = HANDLE_DEFS[i]
      if (!def) continue
      const hx = n.x + def.fx * n.width
      const hy = n.y + def.fy * n.height
      if (
        Math.abs((world.x - hx) * s.zoom) <= HANDLE_HIT &&
        Math.abs((world.y - hy) * s.zoom) <= HANDLE_HIT
      ) {
        return i
      }
    }
    return -1
  }, [])

  const hitTest = useCallback((world: { x: number; y: number }): EditorNode | null => {
    const list = useEditorStore.getState().nodes
    for (let i = list.length - 1; i >= 0; i--) {
      const n = list[i]
      if (!n || !n.visible || n.locked) continue
      if (pointInNode(world.x, world.y, n)) return n
    }
    return null
  }, [])

  // ---- Render loop ---------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    const render = () => {
      const s = useEditorStore.getState()
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const w = rect.width
      const h = rect.height
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr)
        canvas.height = Math.floor(h * dpr)
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // Backdrop
      ctx.fillStyle = '#18181b'
      ctx.fillRect(0, 0, w, h)

      // Grid
      const gridSize = 20 * s.zoom
      if (gridSize > 4) {
        ctx.strokeStyle = 'rgba(255,255,255,0.04)'
        ctx.lineWidth = 1
        const ox = s.panX % gridSize
        const oy = s.panY % gridSize
        ctx.beginPath()
        for (let x = ox; x < w; x += gridSize) {
          ctx.moveTo(x, 0)
          ctx.lineTo(x, h)
        }
        for (let y = oy; y < h; y += gridSize) {
          ctx.moveTo(0, y)
          ctx.lineTo(w, y)
        }
        ctx.stroke()
      }

      // World space
      ctx.save()
      ctx.translate(s.panX, s.panY)
      ctx.scale(s.zoom, s.zoom)

      // Draw each page as a separate white rectangle with shadow
      let pageY = 0
      for (let i = 0; i < s.pages.length; i++) {
        const pg = s.pages[i]!
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.35)'
        ctx.shadowBlur = 20
        ctx.shadowOffsetY = 4
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, pageY, pg.width, pg.height)
        ctx.restore()
        pageY += pg.height + PAGE_GAP
      }

      // Clip node content to each page and draw nodes
      ctx.save()
      ctx.beginPath()
      pageY = 0
      for (let i = 0; i < s.pages.length; i++) {
        const pg = s.pages[i]!
        ctx.rect(0, pageY, pg.width, pg.height)
        pageY += pg.height + PAGE_GAP
      }
      ctx.clip()
      for (const node of s.nodes) {
        if (node.id === s.editingId && node.type === 'text') continue // hidden while editing
        drawNode(ctx, node)
      }
      ctx.restore()

      ctx.restore() // exit world space

      // ---- Overlays (screen space) ----
      const toScreen = (wx: number, wy: number) => ({
        x: wx * s.zoom + s.panX,
        y: wy * s.zoom + s.panY,
      })

      // Hover outline
      if (s.hoveredId && !s.selectedIds.includes(s.hoveredId)) {
        const n = s.nodes.find((x) => x.id === s.hoveredId)
        if (n) {
          const tl = toScreen(n.x, n.y)
          ctx.strokeStyle = '#6366f1'
          ctx.lineWidth = 1.5
          ctx.strokeRect(tl.x, tl.y, n.width * s.zoom, n.height * s.zoom)
        }
      }

      // Selection outlines + handles
      const selected = s.nodes.filter((n) => s.selectedIds.includes(n.id))
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 1.5
      for (const n of selected) {
        const tl = toScreen(n.x, n.y)
        ctx.strokeRect(tl.x, tl.y, n.width * s.zoom, n.height * s.zoom)
      }
      if (selected.length === 1 && selected[0]) {
        const n = selected[0]
        for (const def of HANDLE_DEFS) {
          const p = toScreen(n.x + def.fx * n.width, n.y + def.fy * n.height)
          ctx.fillStyle = '#ffffff'
          ctx.strokeStyle = '#3b82f6'
          ctx.lineWidth = 1.5
          ctx.fillRect(p.x - HANDLE_SIZE / 2, p.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
          ctx.strokeRect(p.x - HANDLE_SIZE / 2, p.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
        }
      }

      // Marquee
      const m = interaction.current.marquee
      if (m) {
        const tl = toScreen(m.x, m.y)
        ctx.fillStyle = 'rgba(59,130,246,0.12)'
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 1
        ctx.fillRect(tl.x, tl.y, m.w * s.zoom, m.h * s.zoom)
        ctx.strokeRect(tl.x, tl.y, m.w * s.zoom, m.h * s.zoom)
      }

      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [])

  // ---- Center & fit the page in the viewport -------------------------------
  // Default view is centered on every device. We fit once on first layout
  // (ResizeObserver handles mobile where the first measurement may be 0),
  // and again whenever the document/page size changes — but NOT on every
  // resize, so an on-screen keyboard or later zoom doesn't reset the view.
  const didInitialFit = useRef(false)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const tryFit = () => {
      if (didInitialFit.current) return
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        useEditorStore.getState().fitToContainer(r.width, r.height)
        didInitialFit.current = true
      }
    }
    const ro = new ResizeObserver(tryFit)
    ro.observe(el)
    tryFit()
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) {
      useEditorStore.getState().fitToContainer(r.width, r.height)
    }
  }, [docVersion])

  // ---- Wheel: zoom (ctrl) / pan -------------------------------------------
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = useEditorStore.getState()
      if (e.ctrlKey || e.metaKey) {
        const rect = container.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        const delta = e.deltaY > 0 ? 0.9 : 1.1
        const newZoom = Math.min(10, Math.max(0.1, s.zoom * delta))
        // zoom toward cursor
        const wx = (mx - s.panX) / s.zoom
        const wy = (my - s.panY) / s.zoom
        s.setZoom(newZoom)
        s.setPan(mx - wx * newZoom, my - wy * newZoom)
      } else {
        s.setPan(s.panX - e.deltaX, s.panY - e.deltaY)
      }
    }
    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [])

  // ---- Pointer interaction -------------------------------------------------
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1) return

      // Track touch pointers for pinch / two-finger pan
      if (e.pointerType === 'touch') {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (pointers.current.size >= 2) {
          // Second finger down -> cancel any single-finger interaction and start a gesture
          interaction.current = freshInteraction()
          setCursor('default')
          const pts = [...pointers.current.values()]
          const a = pts[0]!
          const b = pts[1]!
          const s = useEditorStore.getState()
          const rect = containerRef.current!.getBoundingClientRect()
          const cx = (a.x + b.x) / 2 - rect.left
          const cy = (a.y + b.y) / 2 - rect.top
          gesture.current = {
            dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
            zoom: s.zoom,
            panX: s.panX,
            panY: s.panY,
            worldX: (cx - s.panX) / s.zoom,
            worldY: (cy - s.panY) / s.zoom,
          }
          return
        }
      }

      const s = useEditorStore.getState()
      const world = toWorld(e.clientX, e.clientY)
      const it = (interaction.current = freshInteraction())
      it.startWorld = world
      it.lastWorld = world
      it.startScreen = { x: e.clientX, y: e.clientY }
      it.startPan = { x: s.panX, y: s.panY }
      ;(e.target as Element).setPointerCapture?.(e.pointerId)

      const middleOrSpace = e.button === 1
      if (s.tool === 'hand' || middleOrSpace) {
        it.mode = 'pan'
        return
      }

      if (s.tool === 'text') {
        const node = createNode('text', world.x, world.y, 200, 40, s.createdCount + 1)
        s.addNode(node)
        s.setTool('select')
        s.setEditing(node.id)
        it.mode = 'idle'
        return
      }

      if (s.tool === 'image') {
        pendingImagePoint.current = world
        fileInputRef.current?.click()
        it.mode = 'idle'
        return
      }

      if (CREATE_TOOLS.includes(s.tool)) {
        const type = s.tool === 'ellipse' ? 'ellipse' : s.tool === 'frame' ? 'frame' : 'rectangle'
        const node = createNode(type, world.x, world.y, 0, 0, s.createdCount + 1)
        s.addNode(node) // pushes history + selects
        it.createId = node.id
        it.mode = 'create'
        it.historyPushed = true
        return
      }

      // select tool
      const single =
        s.selectedIds.length === 1 ? s.nodes.find((n) => n.id === s.selectedIds[0]) : null
      if (single) {
        const hi = handleAt(world, single)
        if (hi !== -1) {
          it.mode = 'resize'
          it.handleIndex = hi
          it.origin = [{ ...single }]
          return
        }
      }

      const hit = hitTest(world)
      if (hit) {
        if (e.shiftKey) {
          s.toggleSelection(hit.id)
        } else if (s.selectedIds.includes(hit.id) && s.selectedIds.length === 1 && hit.type === 'text') {
          // Single click on already-selected text node → enter edit mode
          s.setEditing(hit.id)
          it.mode = 'idle'
          return
        } else if (!s.selectedIds.includes(hit.id)) {
          s.select([hit.id])
        }
        it.mode = 'move'
      } else {
        if (!e.shiftKey) s.clearSelection()
        it.mode = 'marquee'
      }
    },
    [toWorld, handleAt, hitTest]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Pinch-zoom / two-finger pan
      if (e.pointerType === 'touch' && pointers.current.has(e.pointerId)) {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      }
      if (pointers.current.size >= 2 && gesture.current) {
        const pts = [...pointers.current.values()]
        const a = pts[0]!
        const b = pts[1]!
        const rect = containerRef.current!.getBoundingClientRect()
        const cx = (a.x + b.x) / 2 - rect.left
        const cy = (a.y + b.y) / 2 - rect.top
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
        const g = gesture.current
        const s = useEditorStore.getState()
        const newZoom = Math.min(10, Math.max(0.1, (g.zoom * dist) / g.dist))
        s.setZoom(newZoom)
        // Keep the world point that was under the gesture midpoint anchored to the moving midpoint
        s.setPan(cx - g.worldX * newZoom, cy - g.worldY * newZoom)
        return
      }

      const s = useEditorStore.getState()
      const it = interaction.current
      const world = toWorld(e.clientX, e.clientY)

      // Cursor feedback when idle
      if (it.mode === 'idle') {
        let c = 'default'
        if (s.tool === 'hand') c = 'grab'
        else if (CREATE_TOOLS.includes(s.tool) || s.tool === 'text' || s.tool === 'image')
          c = 'crosshair'
        else {
          const single =
            s.selectedIds.length === 1 ? s.nodes.find((n) => n.id === s.selectedIds[0]) : null
          const hi = single ? handleAt(world, single) : -1
          if (hi !== -1) c = HANDLE_CURSORS[hi] ?? 'default'
          else {
            const hov = hitTest(world)
            s.setHovered(hov?.id ?? null)
            if (hov) {
              c = hov.type === 'text' ? 'text' : 'pointer'
            }
          }
        }
        setCursor(c)
        return
      }

      if (it.mode === 'pan') {
        s.setPan(
          it.startPan.x + (e.clientX - it.startScreen.x),
          it.startPan.y + (e.clientY - it.startScreen.y)
        )
        return
      }

      if (it.mode === 'create' && it.createId) {
        const x = Math.min(it.startWorld.x, world.x)
        const y = Math.min(it.startWorld.y, world.y)
        const width = Math.abs(world.x - it.startWorld.x)
        const height = Math.abs(world.y - it.startWorld.y)
        s.updateNode(it.createId, { x, y, width, height })
        return
      }

      if (it.mode === 'move') {
        if (!it.historyPushed) {
          s.pushHistory()
          it.historyPushed = true
        }
        const dx = world.x - it.lastWorld.x
        const dy = world.y - it.lastWorld.y
        s.moveSelected(dx, dy)
        it.lastWorld = world
        return
      }

      if (it.mode === 'resize') {
        const o = it.origin[0]
        const def = HANDLE_DEFS[it.handleIndex]
        if (!o || !def) return
        if (!it.historyPushed) {
          s.pushHistory()
          it.historyPushed = true
        }
        let left = o.x
        let top = o.y
        let right = o.x + o.width
        let bottom = o.y + o.height
        if (def.fx === 0) left = world.x
        if (def.fx === 1) right = world.x
        if (def.fy === 0) top = world.y
        if (def.fy === 1) bottom = world.y
        const nx = Math.min(left, right)
        const ny = Math.min(top, bottom)
        const nw = Math.max(MIN_SIZE, Math.abs(right - left))
        const nh = Math.max(MIN_SIZE, Math.abs(bottom - top))
        s.updateNode(o.id, { x: nx, y: ny, width: nw, height: nh })
        return
      }

      if (it.mode === 'marquee') {
        const x = Math.min(it.startWorld.x, world.x)
        const y = Math.min(it.startWorld.y, world.y)
        const w = Math.abs(world.x - it.startWorld.x)
        const h = Math.abs(world.y - it.startWorld.y)
        it.marquee = { x, y, w, h }
        const ids = s.nodes
          .filter(
            (n) =>
              n.visible &&
              !n.locked &&
              n.x < x + w &&
              n.x + n.width > x &&
              n.y < y + h &&
              n.y + n.height > y
          )
          .map((n) => n.id)
        s.select(ids)
        return
      }
    },
    [toWorld, handleAt, hitTest]
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const s = useEditorStore.getState()
    const it = interaction.current
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)

    if (e.pointerType === 'touch') {
      pointers.current.delete(e.pointerId)
      if (pointers.current.size < 2) gesture.current = null
      // If a gesture just ended (one finger lifted), skip click handling
      if (pointers.current.size >= 1) {
        interaction.current = freshInteraction()
        return
      }
    }

    if (it.mode === 'create' && it.createId) {
      const node = s.nodes.find((n) => n.id === it.createId)
      if (node && (node.width < 3 || node.height < 3)) {
        // Treat as a click: give a default size
        s.updateNode(it.createId, {
          x: it.startWorld.x,
          y: it.startWorld.y,
          width: 120,
          height: node.type === 'ellipse' ? 120 : 80,
        })
      }
      s.setTool('select')
      s.select([it.createId])
    }

    if (it.mode === 'marquee') it.marquee = null
    interaction.current = freshInteraction()
  }, [])

  // ---- Image file input ----------------------------------------------------
  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const src = reader.result as string
      const s = useEditorStore.getState()
      const point = pendingImagePoint.current ?? { x: s.pageWidth / 2, y: s.pageHeight / 2 }
      try {
        const img = await loadImage(src)
        const maxW = s.pageWidth * 0.6
        const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1
        const w = img.naturalWidth * scale
        const h = img.naturalHeight * scale
        const node = createNode('image', point.x, point.y, w, h, s.createdCount + 1)
        node.src = src
        s.addNode(node)
      } catch {
        // ignore decode errors
      }
      s.setTool('select')
    }
    reader.readAsDataURL(file)
  }, [])

  // Double-click a text node to edit it
  const onDoubleClick = useCallback(
    (e: React.PointerEvent) => {
      const s = useEditorStore.getState()
      const world = toWorld(e.clientX, e.clientY)
      const hit = hitTest(world)
      if (hit && hit.type === 'text') {
        s.select([hit.id])
        s.setEditing(hit.id)
      }
    },
    [toWorld, hitTest]
  )

  const editingNode = editingId ? nodes.find((n) => n.id === editingId) : null

  // Compute the selected node for the floating "Edit" button
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const selectedNode =
    selectedIds.length === 1 && !editingId
      ? nodes.find((n) => n.id === selectedIds[0])
      : null

  // ---- Zoom controls (anchored to the viewport center) ---------------------
  const zoomByFactor = useCallback((factor: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const s = useEditorStore.getState()
    const cx = rect.width / 2
    const cy = rect.height / 2
    const newZoom = Math.min(10, Math.max(0.1, s.zoom * factor))
    const wx = (cx - s.panX) / s.zoom
    const wy = (cy - s.panY) / s.zoom
    s.setZoom(newZoom)
    s.setPan(cx - wx * newZoom, cy - wy * newZoom)
  }, [])

  const fitView = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    useEditorStore.getState().fitToContainer(r.width, r.height)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden canvas-container"
      style={{ cursor, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick as unknown as React.MouseEventHandler}
    >
      <canvas ref={canvasRef} className="h-full w-full touch-none" />

      {/* Floating page indicator for multi-page documents */}
      {pages.length > 1 && (
        <div className="absolute top-3 left-3 z-20 rounded-md bg-neutral-900/80 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur dark:bg-black/60 shadow">
          Page {activePage + 1} / {pages.length}
        </div>
      )}

      {/* Zoom controls. On mobile the toolbar is pinned bottom-center and spans
          nearly full width, so lift the zoom panel above it (plus the device
          safe-area inset). On desktop the toolbar is a left sidebar, so the
          panel rests in the bottom-right corner. */}
      <div
        className="absolute bottom-3 right-3 z-20 flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-white/95 p-0.5 shadow-md backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95"
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => zoomByFactor(1 / 1.2)}
          title="Zoom out"
          aria-label="Zoom out"
          className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={fitView}
          title="Fit to screen"
          aria-label="Fit to screen"
          className="min-w-[3.25rem] rounded-md px-1 text-center text-xs font-medium tabular-nums text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => zoomByFactor(1.2)}
          title="Zoom in"
          aria-label="Zoom in"
          className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={fitView}
          title="Reset / fit"
          aria-label="Reset and fit to screen"
          className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <Maximize2 size={15} />
        </button>
      </div>

      {/* Floating "Edit" button — appears on the selected node */}
      {selectedNode && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            const s = useEditorStore.getState()
            if (selectedNode.type === 'text') {
              s.setEditing(selectedNode.id)
            }
            // For images, the sidebar already has properties.
            // For other types, selecting is enough to edit via sidebar.
          }}
          className="absolute z-30 flex items-center gap-1.5 rounded-full bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg transition-all hover:bg-blue-600 active:scale-95"
          style={{
            left: selectedNode.x * zoom + panX + selectedNode.width * zoom / 2,
            top: selectedNode.y * zoom + panY - 36,
            transform: 'translateX(-50%)',
          }}
        >
          <Pencil size={12} />
          {selectedNode.type === 'text'
            ? 'Edit text'
            : selectedNode.type === 'image'
              ? 'Edit image'
              : 'Edit'}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      {editingNode && editingNode.type === 'text' && editingNode.textStyle && (
        <textarea
          autoFocus
          wrap="off"
          value={editingNode.text ?? ''}
          onChange={(ev) =>
            useEditorStore.getState().updateNode(editingNode.id, { text: ev.target.value })
          }
          onBlur={() => useEditorStore.getState().setEditing(null)}
          onKeyDown={(ev) => {
            if (ev.key === 'Escape') {
              ev.preventDefault()
              useEditorStore.getState().setEditing(null)
            }
            ev.stopPropagation()
          }}
          spellCheck={false}
          className="absolute resize-none overflow-hidden border-2 border-blue-500 bg-transparent p-0 outline-none"
          style={{
            left: editingNode.x * zoom + panX,
            top: editingNode.y * zoom + panY,
            width: editingNode.width * zoom,
            height: editingNode.height * zoom,
            fontFamily: editingNode.textStyle.fontFamily,
            fontSize: editingNode.textStyle.fontSize * zoom,
            fontWeight: editingNode.textStyle.fontWeight,
            lineHeight: editingNode.textStyle.lineHeight,
            textAlign: editingNode.textStyle.textAlign as React.CSSProperties['textAlign'],
            whiteSpace: 'pre',
            color:
              editingNode.fill.type === 'solid' && editingNode.fill.color
                ? editingNode.fill.color
                : '#18181b',
          }}
        />
      )}
    </div>
  )
}
