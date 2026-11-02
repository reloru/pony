import { memo } from 'preact/compat';
import { Check, Heart } from 'lucide-preact';
import { setSettings, useStore } from '../app/store';
import { COLORS, FINISH_LABEL, type Finish } from '../core/colors';
import { Swatch } from './Bead';
import { pop } from './sound';

const ORDER: Finish[] = ['solid', 'clear', 'pearl', 'star'];

export const Palette = memo(function Palette({ value, onPick }: { value: string; onPick: (id: string) => void }) {
  const s = useStore();
  const mine = s.settings.mineOnly && s.owned.size > 0;
  return (
    <div class="palette" data-testid="palette">
      <div class="current" aria-label="Current color">
        <Swatch id={value} size={50} />
      </div>
      <button
        class={`mine${s.settings.mineOnly ? ' on' : ''}`}
        aria-pressed={s.settings.mineOnly}
        onClick={() => setSettings({ mineOnly: !s.settings.mineOnly })}
        title="Only my beads"
      >
        <Heart size={22} fill={s.settings.mineOnly ? '#fff' : 'none'} />
        Mine
      </button>
      <div class="scroll">
        {ORDER.map((f) => {
          const list = COLORS.filter((c) => c.finish === f && (!mine || s.owned.has(c.id)));
          if (!list.length) return null;
          return [
            <span key={`l-${f}`} class="fin-label">
              {FINISH_LABEL[f]}
            </span>,
            ...list.map((c) => (
              <button
                key={c.id}
                class={`swatch${c.id === value ? ' sel' : ''}`}
                aria-label={`${FINISH_LABEL[c.finish]} ${c.name}`}
                aria-pressed={c.id === value}
                data-color={c.id}
                onClick={() => {
                  onPick(c.id);
                  pop();
                }}
              >
                <Swatch id={c.id} size={46} />
                {s.owned.size > 0 && s.owned.has(c.id) && !mine && (
                  <span class="tick">
                    <Check size={13} strokeWidth={4} />
                  </span>
                )}
              </button>
            )),
          ];
        })}
      </div>
    </div>
  );
});
