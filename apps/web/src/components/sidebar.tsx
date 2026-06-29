'use client'

import { importPdf } from '@/lib/import-pdf'
import { PAGE_PRESETS, useEditorStore, type EditorNode } from '@/store/editor'
import {
  Eye,
  EyeOff,
  FilePlus2,
  Loader2,
  Pencil,
  Upload,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-neutral-400">{label}</span>
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        step={step}
        min={min}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!Number.isNaN(v)) onChange(v)
        }}
        className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-neutral-200 p-3 dark:border-neutral-800">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Properties({ node }: { node: EditorNode }) {
  const updateNode = useEditorStore((s) => s.updateNode)
  const pushHistory = useEditorStore((s) => s.pushHistory)

  const set = (changes: Partial<EditorNode>) => {
    pushHistory()
    updateNode(node.id, changes)
  }

  return (
    <>
      <Section title="Position & Size">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={node.x} onChange={(v) => set({ x: v })} />
          <NumberField label="Y" value={node.y} onChange={(v) => set({ y: v })} />
          <NumberField
            label="W"
            value={node.width}
            onChange={(v) => set({ width: Math.max(1, v) })}
          />
          <NumberField
            label="H"
            value={node.height}
            onChange={(v) => set({ height: Math.max(1, v) })}
          />
          <NumberField
            label="Rotation"
            value={node.rotation}
            onChange={(v) => set({ rotation: v })}
          />
          <NumberField
            label="Opacity"
            value={node.opacity}
            step={0.1}
            min={0}
            onChange={(v) => set({ opacity: Math.min(1, Math.max(0, v)) })}
          />
        </div>
      </Section>

      {node.type !== 'image' && node.type !== 'text' && (
        <Section title="Fill">
          <input
            type="color"
            value={node.fill.color ?? '#000000'}
            onChange={(e) => set({ fill: { ...node.fill, type: 'solid', color: e.target.value } })}
            className="h-8 w-full cursor-pointer rounded border border-neutral-200 dark:border-neutral-700"
          />
          {(node.type === 'rectangle' || node.type === 'frame') && (
            <div className="mt-2">
              <NumberField
                label="Corner Radius"
                value={node.cornerRadius ?? 0}
                min={0}
                onChange={(v) => set({ cornerRadius: Math.max(0, v) })}
              />
            </div>
          )}
        </Section>
      )}

      {node.type === 'text' && node.textStyle && (
        <Section title="Typography">
          <div className="flex flex-col gap-2">
            <input
              type="color"
              value={node.fill.color ?? '#18181b'}
              onChange={(e) =>
                set({ fill: { ...node.fill, type: 'solid', color: e.target.value } })
              }
              className="h-8 w-full cursor-pointer rounded border border-neutral-200 dark:border-neutral-700"
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Size"
                value={node.textStyle.fontSize}
                min={1}
                onChange={(v) =>
                  set({ textStyle: { ...node.textStyle!, fontSize: Math.max(1, v) } })
                }
              />
              <NumberField
                label="Weight"
                value={node.textStyle.fontWeight}
                step={100}
                onChange={(v) => set({ textStyle: { ...node.textStyle!, fontWeight: v } })}
              />
              <NumberField
                label="Line Height"
                value={node.textStyle.lineHeight}
                step={0.1}
                onChange={(v) => set({ textStyle: { ...node.textStyle!, lineHeight: v } })}
              />
              <NumberField
                label="Letter Sp."
                value={node.textStyle.letterSpacing}
                step={0.1}
                onChange={(v) => set({ textStyle: { ...node.textStyle!, letterSpacing: v } })}
              />
            </div>
            <div className="flex gap-1">
              {(['left', 'center', 'right', 'justify'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => set({ textStyle: { ...node.textStyle!, textAlign: a } })}
                  className={`flex-1 rounded border px-2 py-1 text-xs capitalize ${
                    node.textStyle!.textAlign === a
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </Section>
      )}

      {node.type === 'image' && (
        <Section title="Image">
          <div className="flex gap-1">
            {(['fill', 'contain', 'cover'] as const).map((f) => (
              <button
                key={f}
                onClick={() => set({ fit: f })}
                className={`flex-1 rounded border px-2 py-1 text-xs capitalize ${
                  node.fit === f
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : 'border-neutral-200 dark:border-neutral-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

function LayerRow({ node, onClose }: { node: EditorNode; onClose?: (() => void) | undefined }) {
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const select = useEditorStore((s) => s.select)
  const updateNode = useEditorStore((s) => s.updateNode)
  const setEditing = useEditorStore((s) => s.setEditing)
  const selected = selectedIds.includes(node.id)

  return (
    <div
      onClick={() => select([node.id])}
      className={`flex cursor-pointer items-center justify-between rounded px-2 py-1 text-sm ${
        selected
          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
      }`}
    >
      <span className="truncate">{node.name}</span>
      <span className="flex items-center gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation()
            updateNode(node.id, { visible: !node.visible })
          }}
          className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          title={node.visible ? 'Hide' : 'Show'}
        >
          {node.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        {node.type === 'text' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              select([node.id])
              setEditing(node.id)
              onClose?.()
            }}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            title="Edit text"
          >
            <Pencil size={13} />
          </button>
        )}
      </span>
    </div>
  )
}

function DocumentPanel() {
  const pageWidth = useEditorStore((s) => s.pageWidth)
  const pageHeight = useEditorStore((s) => s.pageHeight)
  const newDocument = useEditorStore((s) => s.newDocument)
  const setPageSize = useEditorStore((s) => s.setPageSize)
  const loadDocument = useEditorStore((s) => s.loadDocument)

  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const originalPageSize = useEditorStore((s) => s.originalPageSize)

  const pages = useEditorStore((s) => s.pages)
  const firstPage = pages[0]

  // Construct dynamic presets including the original PDF size if loaded
  const presets = [...PAGE_PRESETS]
  if (originalPageSize) {
    const isStandard = PAGE_PRESETS.some(
      (p) =>
        Math.abs(p.width - originalPageSize.width) <= 5 &&
        Math.abs(p.height - originalPageSize.height) <= 5
    )
    if (!isStandard) {
      presets.push({
        id: 'original',
        label: `Custom (${Math.round(originalPageSize.width)}×${Math.round(originalPageSize.height)})`,
        width: originalPageSize.width,
        height: originalPageSize.height,
      })
    }
  }

  const activePreset = firstPage
    ? (presets.find(
        (p) =>
          Math.abs(p.width - firstPage.width) <= 5 &&
          Math.abs(p.height - firstPage.height) <= 5
      )?.id ?? 'custom')
    : 'custom'

  const onPickPreset = (id: string) => {
    if (id === 'custom') return
    const preset = presets.find((p) => p.id === id)
    if (preset) setPageSize(preset.width, preset.height)
  }

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
      setError('Could not read that PDF. It may be encrypted or unsupported.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title="Document">
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-neutral-400">Page size</span>
          <select
            value={activePreset}
            onChange={(e) => onPickPreset(e.target.value)}
            className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({Math.round(p.width)}×{Math.round(p.height)})
              </option>
            ))}
            {activePreset === 'custom' && (
              <option value="custom">
                Custom ({Math.round(firstPage?.width ?? pageWidth)}×{Math.round(firstPage?.height ?? pageHeight)})
              </option>
            )}
          </select>
        </label>

        <button
          onClick={() => newDocument({ width: pageWidth, height: pageHeight })}
          className="flex items-center justify-center gap-2 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
        >
          <FilePlus2 size={15} /> New blank PDF
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {busy ? 'Importing…' : 'Open / edit a PDF'}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={onImport}
        />

        {error && <p className="text-xs text-amber-600 dark:text-amber-500">{error}</p>}
        <p className="text-[11px] leading-snug text-neutral-400">
          Importing a PDF turns its text and images into editable objects you can drag, edit, and
          re-export.
        </p>
      </div>
    </Section>
  )
}

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const nodes = useEditorStore((s) => s.nodes)
  const selectedIds = useEditorStore((s) => s.selectedIds)

  const selected = nodes.filter((n) => selectedIds.includes(n.id))
  const single = selected.length === 1 ? selected[0] : null

  return (
    <>
      {/* Backdrop (mobile only) */}
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 right-0 z-40 flex w-72 max-w-[85vw] transform flex-col border-l border-neutral-200
          bg-white shadow-2xl transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
          md:static md:z-auto md:w-64 md:max-w-none md:translate-x-0 md:shadow-none md:transition-none
          dark:border-neutral-800 dark:bg-neutral-950
        `}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 p-3 dark:border-neutral-800">
          <h2 className="truncate text-sm font-medium">
            {single
              ? single.name
              : selected.length > 1
                ? `${selected.length} selected`
                : 'Properties'}
          </h2>
          <div className="flex items-center gap-1">
            {/* Close drawer — mobile only */}
            <button
              onClick={onClose}
              title="Close"
              aria-label="Close properties panel"
              className="ml-1 text-neutral-400 hover:text-neutral-700 md:hidden dark:hover:text-neutral-200"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-thin">
          <DocumentPanel />
          {single ? (
            <Properties node={single} />
          ) : selected.length === 0 ? (
            <div className="p-3">
              <p className="text-sm text-neutral-500">Select an object to view properties</p>
            </div>
          ) : (
            <div className="p-3">
              <p className="text-sm text-neutral-500">Multiple objects selected</p>
            </div>
          )}

          <Section title="Layers">
            <div className="flex flex-col gap-0.5">
              {nodes.filter((n) => {
                const textVal = (n.text ?? '').trim()
                return textVal !== '' && textVal !== '.' && textVal !== '•'
              }).length === 0 && (
                <p className="text-xs text-neutral-400">Nothing on the page yet</p>
              )}
              {[...nodes]
                .filter((n) => {
                  const textVal = (n.text ?? '').trim()
                  return textVal !== '' && textVal !== '.' && textVal !== '•'
                })
                .sort((a, b) => a.y - b.y)
                .map((n) => (
                  <LayerRow key={n.id} node={n} onClose={onClose} />
                ))}
            </div>
          </Section>
        </div>
      </aside>
    </>
  )
}
