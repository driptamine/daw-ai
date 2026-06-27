import { useRef, useEffect } from 'react'
import { theme, fontSize } from '../../styles/theme'
import { useStore } from '../../store/useStore'

export default function DraggableWindow({ id, title, actions, children }) {
  const { getState, setState } = useStore()
  const elRef = useRef(null)
  const posRef = useRef(null)
  const layout = getState().windowLayout[id]

  useEffect(() => {
    const el = elRef.current
    if (!el || !layout) return
    el.style.position = 'absolute'
    el.style.left = '0px'
    el.style.top = '0px'
    el.style.width = layout.width + 'px'
    el.style.height = layout.height + 'px'
    el.style.transform = `translate(${layout.x}px, ${layout.y}px)`
    el.style.zIndex = layout.zIndex
    el.style.cursor = 'grab'
    el.style.overflow = 'hidden'
    posRef.current = { x: layout.x, y: layout.y }
  }, [])

  if (!layout) return <div ref={elRef}>{children}</div>

  return (
    <div
      ref={elRef}
      onMouseDown={() => {
        const s = getState()
        const win = s.windowLayout[id]
        if (!win) return
        const newZ = (s.maxZIndex || 10) + 1
        elRef.current.style.zIndex = newZ
        const layouts = { ...s.windowLayout }
        layouts[id] = { ...win, zIndex: newZ }
        setState({ windowLayout: layouts, maxZIndex: newZ })
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          background: theme.surface,
          borderBottom: '1px solid ' + theme.panelBorder,
          flexShrink: 0,
          userSelect: 'none',
        }}
        onMouseDown={(e) => {
          e.preventDefault()
          const el = elRef.current
          if (!el) return

          const s = getState()
          const win = s.windowLayout[id]
          if (!win) return

          const parent = el.parentElement
          const pw = parent?.clientWidth ?? 1200
          const ph = parent?.clientHeight ?? 800
          const startX = e.clientX
          const startY = e.clientY
          const p = posRef.current
          const startL = p ? p.x : win.x
          const startT = p ? p.y : win.y
          const cw = win.width
          const ch = win.height

          document.body.style.cursor = 'grabbing'
          el.style.cursor = 'grabbing'

          const onMove = (me) => {
            const dx = me.clientX - startX
            const dy = me.clientY - startY
            const nx = Math.max(0, Math.min(pw - cw, startL + dx))
            const ny = Math.max(0, Math.min(ph - ch, startT + dy))
            posRef.current = { x: nx, y: ny }
            el.style.transform = `translate(${nx}px, ${ny}px)`
          }

          const onUp = () => {
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
            document.body.style.cursor = ''
            el.style.cursor = 'grab'
            const p2 = posRef.current
            if (!p2) return
            const s2 = getState()
            const w2 = s2.windowLayout[id]
            if (!w2) return
            const layouts2 = { ...s2.windowLayout }
            layouts2[id] = { ...w2, x: p2.x, y: p2.y }
            setState({ windowLayout: layouts2 })
          }

          document.addEventListener('mousemove', onMove)
          document.addEventListener('mouseup', onUp)
        }}
      >
        <span style={{ color: theme.text, fontSize: fontSize.sm, fontWeight: 600 }}>
          {title}
        </span>
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {actions}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>

      <div
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '14px',
          height: '14px',
          cursor: 'nwse-resize',
          zIndex: 10,
        }}
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const el = elRef.current
          if (!el) return

          const s = getState()
          const win = s.windowLayout[id]
          if (!win) return

          const startX = e.clientX
          const startY = e.clientY
          const startW = win.width
          const startH = win.height

          const onMove = (me) => {
            const dx = me.clientX - startX
            const dy = me.clientY - startY
            el.style.width = Math.max(120, startW + dx) + 'px'
            el.style.height = Math.max(80, startH + dy) + 'px'
          }

          const onUp = () => {
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
            const s2 = getState()
            const w2 = s2.windowLayout[id]
            if (!w2) return
            const layouts2 = { ...s2.windowLayout }
            layouts2[id] = {
              ...w2,
              width: parseFloat(el.style.width),
              height: parseFloat(el.style.height),
            }
            setState({ windowLayout: layouts2 })
          }

          document.addEventListener('mousemove', onMove)
          document.addEventListener('mouseup', onUp)
        }}
      >
        <div style={{
          position: 'absolute',
          right: '3px',
          bottom: '3px',
          width: '6px',
          height: '6px',
          borderRight: '2px solid ' + theme.textDim,
          borderBottom: '2px solid ' + theme.textDim,
        }} />
      </div>
    </div>
  )
}
