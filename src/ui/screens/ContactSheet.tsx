import { STARTERS } from '../../core/designs';
import { nameKeychain } from '../../core/letters';
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
      <h2 class="section-title">Name keychain letters</h2>
      <div class="gallery" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
        {['ABCD', 'EFGH', 'IJKL', 'MNOP', 'QRST', 'UVWX', 'YZ♥'].map((group) => {
          const d = nameKeychain(group, 's-hot-pink', 's-white', { id: group, createdAt: 0, updatedAt: 0 })!;
          return (
            <div key={group} class="card" style={{ minHeight: 0 }}>
              <div class="thumbbox" style={{ height: '260px' }}>
                <DesignView design={d} />
              </div>
              <div class="title">{group}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
