import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type { Point } from '../types'

export interface DrawingCanvasHandle {
  clear: () => void
  getStrokes: () => Point[][]
  getCanvasSize: () => { width: number; height: number }
}

interface Props {
  onStrokeEnd: (strokes: Point[][]) => void
  onDrawStart: () => void
  isProcessing: boolean
}

const STROKE_COLOR = '#c7d2fe'
const STROKE_WIDTH = 3

const DrawingCanvas = forwardRef<DrawingCanvasHandle, Props>(
  ({ onStrokeEnd, onDrawStart, isProcessing }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
    const strokesRef = useRef<Point[][]>([])
    const currentStrokeRef = useRef<Point[]>([])
    const isDrawingRef = useRef(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isEmpty, setIsEmpty] = useState(true)

    const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      }
    }, [])

    const initCanvas = useCallback(() => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return

      const dpr = window.devicePixelRatio || 1
      const w = container.clientWidth
      const h = container.clientHeight

      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      canvas.width = w * dpr
      canvas.height = h * dpr

      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)
      ctx.strokeStyle = STROKE_COLOR
      ctx.lineWidth = STROKE_WIDTH
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctxRef.current = ctx

      // Redraw existing strokes after resize
      redrawStrokes()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const redrawStrokes = useCallback(() => {
      const ctx = ctxRef.current
      const canvas = canvasRef.current
      if (!ctx || !canvas) return

      const dpr = window.devicePixelRatio || 1
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)

      ctx.strokeStyle = STROKE_COLOR
      ctx.lineWidth = STROKE_WIDTH
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      for (const stroke of strokesRef.current) {
        if (stroke.length === 0) continue
        drawSmoothStroke(ctx, stroke)
      }
    }, [])

    useEffect(() => {
      initCanvas()

      const observer = new ResizeObserver(initCanvas)
      if (containerRef.current) observer.observe(containerRef.current)

      return () => observer.disconnect()
    }, [initCanvas])

    const startPoint = useCallback((clientX: number, clientY: number) => {
      const ctx = ctxRef.current
      if (!ctx || isProcessing) return

      onDrawStart()
      isDrawingRef.current = true
      const pt = { ...getCanvasCoords(clientX, clientY), t: Date.now() }
      currentStrokeRef.current = [pt]

      ctx.beginPath()
      ctx.strokeStyle = STROKE_COLOR
      ctx.lineWidth = STROKE_WIDTH
      ctx.moveTo(pt.x, pt.y)
      setIsEmpty(false)
    }, [getCanvasCoords, isProcessing, onDrawStart])

    const addPoint = useCallback((clientX: number, clientY: number) => {
      const ctx = ctxRef.current
      if (!ctx || !isDrawingRef.current) return

      const pt = { ...getCanvasCoords(clientX, clientY), t: Date.now() }
      const current = currentStrokeRef.current

      current.push(pt)

      const len = current.length
      if (len < 3) {
        ctx.lineTo(pt.x, pt.y)
        ctx.stroke()
      } else {
        // Quadratic bezier through midpoints for smooth curves
        const prev = current[len - 2]
        const midX = (prev.x + pt.x) / 2
        const midY = (prev.y + pt.y) / 2
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(midX, midY)
      }
    }, [getCanvasCoords])

    const endStroke = useCallback(() => {
      if (!isDrawingRef.current) return
      isDrawingRef.current = false

      const stroke = currentStrokeRef.current
      if (stroke.length > 0) {
        strokesRef.current = [...strokesRef.current, stroke]
        currentStrokeRef.current = []
        onStrokeEnd(strokesRef.current)
      }
    }, [onStrokeEnd])

    // Mouse events
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      e.preventDefault()
      startPoint(e.clientX, e.clientY)
    }, [startPoint])

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
      if (!isDrawingRef.current) return
      e.preventDefault()
      addPoint(e.clientX, e.clientY)
    }, [addPoint])

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
      e.preventDefault()
      endStroke()
    }, [endStroke])

    // Touch events (added via useEffect to support { passive: false })
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const onTouchStart = (e: TouchEvent) => {
        e.preventDefault()
        const touch = e.touches[0]
        startPoint(touch.clientX, touch.clientY)
      }

      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault()
        const touch = e.touches[0]
        addPoint(touch.clientX, touch.clientY)
      }

      const onTouchEnd = (e: TouchEvent) => {
        e.preventDefault()
        endStroke()
      }

      canvas.addEventListener('touchstart', onTouchStart, { passive: false })
      canvas.addEventListener('touchmove', onTouchMove, { passive: false })
      canvas.addEventListener('touchend', onTouchEnd, { passive: false })
      canvas.addEventListener('touchcancel', onTouchEnd, { passive: false })

      return () => {
        canvas.removeEventListener('touchstart', onTouchStart)
        canvas.removeEventListener('touchmove', onTouchMove)
        canvas.removeEventListener('touchend', onTouchEnd)
        canvas.removeEventListener('touchcancel', onTouchEnd)
      }
    }, [startPoint, addPoint, endStroke])

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      clear: () => {
        const ctx = ctxRef.current
        const canvas = canvasRef.current
        if (!ctx || !canvas) return
        const dpr = window.devicePixelRatio || 1
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
        strokesRef.current = []
        currentStrokeRef.current = []
        isDrawingRef.current = false
        setIsEmpty(true)
      },
      getStrokes: () => strokesRef.current,
      getCanvasSize: () => {
        const canvas = canvasRef.current
        if (!canvas) return { width: 0, height: 0 }
        const rect = canvas.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      },
    }))

    return (
      <div
        ref={containerRef}
        className="relative w-full h-full canvas-container"
        style={{ background: '#0f0f0f' }}
      >
        <canvas
          ref={canvasRef}
          className="drawing-canvas absolute inset-0"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            opacity: isProcessing ? 0.6 : 1,
            transition: 'opacity 0.2s ease',
          }}
        />

        {isEmpty && !isProcessing && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
            style={{ color: '#2a2a2a' }}
          >
            <div className="text-center">
              <div className="text-6xl font-light mb-2" style={{ fontFamily: 'Georgia, serif' }}>A</div>
              <div className="text-sm" style={{ color: '#333' }}>Dessine une lettre</div>
            </div>
          </div>
        )}

        {isProcessing && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(10,10,10,0.3)' }}
          >
            <div className="text-accent text-sm animate-pulse">Analyse...</div>
          </div>
        )}
      </div>
    )
  },
)

DrawingCanvas.displayName = 'DrawingCanvas'

function drawSmoothStroke(ctx: CanvasRenderingContext2D, stroke: Point[]) {
  if (stroke.length === 0) return
  ctx.beginPath()
  ctx.moveTo(stroke[0].x, stroke[0].y)
  for (let i = 1; i < stroke.length - 1; i++) {
    const midX = (stroke[i].x + stroke[i + 1].x) / 2
    const midY = (stroke[i].y + stroke[i + 1].y) / 2
    ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, midX, midY)
  }
  if (stroke.length > 1) {
    const last = stroke[stroke.length - 1]
    ctx.lineTo(last.x, last.y)
  }
  ctx.stroke()
}

export default DrawingCanvas
