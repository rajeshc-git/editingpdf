// Core editor types for the scene graph architecture

export type UUID = string

// Bounding box for spatial indexing
export interface BBox {
  x: number
  y: number
  width: number
  height: number
}

// Transform matrix (2D affine)
export type Transform = [
  number,
  number, // a, b
  number,
  number, // c, d
  number,
  number, // e, f
]

// Base node in scene graph
export interface SceneNode {
  id: UUID
  type: NodeType
  name: string
  visible: boolean
  locked: boolean
  transform: Transform
  bbox: BBox
  rotation: number
  opacity: number
  blendMode: BlendMode
  parentId: UUID | null
  children: UUID[]
}

export type NodeType =
  | 'frame'
  | 'page'
  | 'text'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'image'
  | 'group'
  | 'table'

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'

// Specific node types
export interface FrameNode extends SceneNode {
  type: 'frame'
  fill: Fill
  stroke: Stroke | null
  effects: Effect[]
}

export interface PageNode extends SceneNode {
  type: 'page'
  pageSize: PageSize
  bleed: Spacing
  background: Fill
}

export interface TextNode extends SceneNode {
  type: 'text'
  content: TextContent
  textStyle: TextStyle
  fill: Fill
}

export interface RectangleNode extends SceneNode {
  type: 'rectangle'
  fill: Fill
  stroke: Stroke | null
  cornerRadius: number
}

export interface EllipseNode extends SceneNode {
  type: 'ellipse'
  fill: Fill
  stroke: Stroke | null
}

export interface ImageNode extends SceneNode {
  type: 'image'
  src: string
  naturalWidth: number
  naturalHeight: number
  fit: 'fill' | 'contain' | 'cover'
}

export interface GroupNode extends SceneNode {
  type: 'group'
}

// Styling
export interface Fill {
  type: 'solid' | 'gradient' | 'image'
  color?: string
  gradient?: Gradient
  imageSrc?: string
}

export interface Stroke {
  color: string
  width: number
  position: 'inside' | 'center' | 'outside'
}

export interface Effect {
  type: 'shadow' | 'blur'
  offsetX?: number
  offsetY?: number
  blur?: number
  color?: string
}

export interface Gradient {
  type: 'linear' | 'radial'
  stops: GradientStop[]
}

export interface GradientStop {
  position: number
  color: string
}

// Typography
export interface TextStyle {
  fontFamily: string
  fontSize: number
  fontWeight: number
  lineHeight: number
  letterSpacing: number
  textAlign: 'left' | 'center' | 'right' | 'justify'
  verticalAlign: 'top' | 'middle' | 'bottom'
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
}

export interface TextContent {
  text: string
  spans?: TextSpan[]
}

export interface TextSpan {
  start: number
  end: number
  style: Partial<TextStyle>
}

// Layout
export interface PageSize {
  width: number
  height: number
  unit: 'px' | 'mm' | 'in' | 'pt'
}

export interface Spacing {
  top: number
  right: number
  bottom: number
  left: number
}

// Document structure
export interface Document {
  id: UUID
  name: string
  version: string
  pages: UUID[]
  assets: Map<string, Asset>
  created: number
  modified: number
}

export interface Asset {
  id: UUID
  name: string
  type: 'image' | 'font'
  src: string
  size: number
}

// Editor state
export interface EditorState {
  documentId: UUID | null
  currentPageId: UUID | null
  selectedIds: UUID[]
  hoveredId: UUID | null
  zoom: number
  panX: number
  panY: number
  tool: Tool
  mode: EditorMode
  history: HistoryState
  clipboard: ClipboardData | null
}

export type Tool = 'select' | 'frame' | 'rectangle' | 'ellipse' | 'text' | 'image' | 'hand' | 'zoom'

export type EditorMode = 'design' | 'prototype' | 'export'

export interface HistoryState {
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  maxHistory: number
}

export interface HistoryEntry {
  id: UUID
  timestamp: number
  action: string
  before: Partial<EditorState>
  after: Partial<EditorState>
}

export interface ClipboardData {
  type: 'nodes' | 'text' | 'image'
  nodes?: SceneNode[]
  text?: string
  image?: string
}

// Events
export type EditorEvent =
  | { type: 'node:create'; node: SceneNode }
  | { type: 'node:update'; id: UUID; changes: Partial<SceneNode> }
  | { type: 'node:delete'; id: UUID }
  | { type: 'selection:change'; ids: UUID[] }
  | { type: 'page:change'; id: UUID }
  | { type: 'zoom:change'; level: number }
  | { type: 'pan:change'; x: number; y: number }
  | { type: 'tool:change'; tool: Tool }

// API types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ExportOptions {
  format: 'pdf' | 'svg' | 'png'
  quality: 'low' | 'medium' | 'high' | 'print'
  pages: UUID[]
  includeBleed: boolean
  flatten: boolean
}

export interface ExportResult {
  url: string
  filename: string
  size: number
}
