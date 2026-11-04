import { useRef, useEffect } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { styled } from '@linaria/react'
import { theme, fontSize } from '../../styles/theme'
import { useStore } from '../../store/useStore'

interface DraggableWindowProps {
  id: string
  title: ReactNode
  actions?: ReactNode
  children?: ReactNode
}

type ResizeMode = 'corner' | 'bottom' | 'top'

interface Point {
  x: number
  y: number
}

interface RestoreRect {
  x: number
  y: number
  width: number
  height: number
}

const WinBtn = styled.button`
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.surface};
  border: 1px solid ${theme.panelBorder};
  border-radius: 0;
  color: ${theme.text};
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  padding: 0;
  flex-shrink: 0;

  &:hover {
    background: ${theme.surfaceRaised};
    border-color: ${theme.accent};
  }

  &:active {
    transform: scale(0.94);
  }
`

export default function DraggableWindow({ id, title, actions, children }: DraggableWindowProps) {
  const { getState, setState } = useStore()
  const elRef = useRef<HTMLDivElement | null>(null)
  const posRef = useRef<Point | null>(null)
  const maximizedRef = useRef(false)
  const restoreRef = useRef<RestoreRect | null>(null)
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
    el.style.zIndex = String(layout.zIndex)
    el.style.cursor = 'grab'
    el.style.overflow = 'hidden'
    posRef.current = { x: layout.x, y: layout.y }
  }, [layout])

  const zIndex = layout ? layout.zIndex : undefined
  useEffect(() => {
    if (elRef.current && zIndex !== undefined) {
      elRef.current.style.zIndex = String(zIndex)
    }
  }, [zIndex])

  const startResize = (e: ReactMouseEvent<HTMLDivElement>, mode: ResizeMode) => {
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
    const startPos = posRef.current || { x: win.x, y: win.y }
    const startLeft = startPos.x
    const startTop = startPos.y

    const onMove = (me: MouseEvent) => {
      if (mode === 'corner') {
        el.style.width = Math.max(120, startW + (me.clientX - startX)) + 'px'
        el.style.height = Math.max(80, startH + (me.clientY - startY)) + 'px'
      } else if (mode === 'bottom') {
        el.style.height = Math.max(80, startH + (me.clientY - startY)) + 'px'
      } else if (mode === 'top') {
        const bottom = startTop + startH
        const newH = Math.max(80, startH - (me.clientY - startY))
        let newY = startTop + (startH - newH)
        let height = newH
        if (newY < 0) {
          newY = 0
          height = bottom
        }
        el.style.height = height + 'px'
        el.style.transform = `translate(${startLeft}px, ${newY}px)`
        posRef.current = { x: startLeft, y: newY }
      }
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const s2 = getState()
      const w2 = s2.windowLayout[id]
      if (!w2) return
      const p2 = posRef.current || { x: w2.x, y: w2.y }
      const layouts2 = { ...s2.windowLayout }
      layouts2[id] = {
        ...w2,
        width: parseFloat(el.style.width),
        height: parseFloat(el.style.height),
        x: p2.x,
        y: p2.y,
      }
      setState({ windowLayout: layouts2 })
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const closeWindow = () => {
    const s = getState()
    setState({ windowVisibility: { ...s.windowVisibility, [id]: false } })
  }

  const toggleMaximize = () => {
    const el = elRef.current
    if (!el) return
    const s = getState()
    const win = s.windowLayout[id]
    if (!win) return
    const parent = el.parentElement
    const pw = parent?.clientWidth ?? win.width
    const ph = parent?.clientHeight ?? win.height
    const z = (s.maxZIndex || 10) + 1
    const layouts = { ...s.windowLayout }

    if (!maximizedRef.current) {
      restoreRef.current = { x: win.x, y: win.y, width: win.width, height: win.height }
      layouts[id] = { ...win, x: 0, y: 0, width: pw, height: ph, zIndex: z }
      maximizedRef.current = true
      posRef.current = { x: 0, y: 0 }
      el.style.width = `${pw}px`
      el.style.height = `${ph}px`
      el.style.transform = 'translate(0px, 0px)'
    } else {
      const r = restoreRef.current || { x: win.x, y: win.y, width: win.width, height: win.height }
      layouts[id] = { ...win, x: r.x, y: r.y, width: r.width, height: r.height, zIndex: z }
      maximizedRef.current = false
      posRef.current = { x: r.x, y: r.y }
      el.style.width = `${r.width}px`
      el.style.height = `${r.height}px`
      el.style.transform = `translate(${r.x}px, ${r.y}px)`
    }
    setState({ windowLayout: layouts, maxZIndex: z })
  }

  if (!layout) return <div ref={elRef}>{children}</div>

  return (
    <div
      ref={elRef}
      style={{
        border: `2px solid ${theme.panelBorder}`,
        background: theme.panelBg,
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseDown={() => {
        const s = getState()
        const win = s.windowLayout[id]
        if (!win) return
        const newZ = (s.maxZIndex || 10) + 1
        if (elRef.current) elRef.current.style.zIndex = String(newZ)
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
        onMouseDown={(e: ReactMouseEvent<HTMLDivElement>) => {
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

          const onMove = (me: MouseEvent) => {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {actions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {actions}
            </div>
          )}
          <WinBtn
            title="Закрыть"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              closeWindow()
            }}
          >
            ×
          </WinBtn>
          <WinBtn
            title="Развернуть"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              toggleMaximize()
            }}
          >
            □
          </WinBtn>
          <WinBtn
            title="Свернуть"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              closeWindow()
            }}
          >
            –
          </WinBtn>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: '5px',
          cursor: 'ns-resize',
          zIndex: 10,
        }}
        onMouseDown={(e) => startResize(e, 'top')}
      />

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '6px',
          cursor: 'ns-resize',
          zIndex: 10,
        }}
        onMouseDown={(e) => startResize(e, 'bottom')}
      />

      <div
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '14px',
          height: '14px',
          cursor: 'nwse-resize',
          zIndex: 11,
        }}
        onMouseDown={(e) => startResize(e, 'corner')}
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
