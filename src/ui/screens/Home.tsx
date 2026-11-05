import { Download, Heart, Settings, Sparkles, Volume2, VolumeX } from 'lucide-preact';
import { href } from '../../app/router';
import { setSettings, useStore } from '../../app/store';
import { starter } from '../../core/designs';
import { DesignView } from '../DesignView';
import { KIND_INFO, KINDS } from '../kinds';
import { useOfflineStatus } from '../../app/offline';
import { promptInstall, useCanInstall } from '../../app/install';
import { toast } from '../common';

const HERO: Record<string, string> = { bracelet: 'b-rainbow', flat: 'f-butterfly', cuff: 'c-hearts', peyote: 'y-hearts', xbase: 'x-ocean', critter: 'k-bee' };

export function Home() {
  const s = useStore();
  const offline = useOfflineStatus();
  const canInstall = useCanInstall();
  return (
    <div class="screen">
      <div class="hero">
        <div>
          <h1>Bead Studio</h1>
          <div class="sub">Dream it. Bead it.</div>
        </div>
        <div class="hero-actions">
          {canInstall && (
            <button
              class="btn pink"
              data-testid="install"
              onClick={async () => {
                if (!(await promptInstall())) toast('Use Chrome’s ⋮ menu → Install app');
              }}
            >
              <Download size={24} />
              <span class="lbl">Install</span>
            </button>
          )}
          <button
            class="btn icon"
            aria-label={s.settings.sound ? 'Sound off' : 'Sound on'}
            onClick={() => setSettings({ sound: !s.settings.sound })}
          >
            {s.settings.sound ? <Volume2 size={28} /> : <VolumeX size={28} />}
          </button>
          <a class="btn icon" href={href({ name: 'grownups' })} aria-label="Grown-ups">
            <Settings size={28} />
          </a>
        </div>
      </div>

      <div class="kind-grid">
        {KINDS.map((k) => {
          const info = KIND_INFO[k];
          const d = starter(HERO[k])!;
          return (
            <a key={k} class="kind-tile" href={href({ name: 'kind', kind: k })} style={{ background: info.color }} data-kind={k}>
              {info.is3d && <span class="badge3d" style={{ color: info.ink }}>3D</span>}
              <DesignView design={d} class="thumb" label={info.label} />
              <span class="name" style={{ color: info.ink }}>
                {info.label}
              </span>
            </a>
          );
        })}
      </div>

      <div class="home-row">
        <a class="wide-tile" href={href({ name: 'mine' })}>
          <Sparkles size={34} color="#ff4f9a" />
          My Designs
          <span class="count">{s.designs.length}</span>
        </a>
        <a class="wide-tile" href={href({ name: 'beads' })}>
          <Heart size={34} color="#12b5a3" fill="#12b5a3" />
          My Beads
          <span class="count">{s.owned.size}</span>
        </a>
      </div>

      <div class="status-line">{offline}</div>
    </div>
  );
}
