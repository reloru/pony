import { useMemo, useState } from 'preact/hooks';
import { Copy, Heart, MoreHorizontal, Play, Plus, Star, Trash2, Type } from 'lucide-preact';
import { go } from '../../app/router';
import { addDraft, deleteDesign, saveDesign, useStore } from '../../app/store';
import { STARTERS } from '../../core/designs';
import { COLORS } from '../../core/colors';
import { newId } from '../../core/edit';
import { cleanName, MAX_LETTERS, nameKeychain } from '../../core/letters';
import { Swatch } from '../Bead';
import type { Design, Kind } from '../../core/types';
import { Sheet, TopBar } from '../common';
import { DesignView } from '../DesignView';
import { blankDesign, copyOf, KIND_INFO } from '../kinds';
import { chime } from '../sound';

function startFrom(d: Design) {
  const c = copyOf(d);
  addDraft(c);
  chime();
  go({ name: 'edit', id: c.id });
}

export function KindGallery({ kind }: { kind: Kind }) {
  const s = useStore();
  const info = KIND_INFO[kind];
  const ideas = STARTERS.filter((d) => d.kind === kind);
  const mine = s.designs.filter((d) => d.kind === kind);
  const [naming, setNaming] = useState(false);
  return (
    <div class="screen">
      <TopBar title={info.label} backTo={{ name: 'home' }} />
      <div class="gallery">
        <button
          class="card fresh"
          data-testid="fresh"
          onClick={() => {
            const d = blankDesign(kind);
            addDraft(d);
            chime();
            go({ name: 'edit', id: d.id });
          }}
        >
          <div class="thumbbox">
            <Plus size={64} strokeWidth={3} />
          </div>
          <div class="title">Start fresh</div>
        </button>
        {kind === 'flat' && (
          <button class="card fresh" data-testid="name-keychain" onClick={() => setNaming(true)}>
            <div class="thumbbox">
              <Type size={64} strokeWidth={3} />
            </div>
            <div class="title">My name</div>
          </button>
        )}
        {ideas.map((d) => (
          <button key={d.id} class="card" data-testid={`idea-${d.id}`} onClick={() => startFrom(d)}>
            <div class="thumbbox">
              <DesignView design={d} thumb />
            </div>
            <div class="title">{d.name}</div>
          </button>
        ))}
      </div>
      {mine.length > 0 && (
        <>
          <div class="section-title">
            <Star size={24} color="#ffc93c" fill="#ffc93c" /> Mine
          </div>
          <DesignList designs={mine} />
        </>
      )}
      {naming && <NameSheet onClose={() => setNaming(false)} />}
    </div>
  );
}

/** Type up to four letters and pick two colors; it becomes a ladder-weave keychain on a key ring. */
function NameSheet({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [text, setText] = useState('');
  const [letter, setLetter] = useState('s-hot-pink');
  const [bg, setBg] = useState('s-white');
  const choices = useMemo(() => {
    const all = COLORS.filter((c) => c.finish !== 'star').map((c) => c.id);
    return s.owned.size ? [...all.filter((c) => s.owned.has(c)), ...all.filter((c) => !s.owned.has(c))] : all;
  }, [s.owned]);
  const name = cleanName(text);
  const design = useMemo(() => nameKeychain(name, letter, bg, { id: 'preview', createdAt: 0, updatedAt: 0 }), [name, letter, bg]);
  const row = (value: string, set: (c: string) => void, label: string) => (
    <div class="row" role="radiogroup" aria-label={label} style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '4px' }}>
      {choices.map((c) => (
        <button key={c} class={`swatch${c === value ? ' sel' : ''}`} aria-label={`${label} ${c}`} aria-pressed={c === value} data-color={c} onClick={() => set(c)}>
          <Swatch id={c} size={44} />
        </button>
      ))}
    </div>
  );
  return (
    <Sheet label="Name keychain" onClose={onClose}>
      <h2>Name keychain</h2>
      <div class="row" style={{ alignItems: 'center', flexWrap: 'nowrap' }}>
        <input
          value={text}
          maxLength={MAX_LETTERS}
          placeholder="ABC"
          autocapitalize="characters"
          autocomplete="off"
          spellcheck={false}
          data-testid="name-input"
          aria-label={`Up to ${MAX_LETTERS} letters`}
          onInput={(e) => setText(cleanName((e.currentTarget as HTMLInputElement).value))}
          style={{ flex: 1, minWidth: 0, fontSize: '30px', letterSpacing: '6px', padding: '10px 16px', borderRadius: '16px', border: '3px solid #ecdff0', textTransform: 'uppercase' }}
        />
        <button class="btn icon" aria-label="Add a heart" disabled={name.length >= MAX_LETTERS} onClick={() => setText(cleanName(name + '♥'))}>
          <Heart size={26} color="#c92a72" fill="#ff4f9a" />
        </button>
      </div>
      <p style={{ margin: '6px 0', color: '#7b6688' }}>Up to {MAX_LETTERS} letters.</p>
      <div style={{ fontWeight: 700 }}>Letters</div>
      {row(letter, setLetter, 'Letters')}
      <div style={{ fontWeight: 700 }}>Background</div>
      {row(bg, setBg, 'Background')}
      {design && (
        <div class="step-map" style={{ height: '200px', margin: '10px 0' }} data-testid="name-preview">
          <DesignView design={design} />
        </div>
      )}
      <div class="row">
        <button
          class="btn pink big"
          disabled={!design || letter === bg}
          data-testid="name-make"
          onClick={() => {
            if (!design) return;
            const now = Date.now();
            const d = { ...design, id: newId(), createdAt: now, updatedAt: now };
            addDraft(d);
            chime();
            go({ name: 'edit', id: d.id });
          }}
        >
          Make it
        </button>
        <button class="btn big" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}

export function MyDesigns() {
  const s = useStore();
  return (
    <div class="screen">
      <TopBar title="My Designs" backTo={{ name: 'home' }} />
      {s.designs.length === 0 ? (
        <div class="panel" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '22px' }}>Nothing here yet!</p>
          <p>Pick Bracelets, Shapes, Cuffs or Critters to start.</p>
          <button class="btn pink big" onClick={() => go({ name: 'home' })}>
            Let's go
          </button>
        </div>
      ) : (
        <DesignList designs={s.designs} />
      )}
    </div>
  );
}

function DesignList({ designs }: { designs: Design[] }) {
  const [menu, setMenu] = useState<Design | null>(null);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <div class="gallery">
        {designs.map((d) => (
          <div key={d.id} class="card" data-testid="my-design">
            {d.madeAt && (
              <span class="made-badge">
                <Star size={14} fill="#5a3b00" /> Made
              </span>
            )}
            <button class="thumbbox" style={{ border: 0 }} aria-label={`Edit ${d.name}`} onClick={() => go({ name: 'edit', id: d.id })}>
              <DesignView design={d} thumb />
            </button>
            <div class="title">{d.name}</div>
            <div class="card-actions">
              <button class="btn pink" aria-label={`Make ${d.name}`} onClick={() => go({ name: 'make', id: d.id })}>
                <Play size={22} fill="#fff" />
              </button>
              <button
                class="btn"
                aria-label="More"
                onClick={() => {
                  setMenu(d);
                  setConfirm(false);
                }}
              >
                <MoreHorizontal size={24} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {menu && (
        <Sheet label={menu.name} onClose={() => setMenu(null)}>
          <h2>{menu.name}</h2>
          {!confirm ? (
            <div class="row">
              <button
                class="btn violet big"
                onClick={() => {
                  const c = saveDesign(copyOf(menu, `${menu.name} 2`));
                  setMenu(null);
                  go({ name: 'edit', id: c.id });
                }}
              >
                <Copy size={26} /> Copy
              </button>
              <button class="btn big" onClick={() => setConfirm(true)}>
                <Trash2 size={26} color="#c92a72" /> Delete
              </button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: '20px' }}>Delete it for good?</p>
              <div class="row">
                <button
                  class="btn pink big"
                  onClick={() => {
                    deleteDesign(menu.id);
                    setMenu(null);
                  }}
                >
                  <Trash2 size={26} /> Yes, delete
                </button>
                <button class="btn big" onClick={() => setMenu(null)}>
                  No, keep it
                </button>
              </div>
            </>
          )}
        </Sheet>
      )}
    </>
  );
}
