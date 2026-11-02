import { useState } from 'preact/hooks';
import { Copy, MoreHorizontal, Play, Plus, Star, Trash2 } from 'lucide-preact';
import { go } from '../../app/router';
import { deleteDesign, saveDesign, useStore } from '../../app/store';
import { STARTERS } from '../../core/designs';
import type { Design, Kind } from '../../core/types';
import { Sheet, TopBar } from '../common';
import { DesignView } from '../DesignView';
import { blankDesign, copyOf, KIND_INFO } from '../kinds';
import { chime } from '../sound';

function startFrom(d: Design) {
  const c = saveDesign(copyOf(d));
  chime();
  go({ name: 'edit', id: c.id });
}

export function KindGallery({ kind }: { kind: Kind }) {
  const s = useStore();
  const info = KIND_INFO[kind];
  const ideas = STARTERS.filter((d) => d.kind === kind);
  const mine = s.designs.filter((d) => d.kind === kind);
  return (
    <div class="screen">
      <TopBar title={info.label} backTo={{ name: 'home' }} />
      <div class="gallery">
        <button
          class="card fresh"
          data-testid="fresh"
          onClick={() => {
            const d = saveDesign(blankDesign(kind));
            chime();
            go({ name: 'edit', id: d.id });
          }}
        >
          <div class="thumbbox">
            <Plus size={64} strokeWidth={3} />
          </div>
          <div class="title">Start fresh</div>
        </button>
        {ideas.map((d) => (
          <button key={d.id} class="card" data-testid={`idea-${d.id}`} onClick={() => startFrom(d)}>
            <div class="thumbbox">
              <DesignView design={d} />
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
    </div>
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
              <DesignView design={d} />
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
