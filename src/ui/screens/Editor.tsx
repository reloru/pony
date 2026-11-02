import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  Box,
  Eraser,
  FlipHorizontal2,
  Footprints,
  KeyRound,
  PaintBucket,
  Paintbrush,
  Play,
  Redo2,
  Repeat,
  Replace,
  Shuffle,
  Undo2,
  WandSparkles,
  Minus,
  Plus,
} from 'lucide-preact';
import { go } from '../../app/router';
import { flush, getDraft, getState, saveDesign, useStore } from '../../app/store';
import { COLORS, FINISH_LABEL, isStar } from '../../core/colors';
import * as E from '../../core/edit';
import { totalBeads } from '../../core/steps';
import { BEAD, type Design } from '../../core/types';
import { Swatch } from '../Bead';
import { Sheet, TopBar, toast } from '../common';
import { EditCanvas, type Tool } from '../EditCanvas';
import { KIND_INFO } from '../kinds';
import { Palette } from '../Palette';
import { boop, chime, pop } from '../sound';
import { View3D } from '../View3D';

const MAX_UNDO = 120;

function inchesAround(mm: number) {
  return (mm / 25.4).toFixed(1).replace(/\.0$/, '');
}

function useWide() {
  const q = '(min-width: 820px) and (min-aspect-ratio: 1/1)';
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return wide;
}

export function Editor({ id }: { id: string }) {
  const s = useStore();
  const found = s.designs.find((d) => d.id === id) ?? getDraft(id);
  if (!found) {
    return (
      <div class="screen">
        <TopBar title="Hmm…" backTo={{ name: 'home' }} />
        <div class="panel">
          <p>That design isn't here anymore.</p>
          <button class="btn pink" onClick={() => go({ name: 'home' }, true)}>
            Go home
          </button>
        </div>
      </div>
    );
  }
  return <EditorInner initial={found} />;
}

function firstColor(d: Design): string {
  const used = E.usedColors(d).filter((c) => !isStar(c));
  return used.find((c) => c !== 's-white') ?? 's-hot-pink';
}

function EditorInner({ initial }: { initial: Design }) {
  const [design, setDesign] = useState<Design>(initial);
  const [undo, setUndo] = useState<Design[]>([]);
  const [redo, setRedo] = useState<Design[]>([]);
  const [tool, setTool] = useState<Tool>('paint');
  const [mirror, setMirror] = useState(false);
  const [color, setColor] = useState(() => firstColor(initial));
  const wide = useWide();
  const info = KIND_INFO[design.kind];
  const [show3d, setShow3d] = useState(false);
  const [sheet, setSheet] = useState<null | 'name' | 'pattern'>(null);
  const [shaking, setShaking] = useState(false);

  // While she drags paint across beads, keep changes local and save once the stroke settles.
  const pending = useRef<Design | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (pending.current) saveDesign(pending.current);
    pending.current = null;
  };
  const queueSave = (n: Design) => {
    pending.current = n;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 350);
  };
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        flushSave();
        void flush();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      flushSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function save(n: Design) {
    flushSave();
    saveDesign(n);
  }

  function commit(n: Design, pushUndo = true) {
    if (pushUndo) {
      setUndo((u) => [...u.slice(-MAX_UNDO + 1), design]);
      setRedo([]);
    }
    setDesign(n);
    save(n);
  }

  function onCanvasChange(n: Design, start: boolean) {
    if (start) {
      setUndo((u) => [...u.slice(-MAX_UNDO + 1), design]);
      setRedo([]);
    }
    setDesign(n);
    queueSave(n);
    pop();
  }

  function cancelStroke() {
    setUndo((u) => {
      const prev = u[u.length - 1];
      if (prev) {
        setDesign(prev);
        queueSave(prev);
      }
      return u.slice(0, -1);
    });
  }

  function doUndo() {
    const prev = undo[undo.length - 1];
    if (!prev) return;
    setUndo(undo.slice(0, -1));
    setRedo([...redo, design]);
    setDesign(prev);
    save(prev);
    boop();
  }
  function doRedo() {
    const next = redo[redo.length - 1];
    if (!next) return;
    setRedo(redo.slice(0, -1));
    setUndo([...undo, design]);
    setDesign(next);
    save(next);
    pop();
  }

  function reject(msg: string) {
    toast(msg);
    boop();
    setShaking(true);
    setTimeout(() => setShaking(false), 400);
  }

  const owned = getState().owned;
  const sideBySide = wide && info.is3d;
  const tools: { id: Tool; label: string; icon: preact.JSX.Element }[] = [
    { id: 'paint', label: 'Paint', icon: <Paintbrush size={28} /> },
    { id: 'fill', label: 'Fill', icon: <PaintBucket size={28} /> },
    ...(design.kind === 'flat' || design.kind === 'critter'
      ? [
          { id: 'erase' as Tool, label: 'Erase', icon: <Eraser size={28} /> },
          { id: 'leg' as Tool, label: 'Legs', icon: <Footprints size={28} /> },
        ]
      : []),
    { id: 'swap', label: 'Swap', icon: <Replace size={28} /> },
  ];

  const kind = design.kind;
  const pickColor = useCallback(
    (c: string) => {
      setColor(c);
      if (isStar(c) && kind !== 'bracelet' && tool !== 'leg') toast('Stars go on leg tips ⭐ (Legs tool)');
    },
    [kind, tool],
  );

  const canvas = <EditCanvas design={design} tool={tool} mirror={mirror} color={color} onChange={onCanvasChange} onCancelStroke={cancelStroke} onReject={reject} />;

  return (
    <div class="screen editor">
      <TopBar title={null} backTo={{ name: 'kind', kind: design.kind }}>
        <button class="name-btn" onClick={() => setSheet('name')} aria-label="Rename">
          {design.name}
        </button>
        <button class="btn icon" aria-label="Undo" disabled={!undo.length} onClick={doUndo}>
          <Undo2 size={28} />
        </button>
        <button class="btn icon" aria-label="Redo" disabled={!redo.length} onClick={doRedo}>
          <Redo2 size={28} />
        </button>
        {!sideBySide && (
          <button class={`btn icon${show3d ? ' violet' : ''}`} aria-label="3D view" aria-pressed={show3d} onClick={() => setShow3d(!show3d)}>
            <Box size={28} />
          </button>
        )}
        <button
          class="btn pink"
          data-testid="make-it"
          onClick={() => {
            save(design);
            chime();
            go({ name: 'make', id: design.id });
          }}
        >
          <Play size={24} fill="#fff" />
          <span class="lbl">Make</span>
        </button>
      </TopBar>

      <div class="stage">
        {(!show3d || sideBySide) && (
          <div class={`canvas-wrap${shaking ? ' shake' : ''}`}>
            {canvas}
          </div>
        )}
        {(sideBySide || show3d) && <View3D design={design} />}
      </div>

      <div class="tools" role="toolbar" aria-label="Tools">
        {tools.map((t) => (
          <button key={t.id} class={`tool${tool === t.id ? ' on' : ''}`} aria-pressed={tool === t.id} onClick={() => setTool(t.id)} data-tool={t.id}>
            {t.icon}
            {t.label}
          </button>
        ))}
        <button class={`tool toggle${mirror ? ' on' : ''}`} aria-pressed={mirror} onClick={() => setMirror(!mirror)} data-tool="mirror">
          <FlipHorizontal2 size={28} />
          Mirror
        </button>
        <span class="tool-sep" />
        <SizeControls design={design} onChange={(n) => commit(n)} />
        {(design.kind === 'flat' || design.kind === 'critter') && (
          <button
            class={`tool toggle${design.keyring ? ' on' : ''}`}
            aria-pressed={design.keyring}
            onClick={() => commit(E.setKeyring(design, !design.keyring))}
            data-tool="keyring"
          >
            <KeyRound size={28} />
            Key ring
          </button>
        )}
        {design.kind === 'bracelet' && (
          <button class="tool" onClick={() => setSheet('pattern')} data-tool="pattern">
            <Repeat size={28} />
            Pattern
          </button>
        )}
        <span class="tool-sep" />
        <button
          class="tool"
          data-tool="mybeads"
          onClick={() => {
            if (!owned.size) {
              toast('Tap “My Beads” on the home screen first');
              return;
            }
            const n = E.useMyBeads(design, owned);
            if (JSON.stringify(n) === JSON.stringify(design)) toast('Already all your beads!');
            else {
              commit(n);
              chime();
              toast('Now it uses your beads');
            }
          }}
        >
          <WandSparkles size={28} />
          My beads
        </button>
        <button
          class="tool"
          data-tool="surprise"
          onClick={() => {
            const pool = getState().settings.mineOnly && owned.size ? [...owned] : COLORS.map((c) => c.id);
            commit(E.surprise(design, pool));
            chime();
          }}
        >
          <Shuffle size={28} />
          Surprise
        </button>
      </div>

      <Palette value={color} onPick={pickColor} />

      {sheet === 'name' && <RenameSheet design={design} onDone={(n) => (n ? commit({ ...design, name: n }, false) : null, setSheet(null))} />}
      {sheet === 'pattern' && design.kind === 'bracelet' && (
        <PatternSheet
          start={color}
          onApply={(colors, rhythm) => {
            if (design.kind !== 'bracelet') return;
            commit(E.applyRhythm(design, colors, rhythm));
            chime();
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Stepper({ label, value, sub, onMinus, onPlus, testid }: { label: string; value: string | number; sub?: string; onMinus: () => void; onPlus: () => void; testid: string }) {
  return (
    <div class="stepper" data-testid={testid}>
      <button aria-label={`Less ${label}`} onClick={onMinus}>
        <Minus size={24} />
      </button>
      <div class="val">
        {value}
        <small>{sub ?? label}</small>
      </div>
      <button aria-label={`More ${label}`} onClick={onPlus}>
        <Plus size={24} />
      </button>
    </div>
  );
}

function SizeControls({ design, onChange }: { design: Design; onChange: (d: Design) => void }) {
  if (design.kind === 'bracelet') {
    const n = design.beads.length;
    return (
      <Stepper
        testid="size-beads"
        label="beads"
        value={n}
        sub={`beads · ${inchesAround(n * BEAD.length)}″`}
        onMinus={() => onChange(E.braceletSize(design, n - 1))}
        onPlus={() => onChange(E.braceletSize(design, n + 1))}
      />
    );
  }
  if (design.kind === 'cuff') {
    const w = design.rows[0].length;
    const L = design.rows.length;
    return (
      <>
        <Stepper testid="size-width" label="wide" value={w} sub="wide" onMinus={() => onChange(E.cuffWidth(design, -1))} onPlus={() => onChange(E.cuffWidth(design, 1))} />
        <Stepper
          testid="size-rows"
          label="rows"
          value={L}
          sub={`rows · ${inchesAround(L * BEAD.diameter)}″`}
          onMinus={() => onChange(E.cuffLength(design, L - 1))}
          onPlus={() => onChange(E.cuffLength(design, L + 1))}
        />
      </>
    );
  }
  return (
    <div class="stepper" style={{ padding: '4px 12px' }}>
      <div class="val">
        {design.rows.length}
        <small>rows · {totalBeads(design)} beads</small>
      </div>
    </div>
  );
}

const NAME_IDEAS = ['Sparkle', 'Rainbow', 'Cosmic', 'Sunny', 'Bubble', 'Twinkle', 'Jelly', 'Candy', 'Lucky', 'Dreamy', 'Zippy', 'Fizzy'];
const NAME_THINGS = ['Dream', 'Buddy', 'Pop', 'Swirl', 'Wish', 'Star', 'Friend', 'Bean', 'Glow', 'Party'];

function RenameSheet({ design, onDone }: { design: Design; onDone: (name: string | null) => void }) {
  const [name, setName] = useState(design.name);
  return (
    <Sheet label="Name" onClose={() => onDone(null)}>
      <h2>Name it</h2>
      <input
        value={name}
        maxLength={40}
        onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
        style={{ width: '100%', fontSize: '24px', padding: '12px 16px', borderRadius: '16px', border: '3px solid #ecdff0' }}
        aria-label="Name"
      />
      <div class="row">
        <button
          class="btn violet"
          onClick={() => setName(`${NAME_IDEAS[Math.floor(Math.random() * NAME_IDEAS.length)]} ${NAME_THINGS[Math.floor(Math.random() * NAME_THINGS.length)]}`)}
        >
          <Shuffle size={22} /> Random
        </button>
        <button class="btn pink" onClick={() => onDone(name.trim() || design.name)}>
          Done
        </button>
      </div>
    </Sheet>
  );
}

function PatternSheet({ start, onApply, onClose }: { start: string; onApply: (colors: string[], rhythm: string) => void; onClose: () => void }) {
  const [colors, setColors] = useState<string[]>([start]);
  const [slot, setSlot] = useState(1);
  const [rhythm, setRhythm] = useState<string>('AB');
  const need = useMemo(() => new Set(rhythm.split('')).size, [rhythm]);
  const s = useStore();
  const list = COLORS.filter((c) => !s.settings.mineOnly || !s.owned.size || s.owned.has(c.id));
  return (
    <Sheet label="Pattern" onClose={onClose}>
      <h2>Make a pattern</h2>
      <div class="row" role="radiogroup" aria-label="Rhythm">
        {E.RHYTHMS.map((r) => (
          <button key={r} class={`btn${rhythm === r ? ' violet' : ''}`} onClick={() => setRhythm(r)} aria-pressed={rhythm === r} style={{ minWidth: '84px' }}>
            {r.split('').map((ch, i) => (
              <span key={i} style={{ display: 'inline-block', width: '10px', height: '16px', borderRadius: '4px', margin: '0 1px', background: ['#ff4f9a', '#7c5cff', '#12b5a3', '#ffc93c'][ch.charCodeAt(0) - 65] }} />
            ))}
          </button>
        ))}
      </div>
      <div class="row" style={{ alignItems: 'center' }}>
        {Array.from({ length: need }, (_, i) => (
          <button
            key={i}
            class={`swatch${slot === i ? ' sel' : ''}`}
            style={{ width: '64px', height: '64px' }}
            onClick={() => setSlot(i)}
            aria-label={`Color ${String.fromCharCode(65 + i)}`}
          >
            {colors[i] ? <Swatch id={colors[i]} size={54} /> : <span style={{ fontSize: '28px', color: '#c7a9c0' }}>?</span>}
          </button>
        ))}
      </div>
      <div class="row" style={{ maxHeight: '180px', overflowY: 'auto' }}>
        {list.map((c) => (
          <button
            key={c.id}
            class="swatch"
            aria-label={`${FINISH_LABEL[c.finish]} ${c.name}`}
            onClick={() => {
              const next = [...colors];
              next[slot] = c.id;
              setColors(next);
              setSlot(Math.min(need - 1, slot + 1));
              pop();
            }}
          >
            <Swatch id={c.id} size={44} />
          </button>
        ))}
      </div>
      <div class="row">
        <button class="btn pink big" disabled={colors.slice(0, need).filter(Boolean).length < need} onClick={() => onApply(colors.slice(0, need), rhythm)}>
          Fill bracelet
        </button>
        <button class="btn big" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}

