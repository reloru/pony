import { STARTERS } from '../../core/designs';
import { cordFor, steps, totalBeads } from '../../core/steps';
import { TopBar } from '../common';
import { DesignView } from '../DesignView';

/** Hidden page (#/sheet) listing every starter design, used to review them side by side. */
export function ContactSheet() {
  return (
    <div class="screen">
      <TopBar title="All starter designs" backTo={{ name: 'home' }} />
      <div class="gallery" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
        {STARTERS.map((d) => {
          const cord = cordFor(d);
          return (
            <div key={d.id} class="card" style={{ minHeight: 0 }}>
              <div class="thumbbox" style={{ display: 'grid', gridTemplateColumns: d.kind === 'critter' ? '1fr 1fr' : '1fr', gap: '6px' }}>
                <DesignView design={d} />
                {d.kind === 'critter' && <DesignView design={d} mode="chart" />}
              </div>
              <div class="title">{d.name}</div>
              <div style={{ fontSize: '14px', color: '#7b6688' }}>
                {totalBeads(d)} beads · {steps(d).length} steps · {cord.inches} in {cord.kind}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
