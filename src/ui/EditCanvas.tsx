import { useMemo, useRef, useState } from 'preact/hooks';
import { isStar } from '../core/colors';
import * as E from '../core/edit';
import { boundsOf, legBeads, legTilt, ROW_PITCH, type BeadRef, type Placed } from '../core/geometry';
import { BEAD, LIMITS, type Design, type Side, type WeaveDesign } from '../core/types';
import { Bead } from './Bead';
import { chartPlacements } from './DesignView';

export type Tool = 'paint' | 'fill' | 'erase' | 'leg' | 'swap';

type Target =
  | { t: 'bead'; p: Placed }
  | { t: 'ghost'; row: number; side: Side; x: number; y: number }
  | { t: 'addrow'; at: 'top' | 'bottom'; x: number; y: number }
  | { t: 'belly'; row: number; x: number; y: number; on: boolean }
  | { t: 'legzone'; row: number; side: Side; x: number; y: number };

interface Props {
  design: Design;
  tool: Tool;
  mirror: boolean;
  color: string;
  /** a new design; `start` is true for the first change of a stroke (one undo step per stroke) */
  onChange: (d: Design, start: boolean) => void;
  /** a second finger arrived right after the first: undo what the first finger just did */
  onCancelStroke: () => void;
  onReject: (msg: string) => void;
}

const isWeave = (d: Design): d is WeaveDesign => d.kind === 'flat' || d.kind === 'critter';

function targetsFor(d: Design, tool: Tool, beads: Placed[]): Target[] {
  const out: Target[] = beads.map((p) => ({ t: 'bead', p }));
  if (!isWeave(d)) return out;
  const n = d.rows.length;
  if (tool === 'leg') {
    d.rows.forEach((r, row) => {
      const half = (r.beads.length / 2) * BEAD.length;
      const tilt = legTilt(row, n);
      for (const side of ['L', 'R'] as Side[]) {
        if ((side === 'L' ? r.legL : r.legR) !== undefined) continue;
        const preview = legBeads({ stem: ['x', 'x'], toes: ['x'] }, side, side === 'L' ? -half : half, row * ROW_PITCH, tilt);
        const mid = preview[1];
        out.push({ t: 'legzone', row, side, x: mid.x, y: mid.y });
      }
    });
  } else if (tool !== 'erase') {
    d.rows.forEach((r, row) => {
      if (r.beads.length >= LIMITS.weave.maxWidth) return;
      const x = ((r.beads.length + 1) / 2) * BEAD.length;
      if (!r.legL) out.push({ t: 'ghost', row, side: 'L', x: -x, y: row * ROW_PITCH });
      if (!r.legR) out.push({ t: 'ghost', row, side: 'R', x, y: row * ROW_PITCH });
    });
  }
  if (n < LIMITS.weave.maxRows) {
    out.push({ t: 'addrow', at: 'top', x: 0, y: -ROW_PITCH * 1.15 }, { t: 'addrow', at: 'bottom', x: 0, y: (n - 1 + 1.15) * ROW_PITCH });
  }
  if (d.kind === 'critter') {
    const minX = Math.min(...beads.map((b) => b.x), -BEAD.length * 3) - 13;
    d.rows.forEach((r, row) => {
      if (row > 0) out.push({ t: 'belly', row, x: minX, y: row * ROW_PITCH, on: !!r.belly });
    });
  }
  return out;
}

function pos(t: Target) {
  return t.t === 'bead' ? { x: t.p.x, y: t.p.y } : { x: t.x, y: t.y };
}

export function EditCanvas({ design, tool, mirror, color, onChange, onCancelStroke, onReject }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const beads = useMemo(() => chartPlacements(design), [design]);
  const targets = useMemo(() => targetsFor(design, tool, beads), [design, tool, beads]);
  const content = boundsOf(
    targets.map(pos),
    design.kind === 'bracelet' ? 7 : 6.5,
  );
  // Keep a minimum area so small designs aren't blown up huge, and the view doesn't jump.
  const minW = design.kind === 'bracelet' ? 60 : 50;
  const minH = 50;
  const cw = Math.max(content.maxX - content.minX, minW);
  const ch = Math.max(content.maxY - content.minY, minH);
  const ccx = (content.minX + content.maxX) / 2;
  const ccy = (content.minY + content.maxY) / 2;

  const [view, setView] = useState({ zoom: 1, dx: 0, dy: 0 });
  const vw = cw / view.zoom;
  const vh = ch / view.zoom;
  const vx = ccx + view.dx - vw / 2;
  const vy = ccy + view.dy - vh / 2;

  // ---------------------------------------------------------------- pointer handling
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const stroke = useRef<{ id: number; started: number; last: string | null; changed: boolean } | null>(null);
  const pinch = useRef<{ dist: number; zoom: number; mid: { x: number; y: number }; dx: number; dy: number } | null>(null);
  const live = useRef(design);
  live.current = design;

  // Reading the screen transform forces the browser to recompute layout, so read it once per
  // stroke instead of on every pointer move (the view doesn't change mid-stroke).
  const ctm = useRef<{ inv: DOMMatrix; ppu: number } | null>(null);
  function readCtm() {
    const m = svg.current?.getScreenCTM();
    ctm.current = m ? { inv: m.inverse(), ppu: Math.hypot(m.a, m.b) } : null;
  }

  function toSvg(e: PointerEvent) {
    if (!ctm.current) readCtm();
    if (!ctm.current) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.current.inv);
    return { x: p.x, y: p.y };
  }

  function pxPerUnit() {
    if (!ctm.current) readCtm();
    return ctm.current?.ppu ?? 3;
  }

  function hit(p: { x: number; y: number }, onlyBeads = false): Target | null {
    const slack = 22 / pxPerUnit(); // finger-sized forgiveness
    let best: Target | null = null;
    let bestD = Infinity;
    for (const t of targets) {
      if (onlyBeads && t.t !== 'bead') continue;
      const c = pos(t);
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      const r = t.t === 'bead' ? Math.max(4.6, Math.min(slack, 6)) : Math.max(5.5, Math.min(slack, 8));
      // beads win ties against helpers
      const score = d - (t.t === 'bead' ? 0.8 : 0);
      if (d <= r && score < bestD) {
        bestD = score;
        best = t;
      }
    }
    return best;
  }

  function refKey(r: BeadRef) {
    return JSON.stringify(r);
  }

  /** Apply the tool to a target. Returns the new design or null if nothing changed. */
  function act(t: Target, first: boolean): Design | null {
    const d = live.current;
    switch (t.t) {
      case 'bead': {
        const ref = t.p.ref;
        if (tool === 'paint') {
          if (isStar(color) && !E.starAllowed(d, ref)) {
            if (first) onReject('Stars go on leg tips ⭐');
            return null;
          }
          const m = mirror ? E.mirrorRef(d, ref) : null;
          if (E.colorAt(d, ref) === color && (!m || E.colorAt(d, m) === color)) return null;
          return E.paint(d, ref, color, mirror);
        }
        if (!first) return null;
        if (tool === 'fill') {
          if (isStar(color) && !E.starAllowed(d, ref)) {
            onReject('Stars go on leg tips ⭐');
            return null;
          }
          const n = E.floodFill(d, ref, color, mirror);
          return n === d ? null : n;
        }
        if (tool === 'swap') {
          const from = E.colorAt(d, ref);
          if (!from || from === color) return null;
          return E.swapColor(d, from, color);
        }
        if (tool === 'erase' && isWeave(d)) {
          if (!E.canErase(d, ref)) {
            onReject('Only the end beads come off');
            return null;
          }
          const n = E.erase(d, ref, mirror);
          if (n === d) onReject('A shape needs at least one bead');
          return n === d ? null : n;
        }
        if (tool === 'leg' && isWeave(d)) {
          if (ref.t === 'leg') return E.cycleLeg(d, ref.row, ref.side, color, mirror);
          if (ref.t === 'row') {
            const w = d.rows[ref.row].beads.length;
            const side: Side | null = ref.i === 0 ? 'L' : ref.i === w - 1 ? 'R' : null;
            if (side) return E.cycleLeg(d, ref.row, side, color, mirror);
            onReject('Tap beside a row to add a leg');
          }
        }
        return null;
      }
      case 'ghost': {
        if (!first || !isWeave(d)) return null;
        if (isStar(color)) {
          onReject('Stars go on leg tips ⭐');
          return null;
        }
        const n = E.addEnd(d, t.row, t.side, color, mirror);
        if (n === d) onReject('That row is as wide as it gets');
        return n === d ? null : n;
      }
      case 'addrow':
        return first && isWeave(d) ? E.addRow(d, t.at) : null;
      case 'belly':
        return first && isWeave(d) ? E.toggleBelly(d, t.row) : null;
      case 'legzone':
        return first && isWeave(d) ? E.cycleLeg(d, t.row, t.side, color, mirror) : null;
    }
  }

  function onDown(e: PointerEvent) {
    e.preventDefault();
    readCtm();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // Two fingers: zoom/pan. If the first finger just painted, take it back.
      const s = stroke.current;
      if (s && s.changed && performance.now() - s.started < 350) onCancelStroke();
      stroke.current = null;
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dx: view.dx, dy: view.dy };
      return;
    }
    if (pointers.current.size > 2) return;
    const t = hit(toSvg(e));
    stroke.current = { id: e.pointerId, started: performance.now(), last: t?.t === 'bead' ? refKey(t.p.ref) : null, changed: false };
    if (!t) return;
    const n = act(t, true);
    if (n) {
      stroke.current.changed = true;
      onChange(n, true);
    }
  }

  function onMove(e: PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pz = pinch.current;
    if (pz && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const zoom = Math.min(4, Math.max(1, (pz.zoom * dist) / Math.max(pz.dist, 1)));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const ppu = pxPerUnit();
      const maxPan = (z: number, size: number) => (size * (1 - 1 / z)) / 2;
      const dx = Math.max(-maxPan(zoom, cw), Math.min(maxPan(zoom, cw), pz.dx - (mid.x - pz.mid.x) / ppu));
      const dy = Math.max(-maxPan(zoom, ch), Math.min(maxPan(zoom, ch), pz.dy - (mid.y - pz.mid.y) / ppu));
      setView({ zoom, dx, dy });
      ctm.current = null;
      return;
    }
    const s = stroke.current;
    if (!s || s.id !== e.pointerId || tool !== 'paint') return;
    const t = hit(toSvg(e), true);
    if (!t || t.t !== 'bead') return;
    const k = refKey(t.p.ref);
    if (k === s.last) return;
    s.last = k;
    const n = act(t, false);
    if (n) {
      onChange(n, !s.changed);
      s.changed = true;
    }
  }

  function onUp(e: PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (stroke.current?.id === e.pointerId) stroke.current = null;
  }

  // ---------------------------------------------------------------- drawing
  const critterBands =
    design.kind === 'critter'
      ? design.rows.map((r, i) =>
          r.belly ? <rect key={`band${i}`} x={vx} y={i * ROW_PITCH - ROW_PITCH / 2} width={vw} height={ROW_PITCH} fill="#7a5c99" fill-opacity="0.12" /> : null,
        )
      : null;

  return (
    <svg
      ref={svg}
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="edit-canvas"
      role="application"
      aria-label="Design canvas"
    >
      {critterBands}
      {design.kind === 'bracelet' && (
        <circle r={Math.max((design.beads.length * BEAD.length) / (2 * Math.PI), 12)} fill="none" stroke="#d9c6d3" stroke-width="0.7" stroke-dasharray="1.6 1.6" />
      )}
      {targets.map((t, i) => {
        if (t.t === 'ghost')
          return (
            <g key={`g${i}`} transform={`translate(${t.x} ${t.y})`} data-ghost={`${t.row}${t.side}`}>
              <rect x={-2.7} y={-4.2} width={5.4} height={8.4} rx="2.2" fill="#fff" fill-opacity="0.7" stroke="#c7a9c0" stroke-width="0.5" stroke-dasharray="1 0.8" />
              <path d="M-1.5 0h3M0 -1.5v3" stroke="#b08aa8" stroke-width="0.7" stroke-linecap="round" />
            </g>
          );
        if (t.t === 'addrow')
          return (
            <g key={`a${i}`} transform={`translate(${t.x} ${t.y})`} data-addrow={t.at}>
              <rect x={-9} y={-3.2} width={18} height={6.4} rx="3.2" fill="#fff" stroke="#c7a9c0" stroke-width="0.5" />
              <path d="M-2 0h4M0 -2v4" stroke="#9b6c92" stroke-width="0.9" stroke-linecap="round" />
            </g>
          );
        if (t.t === 'belly')
          return (
            <g key={`b${i}`} transform={`translate(${t.x} ${t.y})`} data-belly={t.row}>
              <rect x={-6.5} y={-3.6} width={13} height={7.2} rx="3.6" fill={t.on ? '#7a5c99' : '#fff'} stroke="#7a5c99" stroke-width="0.5" />
              <text x="0" y="1.3" text-anchor="middle" font-size="3.4" font-weight="700" fill={t.on ? '#fff' : '#7a5c99'}>
                {t.on ? 'belly' : 'top'}
              </text>
            </g>
          );
        if (t.t === 'legzone')
          return (
            <g key={`z${i}`} transform={`translate(${t.x} ${t.y})`} data-legzone={`${t.row}${t.side}`}>
              <circle r="3.6" fill="#fff" stroke="#12b5a3" stroke-width="0.5" stroke-dasharray="1 0.8" />
              <path d="M-1.5 0h3M0 -1.5v3" stroke="#12b5a3" stroke-width="0.7" stroke-linecap="round" />
            </g>
          );
        return null;
      })}
      {beads.map((p) => (
        <Bead key={p.key} x={p.x} y={p.y} angle={p.angle} color={p.color} />
      ))}
    </svg>
  );
}
