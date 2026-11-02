import { useEffect, useRef, useState } from 'preact/hooks';
import type { Design } from '../core/types';
import { DesignView } from './DesignView';
import type { Viewer } from '../three/viewer';

/**
 * 3D preview. three.js is loaded only when this is shown. If WebGL is not available or the
 * GPU drops the context, the flat picture is shown instead.
 */
export function View3D({ design }: { design: Design }) {
  const box = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const latest = useRef(design);
  latest.current = design;
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('../three/viewer')
      .then(({ createViewer }) => {
        if (cancelled || !box.current) return;
        try {
          viewer.current = createViewer(
            box.current,
            latest.current,
            () => setFailed(true),
            () => setDrawn(true),
          );
          setLoading(false);
        } catch {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      viewer.current?.dispose();
      viewer.current = null;
    };
  }, []);

  // While she paints, wait for a short pause before rebuilding the 3D beads.
  useEffect(() => {
    const t = setTimeout(() => viewer.current?.update(design), 180);
    return () => clearTimeout(t);
  }, [design]);

  return (
    <div class="view3d" ref={box} data-testid="view3d" data-state={failed ? 'fallback' : loading ? 'loading' : drawn ? 'drawn' : 'ready'}>
      {failed && (
        <div class="fallback">
          <DesignView design={design} />
        </div>
      )}
      {!failed && <div class="hint">Drag to spin · pinch to zoom · it's a preview: real beads shift a little</div>}
    </div>
  );
}
