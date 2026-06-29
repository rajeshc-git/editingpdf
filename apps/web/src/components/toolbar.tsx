'use client'

import { importPdf } from '@/lib/import-pdf'
import { useEditorStore } from '@/store/editor'
import type { Tool } from '@open-pdf/types'
import { FolderOpen, Hand, Image, Loader2, MousePointer2, Redo2, Square, Type, Undo2 } from 'lucide-react'
import { useRef, useState } from 'react'

const tools: { id: Tool; icon: typeof MousePointer2; label: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select (V)' },
  { id: 'frame', icon: Square, label: 'Frame (F)' },
  { id: 'text', icon: Type, label: 'Text (T)' },
  { id: 'image', icon: Image, label: 'Image (I)' },
  { id: 'hand', icon: Hand, label: 'Pan (H)' },
]

export function Toolbar() {
  const { tool, setTool } = useEditorStore()
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)
  const loadDocument = useEditorStore((s) => s.loadDocument)

  const [busy, setBusy] = useState(false)
  const [, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const result = await importPdf(file)
      loadDocument(result.nodes, result.pageWidth, result.pageHeight, result.pages)
      if (result.pageCount > result.importedPages) {
        setError(`Imported first ${result.importedPages} pages of ${result.pageCount}.`)
      }
    } catch (err) {
      console.error(err)
      setError('Could not read that PDF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside
      className="
        flex flex-row items-center gap-0.5 overflow-x-auto
        md:static md:w-12 md:flex-col md:gap-1
        md:overflow-visible md:border-r md:border-neutral-200 md:bg-white md:p-1
        dark:md:border-neutral-800 dark:md:bg-neutral-950
      "
    >
      {/* Import PDF Button */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        title="Open PDF Document"
        aria-label="Open PDF"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-50 md:h-9 md:w-9 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        {busy ? <Loader2 size={16} className="animate-spin md:size-[18px]" /> : <FolderOpen size={16} className="md:size-[18px]" />}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={onImport}
      />

      {/* Separator */}
      <div className="mx-0.5 h-5 w-px shrink-0 bg-neutral-200 md:mx-0 md:my-0.5 md:h-px md:w-6 dark:bg-neutral-700" />

      {tools.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => setTool(id)}
          title={label}
          aria-label={label}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors md:h-9 md:w-9 ${tool === id
            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
            : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
            }`}
        >
          <Icon size={16} className="md:size-[18px]" />
        </button>
      ))}

      {/* Separator */}
      <div className="mx-0.5 h-5 w-px shrink-0 bg-neutral-200 md:mx-0 md:my-0.5 md:h-px md:w-6 dark:bg-neutral-700" />

      {/* Undo / Redo */}
      <button
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent md:h-9 md:w-9 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        <Undo2 size={16} className="md:size-[18px]" />
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent md:h-9 md:w-9 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        <Redo2 size={16} className="md:size-[18px]" />
      </button>
    </aside>
  )
}
