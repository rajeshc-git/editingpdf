import type { Fill, Stroke, TextStyle, Tool, UUID } from '@open-pdf/types'
import { create } from 'zustand'

// A4 page size in points (matches editor-core createDefaultPage)
export const PAGE_WIDTH = 595
export const PAGE_HEIGHT = 842

// Common page presets (in PDF points, 72pt = 1in)
export const PAGE_PRESETS: { id: string; label: string; width: number; height: number }[] = [
  { id: 'a4', label: 'A4', width: 595, height: 842 },
  { id: 'letter', label: 'US Letter', width: 612, height: 792 },
  { id: 'legal', label: 'US Legal', width: 612, height: 1008 },
  { id: 'a3', label: 'A3', width: 842, height: 1191 },
  { id: 'a5', label: 'A5', width: 420, height: 595 },
  { id: 'square', label: 'Square', width: 595, height: 595 },
]

export type EditorNodeType = 'frame' | 'rectangle' | 'ellipse' | 'text' | 'image'

export interface EditorNode {
  id: UUID
  type: EditorNodeType
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  visible: boolean
  locked: boolean
  fill: Fill
  stroke: Stroke | null
  // rectangle / frame
  cornerRadius?: number
  // text
  text?: string
  textStyle?: TextStyle
  // image
  src?: string
  fit?: 'fill' | 'contain' | 'cover'
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: 24,
  fontWeight: 400,
  lineHeight: 1.3,
  letterSpacing: 0,
  textAlign: 'left',
  verticalAlign: 'top',
  textTransform: 'none',
}

let nodeCounter = 0
function nextId(): UUID {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `node-${Date.now()}-${nodeCounter++}`
}

function defaultName(type: EditorNodeType, n: number): string {
  const label =
    type === 'rectangle'
      ? 'Rectangle'
      : type === 'ellipse'
        ? 'Ellipse'
        : type === 'text'
          ? 'Text'
          : type === 'image'
            ? 'Image'
            : 'Frame'
  return `${label} ${n}`
}

export function createNode(
  type: EditorNodeType,
  x: number,
  y: number,
  width: number,
  height: number,
  count: number
): EditorNode {
  const base: EditorNode = {
    id: nextId(),
    type,
    name: defaultName(type, count),
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fill: { type: 'solid', color: '#3b82f6' },
    stroke: null,
  }

  if (type === 'rectangle' || type === 'frame') {
    base.cornerRadius = 0
    if (type === 'frame') {
      base.fill = { type: 'solid', color: '#ffffff' }
      base.stroke = { color: '#d4d4d8', width: 1, position: 'inside' }
    }
  }
  if (type === 'ellipse') {
    base.fill = { type: 'solid', color: '#22c55e' }
  }
  if (type === 'text') {
    base.fill = { type: 'solid', color: '#18181b' }
    base.text = 'Text'
    base.textStyle = { ...DEFAULT_TEXT_STYLE }
  }
  if (type === 'image') {
    base.fill = { type: 'solid', color: '#e4e4e7' }
    base.fit = 'cover'
  }
  return base
}

interface EditorStore {
  // scene
  nodes: EditorNode[]
  selectedIds: UUID[]
  hoveredId: UUID | null
  editingId: UUID | null

  // viewport
  zoom: number
  panX: number
  panY: number
  tool: Tool

  // page size (in PDF points)
  pageWidth: number
  pageHeight: number

  // bumped whenever the document/page changes, so the canvas can re-center
  docVersion: number

  // history
  past: EditorNode[][]
  future: EditorNode[][]

  // counters (for default naming)
  createdCount: number

  // viewport actions
  setTool: (tool: Tool) => void
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  fitToContainer: (containerWidth: number, containerHeight: number) => void

  // document actions
  setPageSize: (width: number, height: number) => void
  newDocument: (opts?: { width?: number; height?: number }) => void
  loadDocument: (nodes: EditorNode[], width: number, height: number) => void

  // history
  pushHistory: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // node actions
  addNode: (node: EditorNode, opts?: { history?: boolean; select?: boolean }) => void
  updateNode: (id: UUID, changes: Partial<EditorNode>) => void
  updateSelected: (changes: Partial<EditorNode>) => void
  moveSelected: (dx: number, dy: number) => void
  deleteSelected: () => void
  duplicateSelected: () => void

  // ordering
  bringToFront: () => void
  sendToBack: () => void
  bringForward: () => void
  sendBackward: () => void

  // selection
  select: (ids: UUID[]) => void
  toggleSelection: (id: UUID) => void
  clearSelection: () => void
  selectAll: () => void
  setHovered: (id: UUID | null) => void

  // editing
  setEditing: (id: UUID | null) => void
}

function clone(nodes: EditorNode[]): EditorNode[] {
  return nodes.map((n) => ({
    ...n,
    fill: { ...n.fill },
    stroke: n.stroke ? { ...n.stroke } : null,
    ...(n.textStyle ? { textStyle: { ...n.textStyle } } : {}),
  }))
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  nodes: [],
  selectedIds: [],
  hoveredId: null,
  editingId: null,

  zoom: 1,
  panX: 60,
  panY: 60,
  tool: 'select',

  pageWidth: PAGE_WIDTH,
  pageHeight: PAGE_HEIGHT,

  docVersion: 0,

  past: [],
  future: [],
  createdCount: 0,

  setTool: (tool) => set({ tool, editingId: null }),
  setZoom: (zoom) => set({ zoom: Math.min(10, Math.max(0.1, zoom)) }),
  setPan: (panX, panY) => set({ panX, panY }),

  // Center the page in the viewport and scale it to fit with a small margin.
  fitToContainer: (cw, ch) =>
    set((s) => {
      if (cw <= 0 || ch <= 0) return s
      const fit = Math.min(cw / s.pageWidth, ch / s.pageHeight) * 0.9
      const zoom = Math.min(10, Math.max(0.1, fit))
      return {
        zoom,
        panX: (cw - s.pageWidth * zoom) / 2,
        panY: (ch - s.pageHeight * zoom) / 2,
      }
    }),

  setPageSize: (width, height) =>
    set((s) => ({
      pageWidth: Math.max(1, width),
      pageHeight: Math.max(1, height),
      docVersion: s.docVersion + 1,
    })),

  newDocument: (opts) =>
    set((s) => ({
      nodes: [],
      selectedIds: [],
      hoveredId: null,
      editingId: null,
      past: [],
      future: [],
      createdCount: 0,
      zoom: 1,
      panX: 60,
      panY: 60,
      tool: 'select',
      pageWidth: opts?.width ?? PAGE_WIDTH,
      pageHeight: opts?.height ?? PAGE_HEIGHT,
      docVersion: s.docVersion + 1,
    })),

  loadDocument: (nodes, width, height) =>
    set((s) => ({
      nodes,
      selectedIds: [],
      hoveredId: null,
      editingId: null,
      past: [],
      future: [],
      createdCount: nodes.length,
      zoom: 1,
      panX: 60,
      panY: 60,
      tool: 'select',
      pageWidth: Math.max(1, width),
      pageHeight: Math.max(1, height),
      docVersion: s.docVersion + 1,
    })),

  pushHistory: () =>
    set((s) => ({
      past: [...s.past, clone(s.nodes)].slice(-100),
      future: [],
    })),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s
      const previous = s.past[s.past.length - 1]
      if (!previous) return s
      const presentIds = new Set(previous.map((n) => n.id))
      return {
        nodes: previous,
        past: s.past.slice(0, -1),
        future: [clone(s.nodes), ...s.future].slice(0, 100),
        selectedIds: s.selectedIds.filter((id) => presentIds.has(id)),
        editingId: null,
      }
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s
      const next = s.future[0]
      if (!next) return s
      const presentIds = new Set(next.map((n) => n.id))
      return {
        nodes: next,
        past: [...s.past, clone(s.nodes)].slice(-100),
        future: s.future.slice(1),
        selectedIds: s.selectedIds.filter((id) => presentIds.has(id)),
        editingId: null,
      }
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  addNode: (node, opts) =>
    set((s) => {
      const withHistory = opts?.history !== false
      const select = opts?.select !== false
      return {
        nodes: [...s.nodes, node],
        past: withHistory ? [...s.past, clone(s.nodes)].slice(-100) : s.past,
        future: withHistory ? [] : s.future,
        selectedIds: select ? [node.id] : s.selectedIds,
        createdCount: s.createdCount + 1,
      }
    }),

  updateNode: (id, changes) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...changes } : n)),
    })),

  updateSelected: (changes) =>
    set((s) => {
      const sel = new Set(s.selectedIds)
      return {
        nodes: s.nodes.map((n) => (sel.has(n.id) ? { ...n, ...changes } : n)),
      }
    }),

  moveSelected: (dx, dy) =>
    set((s) => {
      const sel = new Set(s.selectedIds)
      return {
        nodes: s.nodes.map((n) =>
          sel.has(n.id) && !n.locked ? { ...n, x: n.x + dx, y: n.y + dy } : n
        ),
      }
    }),

  deleteSelected: () =>
    set((s) => {
      if (s.selectedIds.length === 0) return s
      const sel = new Set(s.selectedIds)
      return {
        past: [...s.past, clone(s.nodes)].slice(-100),
        future: [],
        nodes: s.nodes.filter((n) => !sel.has(n.id)),
        selectedIds: [],
        editingId: null,
      }
    }),

  duplicateSelected: () =>
    set((s) => {
      if (s.selectedIds.length === 0) return s
      const sel = new Set(s.selectedIds)
      const copies: EditorNode[] = s.nodes
        .filter((n) => sel.has(n.id))
        .map((n) => {
          const c = clone([n])[0]!
          return {
            ...c,
            id: nextId(),
            name: `${n.name} copy`,
            x: n.x + 16,
            y: n.y + 16,
          }
        })
      return {
        past: [...s.past, clone(s.nodes)].slice(-100),
        future: [],
        nodes: [...s.nodes, ...copies],
        selectedIds: copies.map((c) => c.id),
      }
    }),

  bringToFront: () =>
    set((s) => {
      const sel = new Set(s.selectedIds)
      const kept = s.nodes.filter((n) => !sel.has(n.id))
      const moved = s.nodes.filter((n) => sel.has(n.id))
      if (moved.length === 0) return s
      return {
        past: [...s.past, clone(s.nodes)].slice(-100),
        future: [],
        nodes: [...kept, ...moved],
      }
    }),

  sendToBack: () =>
    set((s) => {
      const sel = new Set(s.selectedIds)
      const kept = s.nodes.filter((n) => !sel.has(n.id))
      const moved = s.nodes.filter((n) => sel.has(n.id))
      if (moved.length === 0) return s
      return {
        past: [...s.past, clone(s.nodes)].slice(-100),
        future: [],
        nodes: [...moved, ...kept],
      }
    }),

  bringForward: () =>
    set((s) => {
      const arr = [...s.nodes]
      const sel = new Set(s.selectedIds)
      for (let i = arr.length - 2; i >= 0; i--) {
        const a = arr[i]
        const b = arr[i + 1]
        if (a && b && sel.has(a.id) && !sel.has(b.id)) {
          arr[i] = b
          arr[i + 1] = a
        }
      }
      return { past: [...s.past, clone(s.nodes)].slice(-100), future: [], nodes: arr }
    }),

  sendBackward: () =>
    set((s) => {
      const arr = [...s.nodes]
      const sel = new Set(s.selectedIds)
      for (let i = 1; i < arr.length; i++) {
        const a = arr[i]
        const b = arr[i - 1]
        if (a && b && sel.has(a.id) && !sel.has(b.id)) {
          arr[i] = b
          arr[i - 1] = a
        }
      }
      return { past: [...s.past, clone(s.nodes)].slice(-100), future: [], nodes: arr }
    }),

  select: (ids) => set({ selectedIds: ids }),
  toggleSelection: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),
  clearSelection: () => set({ selectedIds: [], editingId: null }),
  selectAll: () => set((s) => ({ selectedIds: s.nodes.map((n) => n.id) })),
  setHovered: (id) => set({ hoveredId: id }),

  setEditing: (id) => set({ editingId: id }),
}))
