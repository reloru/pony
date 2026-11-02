import { Fragment } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { ChevronLeft, ChevronRight, House, KeyRound, PartyPopper, Pencil, Scissors, Volume2 } from 'lucide-preact';
import { go } from '../../app/router';
import { patchDesign, useStore } from '../../app/store';
import { color as colorOf, longName } from '../../core/colors';
import type { BeadRef } from '../../core/geometry';
import { beadCounts, cordFor, stepBeads, steps as makeSteps, totalBeads, usesKeyring, type Step } from '../../core/steps';
import type { Design } from '../../core/types';
import { Swatch } from '../Bead';
import { Confetti, TopBar } from '../common';
import { describe, runs, speech, type StepText } from '../describe';
import { DesignView } from '../DesignView';
import { HowTo } from '../HowTo';
import { KIND_INFO } from '../kinds';
import { chime, fanfare, pop } from '../sound';
import { speak, stopSpeaking, useVoice } from '../speech';

function Rich({ text }: { text: string }) {
  const parts = text.split('**');
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))}
    </>
  );
}

/** Which beads each step adds, so the map can show done / now / later. */
function stepRefs(design: Design, s: Step): BeadRef[] {
  if (s.t === 'row') return s.beads.map((_, i) => ({ t: 'row', row: s.row - 1, i }));
  if (s.t === 'leg')
    return [
      ...s.stem.map((_, i) => ({ t: 'leg' as const, row: s.row - 1, side: s.side, part: 'stem' as const, i })),
      ...s.toes.map((_, i) => ({ t: 'leg' as const, row: s.row - 1, side: s.side, part: 'toes' as const, i })),
    ];
  if (s.t === 'string') return s.beads.map((_, i) => ({ t: 'ring', i: s.from + i }));
  void design;
  return [];
}
const key = (r: BeadRef) => JSON.stringify(r);

export function Make({ id }: { id: string }) {
  const s = useStore();
  const design = s.designs.find((d) => d.id === id);
  if (!design) {
    return (
      <div class="screen">
        <TopBar title="Hmm…" backTo={{ name: 'home' }} />
        <div class="panel">That design isn't here anymore.</div>
      </div>
    );
  }
  return <MakeInner design={design} />;
}

function MakeInner({ design }: { design: Design }) {
  const s = useStore();
  const steps = useMemo(() => makeSteps(design), [design]);
  // page 0 = gather, pages 1..n = steps, page n+1 = done
  const last = steps.length + 1;
  const [page, setPage] = useState(() => Math.min(design.buildStep ?? 0, last));
  const voice = useVoice();

  const firstCross = steps.findIndex((x) => x.t === 'row' && x.mode === 'cross');

  // done/current bead sets for the map
  const status = useMemo(() => {
    const done = new Set<string>();
    const now = new Set<string>();
    steps.forEach((st, i) => {
      const refs = stepRefs(design, st).map(key);
      if (i + 1 < page) refs.forEach((k) => done.add(k));
      else if (i + 1 === page) refs.forEach((k) => now.add(k));
    });
    return { done, now };
  }, [steps, page, design]);

  useEffect(() => {
    patchDesign(design.id, page === last ? { buildStep: page, madeAt: design.madeAt ?? Date.now() } : { buildStep: page });
    if (page === last) fanfare();
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const goTo = (p: number) => {
    stopSpeaking();
    setPage(Math.max(0, Math.min(last, p)));
    if (p > page) pop();
  };

  const step = page >= 1 && page <= steps.length ? steps[page - 1] : null;
  const text: StepText | null = step ? describe(step, { firstCrossRow: page - 1 === firstCross, keyring: usesKeyring(design) }) : null;
  const beads = step ? stepBeads(step) : [];
  const showMap = step && (step.t === 'row' || step.t === 'leg' || step.t === 'string');

  const highlight = (r: BeadRef) => {
    const k = key(r);
    if (status.now.has(k)) return 'on' as const;
    if (status.done.has(k)) return undefined;
    return 'dim' as const;
  };

  return (
    <div class="screen make">
      <TopBar title={design.name} backTo={{ name: 'edit', id: design.id }}>
        {voice && step && text && (
          <button class="btn icon violet" aria-label="Read aloud" onClick={() => speak(speech(text, beads), voice)}>
            <Volume2 size={28} />
          </button>
        )}
      </TopBar>
      <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={last} aria-valuenow={page}>
        <div style={{ width: `${(page / last) * 100}%` }} />
      </div>

      <div class="step-card" data-testid="step-card" data-step={step?.t ?? (page === 0 ? 'gather' : 'done')}>
        {page === 0 && <Gather design={design} owned={s.owned} />}
        {step && text && (
          <>
            <div class="step-title">
              <span class="step-num">
                {page}/{steps.length}
              </span>
              {text.title}
            </div>
            <div class="step-text">
              <Rich text={text.text} />
            </div>
            {beads.length > 0 && <BeadSeq beads={beads} owned={s.owned} />}
            <div class="step-body">
              <div class="how">
                <HowTo step={step} />
              </div>
              {showMap && (
                <div class="step-map">
                  <DesignView design={design} mode="chart" highlight={highlight} />
                </div>
              )}
            </div>
            {text.tip && <div class="tip">💡 {text.tip}</div>}
          </>
        )}
        {page === last && <Done design={design} />}
      </div>

      <div class="nav-row">
        <button class="btn big" disabled={page === 0} onClick={() => goTo(page - 1)} aria-label="Back a step">
          <ChevronLeft size={32} /> Back
        </button>
        {page < last ? (
          <button class="btn pink big" onClick={() => goTo(page + 1)} data-testid="next">
            {page === 0 ? "Let's go" : page === steps.length ? 'Finish' : 'Next'} <ChevronRight size={32} />
          </button>
        ) : (
          <button class="btn teal big" onClick={() => go({ name: 'home' })}>
            <House size={28} /> Home
          </button>
        )}
      </div>
    </div>
  );
}

function BeadSeq({ beads, owned }: { beads: string[]; owned: Set<string> }) {
  const rs = runs(beads);
  return (
    <div class="bead-seq" aria-label="Beads in order" data-testid="bead-seq">
      {rs.map((r, i) => (
        <Fragment key={i}>
          {i > 0 && <span class="arrow">→</span>}
          <span class={`chip${owned.size && !owned.has(r.color) ? ' warn' : ''}`} title={longName(r.color)} data-color={r.color} data-count={r.count}>
            <Swatch id={r.color} size={34} />×{r.count}
          </span>
        </Fragment>
      ))}
    </div>
  );
}

function Gather({ design, owned }: { design: Design; owned: Set<string> }) {
  const counts = beadCounts(design);
  const cord = cordFor(design);
  const missing = owned.size ? counts.filter((c) => !owned.has(c.color)) : [];
  return (
    <>
      <div class="step-title">
        <span class="step-num">Get ready</span>
      </div>
      <div class="step-text">
        You need <b>{totalBeads(design)} beads</b>:
      </div>
      <div class="gather-list" data-testid="gather">
        {counts.map((c) => (
          <div key={c.color} class={`gather-item${owned.size && !owned.has(c.color) ? ' missing' : ''}`} data-color={c.color} data-count={c.count}>
            <Swatch id={c.color} size={44} />
            <div>
              <div class="n">×{c.count}</div>
              <div class="nm">{longName(c.color)}</div>
            </div>
          </div>
        ))}
      </div>
      {missing.length > 0 && (
        <div class="tip">
          🧡 You might not have {missing.length === 1 ? 'this color' : `${missing.length} of these colors`}. Swap them in the editor with <b>My beads</b>, or use what you have!
        </div>
      )}
      <div class="supply">
        <Scissors size={30} />
        <span>
          {cord.inches} in of {cord.kind === 'lace' ? 'plastic lace' : 'stretchy cord'}
        </span>
      </div>
      {usesKeyring(design) && (
        <div class="supply">
          <KeyRound size={30} /> 1 key ring
        </div>
      )}
      <div class="step-map" style={{ maxHeight: '30vh' }}>
        <DesignView design={design} />
      </div>
      <p style={{ margin: 0, color: '#7b6688' }}>
        {KIND_INFO[design.kind].one} · {colorOf(counts[0].color).name} and friends
      </p>
    </>
  );
}

function Done({ design }: { design: Design }) {
  useEffect(() => chime(), []);
  return (
    <div style={{ textAlign: 'center', display: 'grid', gap: '12px', justifyItems: 'center' }}>
      <Confetti />
      <PartyPopper size={64} color="#ff4f9a" />
      <div class="step-title" style={{ justifyContent: 'center', fontSize: '34px' }}>
        You made it!
      </div>
      <div class="step-map" style={{ width: '100%' }}>
        <DesignView design={design} />
      </div>
      <button class="btn violet" onClick={() => go({ name: 'edit', id: design.id })}>
        <Pencil size={22} /> Change it
      </button>
    </div>
  );
}
