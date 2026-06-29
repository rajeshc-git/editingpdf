'use client'

import { exportPDF, exportPNG } from '@/lib/export'
import { useEditorStore } from '@/store/editor'
import type { Tool } from '@open-pdf/types'
import { PanelRight, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Canvas } from './canvas'
import { LegalLinks } from './legal'
import { Logo } from './logo'
import { Sidebar } from './sidebar'
import { Thumbnails } from './thumbnails'
import { Toolbar } from './toolbar'

const SHORTCUT_TOOLS: Record<string, Tool> = {
  v: 'select',
  t: 'text',
  i: 'image',
  h: 'hand',
}

export function Editor() {
  const [exporting, setExporting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      const s = useEditorStore.getState()
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        s.redo()
        return
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        s.selectAll()
        return
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        s.duplicateSelected()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selectedIds.length) {
          e.preventDefault()
          s.deleteSelected()
        }
        return
      }
      if (e.key === 'Escape') {
        s.clearSelection()
        return
      }
      // Arrow-key nudge
      if (e.key.startsWith('Arrow') && s.selectedIds.length) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        s.pushHistory()
        if (e.key === 'ArrowLeft') s.moveSelected(-step, 0)
        if (e.key === 'ArrowRight') s.moveSelected(step, 0)
        if (e.key === 'ArrowUp') s.moveSelected(0, -step)
        if (e.key === 'ArrowDown') s.moveSelected(0, step)
        return
      }
      // Z-order
      if (e.key === ']') {
        s.bringForward()
        return
      }
      if (e.key === '[') {
        s.sendBackward()
        return
      }
      // Tool shortcuts
      const t = SHORTCUT_TOOLS[e.key.toLowerCase()]
      if (t && !mod) {
        s.setTool(t)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const runExport = async (kind: 'pdf' | 'png') => {
    setMenuOpen(false)
    setExporting(true)
    try {
      const nodes = useEditorStore.getState().nodes
      if (kind === 'pdf') await exportPDF(nodes)
      else await exportPNG(nodes)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-neutral-100 dark:bg-neutral-900">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-3 sm:px-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center gap-4">
          <Logo />
        </div>
        <div className="relative flex items-center gap-2">
          <button
            disabled={exporting}
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 sm:px-4 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
          >
            {exporting ? 'Exporting…' : 'Export'}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
              <button
                onClick={() => runExport('pdf')}
                className="block w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Export as PDF
              </button>
              <button
                onClick={() => runExport('png')}
                className="block w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Export as PNG
              </button>
              <div className="border-t border-neutral-200 px-3 py-2 dark:border-neutral-800">
                <LegalLinks />
              </div>
            </div>
          )}
          {/* Properties drawer toggle — mobile only */}
          <button
            onClick={() => setPanelOpen((o) => !o)}
            title="Toggle properties"
            aria-label="Toggle properties panel"
            className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 md:hidden dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            {panelOpen ? <X size={18} /> : <PanelRight size={18} />}
          </button>
        </div>
      </header>

      {/* Tool strip below header — mobile only */}
      <div className="flex shrink-0 items-center justify-center border-b border-neutral-200 bg-white px-2 py-1 md:hidden dark:border-neutral-800 dark:bg-neutral-950">
        <Toolbar />
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Toolbar as vertical sidebar — desktop only */}
        <div className="hidden md:flex">
          <Toolbar />
        </div>
        <Thumbnails />
        <Canvas />
        <Sidebar open={panelOpen} onClose={() => setPanelOpen(false)} />
        {/* Small-font legal line — bottom-left. On desktop it clears
            the left tool sidebar with a small gap. */}
        <LegalLinks
          align="start"
          className="pointer-events-auto absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-12rem)] md:left-[3.75rem] md:max-w-none"
        />
      </div>
    </div>
  )
}
