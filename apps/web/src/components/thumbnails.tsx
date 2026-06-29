'use client'

import { useEditorStore } from '@/store/editor'
import { FileText } from 'lucide-react'
import { useState, useEffect } from 'react'

export function Thumbnails() {
  const pages = useEditorStore((s) => s.pages)
  const scrollToPage = useEditorStore((s) => s.scrollToPage)
  const [activePage, setActivePage] = useState(0)

  // Track active page based on vertical scroll/pan position
  const panY = useEditorStore((s) => s.panY)
  const zoom = useEditorStore((s) => s.zoom)

  useEffect(() => {
    if (pages.length <= 1) return

    let cumulativeHeight = 0
    let detectedIndex = 0
    
    const container = document.querySelector('.canvas-container')
    const viewportCenter = container ? container.clientHeight / 2 : 300
    
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
      // PAGE_GAP is 20
      cumulativeHeight += pageHeight + 20
    }
    setActivePage(detectedIndex)
  }, [panY, zoom, pages])

  if (pages.length <= 1) return null

  return (
    <aside className="hidden md:flex flex-col w-24 shrink-0 border-r border-neutral-200 bg-neutral-50/50 py-3 overflow-y-auto overflow-x-hidden dark:border-neutral-800 dark:bg-neutral-900/30">
      <div className="px-2 mb-3 text-[10px] font-bold uppercase tracking-wider text-neutral-400 text-center">
        Pages
      </div>
      <div className="flex flex-col items-center gap-4 px-2">
        {pages.map((pg, idx) => {
          const isActive = idx === activePage
          const aspectRatio = pg.width / pg.height
          return (
            <button
              key={idx}
              onClick={() => scrollToPage(idx)}
              className="flex flex-col items-center w-full group focus:outline-none"
            >
              <div
                style={{ aspectRatio: `${aspectRatio}` }}
                className={`relative w-16 bg-white border rounded shadow transition-all flex items-center justify-center overflow-hidden
                  ${isActive 
                    ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md' 
                    : 'border-neutral-300 group-hover:border-neutral-400 dark:border-neutral-700'
                  }
                  dark:bg-neutral-950
                `}
              >
                <FileText size={20} className={isActive ? 'text-blue-500' : 'text-neutral-400'} />
              </div>
              <span className={`mt-1 text-[11px] font-medium transition-colors
                ${isActive 
                  ? 'text-blue-600 dark:text-blue-400 font-semibold' 
                  : 'text-neutral-500 group-hover:text-neutral-800 dark:group-hover:text-neutral-200'
                }
              `}>
                Page {idx + 1}
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
