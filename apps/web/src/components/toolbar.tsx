'use client'

import { useEditorStore } from '@/store/editor'
import type { Tool } from '@open-pdf/types'
import { Circle, Hand, Image, MousePointer2, Square, Type } from 'lucide-react'

const tools: { id: Tool; icon: typeof MousePointer2; label: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select' },
  { id: 'frame', icon: Square, label: 'Frame' },
  { id: 'rectangle', icon: Square, label: 'Rectangle' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'image', icon: Image, label: 'Image' },
  { id: 'hand', icon: Hand, label: 'Hand' },
]

export function Toolbar() {
  const { tool, setTool } = useEditorStore()

  return (
    <aside
      className="
        absolute bottom-3 left-1/2 z-20 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-row items-center gap-1
        overflow-x-auto rounded-2xl border border-neutral-200 bg-white/95 p-1.5 shadow-lg backdrop-blur safe-bottom
        md:static md:bottom-auto md:left-auto md:w-12 md:max-w-none md:translate-x-0 md:flex-col md:gap-1
        md:overflow-visible md:rounded-none md:border-0 md:border-r md:bg-white md:p-1 md:shadow-none md:backdrop-blur-none
        dark:border-neutral-800 dark:bg-neutral-950/95 md:dark:bg-neutral-950
      "
    >
      {tools.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => setTool(id)}
          title={label}
          aria-label={label}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors md:h-9 md:w-9 ${
            tool === id
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
          }`}
        >
          <Icon size={18} />
        </button>
      ))}
    </aside>
  )
}
