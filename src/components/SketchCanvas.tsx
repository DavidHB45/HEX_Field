import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { C } from '../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Point {
  x: number;
  y: number;
  pressure: number; // 0 means no pressure data — caller falls back to fixed width
}

interface Stroke {
  color: string;
  points: Point[];
}

interface SketchCanvasProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GRID_BASE = '#E8F0E2';
const MINOR_SIZE = 12;          // px between minor grid lines
const MAJOR_SIZE = MINOR_SIZE * 4; // major lines every 4 squares (classic engineering pad)

const COLORS: string[] = [C.navy, C.red, C.text, C.gold];

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = GRID_BASE;
  ctx.fillRect(0, 0, w, h);

  // Minor grid lines
  ctx.strokeStyle = 'rgba(76, 130, 80, 0.25)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let x = 0; x <= w; x += MINOR_SIZE) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0; y <= h; y += MINOR_SIZE) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();

  // Major grid lines (every 4 minor squares)
  ctx.strokeStyle = 'rgba(76, 130, 80, 0.55)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let x = 0; x <= w; x += MAJOR_SIZE) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0; y <= h; y += MAJOR_SIZE) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length < 2) return;
  ctx.strokeStyle = stroke.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 1; i < stroke.points.length; i++) {
    const p1 = stroke.points[i - 1];
    const p2 = stroke.points[i];
    // If pressure is 0 (no pressure data from device), fall back to 2px fixed weight
    ctx.lineWidth = p2.pressure > 0 ? p2.pressure * 5 + 1 : 2;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SketchCanvas({ onSave, onCancel }: SketchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState<string>(C.navy);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);

  // ── Render the canvas (background + all strokes) ────────────────────────────
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.scale(dpr, dpr);
    }

    drawBackground(ctx, w, h);
    strokes.forEach((s) => drawStroke(ctx, s));
    if (currentStroke) drawStroke(ctx, currentStroke);
  }, [strokes, currentStroke]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  // ── Handle viewport / orientation changes ───────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Force canvas resize and re-render on orientation / window resize
    const onResize = () => {
      // Invalidate cached size so renderCanvas remeasures
      canvas.width = 0;
      canvas.height = 0;
      renderCanvas();
    };

    window.addEventListener('resize', onResize);
    // screen.orientation is more reliable than 'resize' on iOS for rotations
    screen.orientation?.addEventListener('change', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      screen.orientation?.removeEventListener('change', onResize);
    };
  }, [renderCanvas]);

  // ── Pointer helpers ─────────────────────────────────────────────────────────
  const getPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    // e.pressure is 0 on non-pressure-sensitive devices; force > 0 check in drawStroke
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure ?? 0,
    };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      // Capture the pointer so move/up fire even if the stylus drifts off the element
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      setCurrentStroke({ color, points: [getPoint(e)] });
    },
    [color, getPoint]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!currentStroke) return;
      e.preventDefault();
      setCurrentStroke((prev) =>
        prev ? { ...prev, points: [...prev.points, getPoint(e)] } : null
      );
    },
    [currentStroke, getPoint]
  );

  const handlePointerUp = useCallback(() => {
    if (currentStroke) {
      setStrokes((prev) => [...prev, currentStroke]);
      setCurrentStroke(null);
    }
  }, [currentStroke]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setStrokes([]);
    setCurrentStroke(null);
  }, []);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL('image/png'));
  }, [onSave]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: C.white,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 200,
        // Prevent rubber-band scroll that would displace the canvas on iOS
        overscrollBehavior: 'none',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          background: C.navy,
          color: C.white,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <button onClick={onCancel} style={{ color: C.white, display: 'flex', padding: 4 }}>
          <X size={22} />
        </button>
        <div className="font-display" style={{ flex: 1, fontSize: 16 }}>SKETCH</div>
        <button
          onClick={handleUndo}
          disabled={strokes.length === 0}
          style={{
            color: C.white,
            fontSize: 12,
            fontWeight: 700,
            padding: '6px 12px',
            border: `1px solid ${C.white}`,
            borderRadius: 4,
            opacity: strokes.length === 0 ? 0.4 : 1,
          }}
        >
          UNDO
        </button>
        <button
          onClick={handleClear}
          style={{
            color: C.white,
            fontSize: 12,
            fontWeight: 700,
            padding: '6px 12px',
            border: `1px solid ${C.white}`,
            borderRadius: 4,
          }}
        >
          CLEAR
        </button>
        <button
          onClick={handleSave}
          style={{
            background: C.red,
            color: C.white,
            fontSize: 12,
            fontWeight: 700,
            padding: '6px 14px',
            borderRadius: 4,
          }}
        >
          SAVE
        </button>
      </div>

      {/* Color picker */}
      <div
        style={{
          background: C.cream,
          padding: '8px 12px',
          display: 'flex',
          gap: 10,
          justifyContent: 'center',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: c,
              border: color === c ? `3px solid ${C.gold}` : `2px solid ${C.border}`,
              flexShrink: 0,
              boxShadow: color === c ? `0 0 0 2px ${C.navy}` : 'none',
            }}
          />
        ))}
      </div>

      {/* Drawing surface — fills all remaining space */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          flex: 1,
          display: 'block',
          width: '100%',
          height: '100%',
          touchAction: 'none', // required for Pointer Events to fire on iOS
          cursor: 'crosshair',
        }}
      />
    </div>
  );
}
