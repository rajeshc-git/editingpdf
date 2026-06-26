import type { BBox, Document, EditorEvent, SceneNode, UUID } from '@open-pdf/types'

// Identity transform matrix
export const IDENTITY_TRANSFORM: [number, number, number, number, number, number] = [
  1, 0, 0, 1, 0, 0,
]

// Spatial indexing using R-tree (simplified implementation)
export class SpatialIndex {
  private nodes: Map<UUID, BBox> = new Map()

  insert(id: UUID, bbox: BBox): void {
    this.nodes.set(id, bbox)
  }

  remove(id: UUID): void {
    this.nodes.delete(id)
  }

  update(id: UUID, bbox: BBox): void {
    this.nodes.set(id, bbox)
  }

  query(bbox: BBox): UUID[] {
    const results: UUID[] = []
    for (const [id, nodeBbox] of this.nodes) {
      if (this.intersects(bbox, nodeBbox)) {
        results.push(id)
      }
    }
    return results
  }

  private intersects(a: BBox, b: BBox): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    )
  }

  clear(): void {
    this.nodes.clear()
  }
}

// Scene graph manager - retains all nodes in memory for fast access
export class SceneGraph {
  private nodes: Map<UUID, SceneNode> = new Map()
  private spatialIndex: SpatialIndex = new SpatialIndex()
  private rootNodes: Set<UUID> = new Set()

  addNode(node: SceneNode): void {
    this.nodes.set(node.id, node)
    this.spatialIndex.insert(node.id, node.bbox)

    if (!node.parentId) {
      this.rootNodes.add(node.id)
    }
  }

  removeNode(id: UUID): void {
    const node = this.nodes.get(id)
    if (!node) return

    // Remove children recursively
    for (const childId of node.children) {
      this.removeNode(childId)
    }

    this.nodes.delete(id)
    this.spatialIndex.remove(id)
    this.rootNodes.delete(id)
  }

  getNode(id: UUID): SceneNode | undefined {
    return this.nodes.get(id)
  }

  updateNode(id: UUID, changes: Partial<SceneNode>): SceneNode | undefined {
    const node = this.nodes.get(id)
    if (!node) return undefined

    const updated = { ...node, ...changes }
    this.nodes.set(id, updated)

    if (changes.bbox) {
      this.spatialIndex.update(id, changes.bbox)
    }

    return updated
  }

  getChildren(id: UUID): SceneNode[] {
    const node = this.nodes.get(id)
    if (!node) return []
    return node.children
      .map((childId: UUID) => this.nodes.get(childId))
      .filter(Boolean) as SceneNode[]
  }

  getRootNodes(): SceneNode[] {
    return Array.from(this.rootNodes)
      .map((id) => this.nodes.get(id))
      .filter(Boolean) as SceneNode[]
  }

  queryBBox(bbox: BBox): UUID[] {
    return this.spatialIndex.query(bbox)
  }

  traverse(callback: (node: SceneNode, depth: number) => void): void {
    const traverseNode = (id: UUID, depth: number) => {
      const node = this.nodes.get(id)
      if (!node) return
      callback(node, depth)
      for (const childId of node.children) {
        traverseNode(childId, depth + 1)
      }
    }

    for (const rootId of this.rootNodes) {
      traverseNode(rootId, 0)
    }
  }

  clear(): void {
    this.nodes.clear()
    this.spatialIndex.clear()
    this.rootNodes.clear()
  }

  get size(): number {
    return this.nodes.size
  }
}

// Command pattern for undo/redo
export interface Command {
  id: UUID
  execute: () => void
  undo: () => void
  description: string
}

export class CommandManager {
  private undoStack: Command[] = []
  private redoStack: Command[] = []
  private maxHistory = 100

  execute(command: Command): void {
    command.execute()
    this.undoStack.push(command)
    this.redoStack = []

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift()
    }
  }

  undo(): Command | undefined {
    const command = this.undoStack.pop()
    if (command) {
      command.undo()
      this.redoStack.push(command)
    }
    return command
  }

  redo(): Command | undefined {
    const command = this.redoStack.pop()
    if (command) {
      command.execute()
      this.undoStack.push(command)
    }
    return command
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}

// Event emitter for reactive updates
type EventListener<T> = (event: T) => void

export class EventEmitter<T extends { type: string }> {
  private listeners: Map<string, Set<EventListener<T>>> = new Map()

  on<K extends T['type']>(type: K, listener: EventListener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(listener)

    return () => this.off(type, listener)
  }

  off<K extends T['type']>(type: K, listener: EventListener<T>): void {
    this.listeners.get(type)?.delete(listener)
  }

  emit(event: T): void {
    this.listeners.get(event.type)?.forEach((listener) => listener(event))
  }

  clear(): void {
    this.listeners.clear()
  }
}

// Generate unique IDs
export function generateId(): UUID {
  return crypto.randomUUID()
}

// Utility to create a default page
export function createDefaultPage(id: UUID = generateId()): SceneNode {
  return {
    id,
    type: 'page',
    name: 'Page 1',
    visible: true,
    locked: false,
    transform: IDENTITY_TRANSFORM,
    bbox: { x: 0, y: 0, width: 595, height: 842 }, // A4 in points
    rotation: 0,
    opacity: 1,
    blendMode: 'normal',
    parentId: null,
    children: [],
    pageSize: { width: 210, height: 297, unit: 'mm' },
    bleed: { top: 3, right: 3, bottom: 3, left: 3 },
    background: { type: 'solid', color: '#ffffff' },
  } as SceneNode
}

// Create a default document
export function createDefaultDocument(): Document {
  const pageId = generateId()
  return {
    id: generateId(),
    name: 'Untitled',
    version: '1.0.0',
    pages: [pageId],
    assets: new Map(),
    created: Date.now(),
    modified: Date.now(),
  }
}

// Export types and utilities
export type { EditorEvent }
