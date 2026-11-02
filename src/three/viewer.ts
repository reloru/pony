import {
  AmbientLight,
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  HemisphereLight,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  MeshPhongMaterial,
  Path,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Shape,
  Vector2,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { color } from '../core/colors';
import { layout3d, type Bead3D } from '../core/layout3d';
import type { Design } from '../core/types';

/** Pony bead: 9 mm across, 6 mm along the hole (lathe axis = Y), 4 mm hole. */
function beadGeometry(): BufferGeometry {
  const pts = [
    [2.05, -3],
    [3.4, -3],
    [4.05, -2.75],
    [4.42, -2.1],
    [4.55, -1],
    [4.58, 0],
    [4.55, 1],
    [4.42, 2.1],
    [4.05, 2.75],
    [3.4, 3],
    [2.05, 3],
    [2.0, 0],
    [2.05, -3],
  ].map(([x, y]) => new Vector2(x, y));
  return new LatheGeometry(pts, 14);
}

function starGeometry(): BufferGeometry {
  const s = new Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 3.1 : 6.4;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) s.moveTo(r * Math.cos(a), r * Math.sin(a));
    else s.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  s.closePath();
  const hole = new Path();
  hole.absarc(0, 0, 1.9, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new ExtrudeGeometry(s, { depth: 4.6, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.4, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -2.3);
  g.rotateX(-Math.PI / 2); // extrusion along Y, like the bead's hole
  return g;
}

type Group = 'solid' | 'pearl' | 'clear' | 'star';

export interface Viewer {
  update(d: Design): void;
  dispose(): void;
}

export function createViewer(container: HTMLElement, design: Design, onLost: () => void, onFirstFrame: () => void = () => {}): Viewer {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0xd9c8e6, 1.4));
  scene.add(new AmbientLight(0xffffff, 0.35));
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(40, 80, 120);
  scene.add(key);
  const rim = new DirectionalLight(0xfff0f8, 0.6);
  rim.position.set(-80, -30, -60);
  scene.add(rim);

  const camera = new PerspectiveCamera(35, 1, 1, 5000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.enablePan = false;
  controls.rotateSpeed = 0.9;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 2.2;

  const geoms = { barrel: beadGeometry(), star: starGeometry() };
  const mats: Record<Group, MeshPhongMaterial> = {
    solid: new MeshPhongMaterial({ shininess: 45, specular: new Color(0x3a3a3a) }),
    pearl: new MeshPhongMaterial({ shininess: 110, specular: new Color(0xb0b0b0), emissive: new Color(0x2a2a2a) }),
    clear: new MeshPhongMaterial({ shininess: 120, specular: new Color(0xcccccc), transparent: true, opacity: 0.58, depthWrite: false }),
    star: new MeshPhongMaterial({ shininess: 60, specular: new Color(0x555555) }),
  };
  let meshes: InstancedMesh[] = [];
  let kind = '';
  // Shaders compile in the background (KHR_parallel_shader_compile where available); we don't
  // draw until they're ready, so the first frame never freezes the page.
  let compiling = 0;

  const up = new Vector3(0, 1, 0);
  const tmpQ = new Quaternion();
  const tmpM = new Matrix4();
  const tmpV = new Vector3();
  const one = new Vector3(1, 1, 1);
  const tmpC = new Color();

  function build(d: Design) {
    for (const m of meshes) {
      scene.remove(m);
      m.dispose();
    }
    meshes = [];
    // Critters are laid out with z = up (their back). Turn them so y is up like everything
    // else: the back faces up and the head points away from the camera.
    const beads =
      d.kind === 'critter'
        ? layout3d(d).map((b) => ({ ...b, p: [b.p[0], b.p[2], -b.p[1]] as Bead3D['p'], axis: [b.axis[0], b.axis[2], -b.axis[1]] as Bead3D['axis'] }))
        : layout3d(d);
    const groups: Record<Group, Bead3D[]> = { solid: [], pearl: [], clear: [], star: [] };
    for (const b of beads) {
      const f = color(b.color).finish;
      groups[f === 'solid' ? 'solid' : f].push(b);
    }
    // Center the piece.
    const c = new Vector3();
    for (const b of beads) c.add(tmpV.set(...b.p));
    if (beads.length) c.divideScalar(beads.length);
    let radius = 10;
    for (const b of beads) radius = Math.max(radius, tmpV.set(...b.p).sub(c).length() + 6);

    (Object.keys(groups) as Group[]).forEach((g) => {
      const list = groups[g];
      if (!list.length) return;
      const mesh = new InstancedMesh(g === 'star' ? geoms.star : geoms.barrel, mats[g], list.length);
      list.forEach((b, i) => {
        tmpQ.setFromUnitVectors(up, tmpV.set(...b.axis).normalize());
        tmpM.compose(tmpV.set(b.p[0] - c.x, b.p[1] - c.y, b.p[2] - c.z), tmpQ, one);
        mesh.setMatrixAt(i, tmpM);
        mesh.setColorAt(i, tmpC.set(color(b.color).hex));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (g === 'clear') mesh.renderOrder = 2;
      scene.add(mesh);
      meshes.push(mesh);
    });

    if (d.kind !== kind) {
      kind = d.kind;
      const dist = radius / Math.sin((camera.fov * Math.PI) / 360) + 5;
      const dir =
        d.kind === 'critter'
          ? new Vector3(0.45, 1.05, 1)
          : d.kind === 'cuff'
            ? new Vector3(0.55, 0.45, 1)
            : d.kind === 'bracelet'
              ? new Vector3(0, -0.55, 1)
              : new Vector3(0, -0.25, 1);
      camera.position.copy(dir.normalize().multiplyScalar(dist));
      controls.target.set(0, 0, 0);
      controls.minDistance = radius * 1.2;
      controls.maxDistance = dist * 2.5;
      controls.update();
    }
    compiling++;
    renderer
      .compileAsync(scene, camera)
      .catch(() => undefined)
      .finally(() => {
        compiling--;
        requestRender();
      });
  }

  /** Call `fn` once the GPU has really finished the work queued so far (WebGL2 fence, polled without blocking). */
  function whenGpuDone(fn: () => void) {
    const gl = renderer.getContext();
    if (!('fenceSync' in gl)) {
      setTimeout(fn, 0);
      return;
    }
    const g2 = gl as WebGL2RenderingContext;
    const sync = g2.fenceSync(g2.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) {
      setTimeout(fn, 0);
      return;
    }
    g2.flush();
    const poll = () => {
      if (disposed) return g2.deleteSync(sync);
      if (g2.getSyncParameter(sync, g2.SYNC_STATUS) === g2.SIGNALED) {
        g2.deleteSync(sync);
        fn();
      } else setTimeout(poll, 50);
    };
    setTimeout(poll, 50);
  }

  // ---------------------------------------------------------------- render loop (on demand)
  let raf = 0;
  let running = false;
  let lastFrame = 0;
  let disposed = false;
  const frame = (t: number) => {
    raf = 0;
    if (disposed || compiling > 0) return;
    const changed = controls.update();
    renderer.render(scene, camera);
    if (!lastFrame) whenGpuDone(onFirstFrame);
    lastFrame = t;
    if (controls.autoRotate || changed || running) raf = requestAnimationFrame(frame);
  };
  function requestRender() {
    if (!raf && !disposed && document.visibilityState === 'visible') raf = requestAnimationFrame(frame);
  }
  controls.addEventListener('change', requestRender);
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    running = true;
    requestRender();
  });
  controls.addEventListener('end', () => {
    running = false;
    requestRender();
  });
  const onVis = () => {
    if (document.visibilityState === 'visible') requestRender();
    else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  document.addEventListener('visibilitychange', onVis);

  // Stop auto-spin after a while so the GPU can rest.
  const spinTimer = setTimeout(() => {
    controls.autoRotate = false;
  }, 12000);

  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    // Cap the pixel count so big tablet screens stay smooth.
    const dpr = window.devicePixelRatio || 1;
    const pr = Math.min(dpr, 2, Math.sqrt(2_000_000 / (w * h)));
    renderer.setPixelRatio(Math.max(1, pr));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    onLost();
  });

  build(design);
  void lastFrame;

  return {
    update: build,
    dispose() {
      disposed = true;
      clearTimeout(spinTimer);
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect();
      controls.dispose();
      for (const m of meshes) m.dispose();
      Object.values(geoms).forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
