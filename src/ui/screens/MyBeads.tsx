import { Check, CheckCheck, X } from 'lucide-preact';
import { setOwned, toggleOwned, useStore } from '../../app/store';
import { COLORS, FINISH_LABEL, type Finish } from '../../core/colors';
import { Swatch } from '../Bead';
import { TopBar } from '../common';
import { pop } from '../sound';

const ORDER: Finish[] = ['solid', 'clear', 'pearl', 'star'];

export function MyBeads() {
  const s = useStore();
  return (
    <div class="screen">
      <TopBar title="My Beads" backTo={{ name: 'home' }}>
        <span class="chip" style={{ paddingLeft: '12px' }}>
          {s.owned.size} / {COLORS.length}
        </span>
      </TopBar>
      <p style={{ margin: '0 4px 8px', color: '#7b6688', fontSize: '18px' }}>Tap the beads you have.</p>
      {ORDER.map((f) => {
        const list = COLORS.filter((c) => c.finish === f);
        const allOn = list.every((c) => s.owned.has(c.id));
        return (
          <section key={f}>
            <div class="section-title">
              {FINISH_LABEL[f]}
              <button
                class="btn"
                style={{ marginLeft: 'auto', minHeight: '48px', fontSize: '16px' }}
                onClick={() => {
                  const next = new Set(s.owned);
                  for (const c of list) {
                    if (allOn) next.delete(c.id);
                    else next.add(c.id);
                  }
                  setOwned(next);
                }}
              >
                {allOn ? <X size={20} /> : <CheckCheck size={20} />} {allOn ? 'None' : 'All'}
              </button>
            </div>
            <div class="bead-grid">
              {list.map((c) => {
                const on = s.owned.has(c.id);
                return (
                  <button
                    key={c.id}
                    class={`own${on ? ' on' : ''}`}
                    aria-pressed={on}
                    aria-label={`${FINISH_LABEL[c.finish]} ${c.name}`}
                    data-color={c.id}
                    onClick={() => {
                      toggleOwned(c.id);
                      pop();
                    }}
                  >
                    {on && (
                      <span class="check">
                        <Check size={18} strokeWidth={3.5} />
                      </span>
                    )}
                    <Swatch id={c.id} size={58} />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
