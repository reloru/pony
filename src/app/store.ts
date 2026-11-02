import { useEffect, useState } from 'preact/hooks';
import { buildBody, progressAfterEdit } from '../core/steps';
import type { ColorId, Design } from '../core/types';
import { DEFAULT_SETTINGS, mergeDesigns, type ParsedBackup, type Settings } from './backup';

/**
 * Everything is kept on this device in IndexedDB. The in-memory copy is the source of truth
 * for the UI; writes go to IndexedDB shortly after each change and are flushed when the app
 * is hidden (iOS can close a home-screen app without warning).
 */

const DB_NAME = 'pony-beads';
const DB_VERSION = 1;

export interface AppState {
  ready: boolean;
  designs: Design[];
  owned: Set<ColorId>;
  settings: Settings;
  /** false if the browser refused storage; work then lives only until the app closes */
  persistent: boolean;
  storageError: string | null;
}

let state: AppState = {
  ready: false,
  designs: [],
  owned: new Set(),
  settings: DEFAULT_SETTINGS,
  persistent: true,
  storageError: null,
};

const listeners = new Set<() => void>();
function set(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export const getState = () => state;

export function useStore(): AppState {
  const [, force] = useState(0);
  const seen = state;
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    // The state may have changed between render and this effect (e.g. the database finished
    // loading); without this check that update would be missed and the screen would stay blank.
    if (state !== seen) l();
    return () => void listeners.delete(l);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}

// ---------------------------------------------------------------------------
// IndexedDB

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('no IndexedDB'));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('designs')) d.createObjectStore('designs', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
  }
  return dbp;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = d.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => resolve(req ? req.result : undefined);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error ?? new Error('transaction aborted'));
      }),
  );
}

function reportError(e: unknown) {
  set({ storageError: e instanceof Error ? e.message : String(e) });
}

export async function loadAll(): Promise<void> {
  try {
    const [designs, owned, settings] = await Promise.all([
      tx<Design[]>('designs', 'readonly', (s) => s.getAll() as IDBRequest<Design[]>),
      tx<ColorId[]>('kv', 'readonly', (s) => s.get('owned') as IDBRequest<ColorId[]>),
      tx<Settings>('kv', 'readonly', (s) => s.get('settings') as IDBRequest<Settings>),
    ]);
    set({
      ready: true,
      designs: (designs ?? []).sort((a, b) => b.updatedAt - a.updatedAt),
      owned: new Set(owned ?? []),
      settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) },
    });
  } catch (e) {
    set({ ready: true, persistent: false });
    reportError(e);
  }
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// Writes

const pendingDesigns = new Map<string, Design>();
const pendingDeletes = new Set<string>();
let kvDirty = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), 400);
}

export async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!state.persistent) return;
  const puts = [...pendingDesigns.values()];
  const dels = [...pendingDeletes];
  const kv = kvDirty;
  pendingDesigns.clear();
  pendingDeletes.clear();
  kvDirty = false;
  if (!puts.length && !dels.length && !kv) return;
  try {
    const d = await db();
    await new Promise<void>((resolve, reject) => {
      const t = d.transaction(['designs', 'kv'], 'readwrite');
      const ds = t.objectStore('designs');
      for (const x of puts) ds.put(x);
      for (const id of dels) ds.delete(id);
      if (kv) {
        t.objectStore('kv').put([...state.owned], 'owned');
        t.objectStore('kv').put(state.settings, 'settings');
      }
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error ?? new Error('save aborted'));
    });
  } catch (e) {
    reportError(e);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
  window.addEventListener('pagehide', () => void flush());
}

// Designs opened from a starter or "Start fresh" are drafts until she changes something or
// presses Make, so browsing ideas doesn't fill My Designs with untouched copies.
const drafts = new Map<string, Design>();
export function addDraft(d: Design) {
  drafts.set(d.id, d);
}
export function getDraft(id: string): Design | undefined {
  return drafts.get(id);
}

export function saveDesign(d: Design) {
  const prev = state.designs.find((x) => x.id === d.id);
  const next: Design = { ...d, updatedAt: Date.now() };
  // Progress belongs to the stored copy; keep it consistent with what changed.
  delete next.buildStep;
  delete next.madeAt;
  if (prev?.buildStep) next.buildStep = progressAfterEdit(prev, next, prev.buildStep);
  if (prev?.madeAt && buildBody(prev) === buildBody(next)) next.madeAt = prev.madeAt;
  drafts.delete(d.id);
  const others = state.designs.filter((x) => x.id !== d.id);
  set({ designs: [next, ...others] });
  pendingDeletes.delete(d.id);
  pendingDesigns.set(d.id, next);
  schedule();
  return next;
}

/** Update build progress without moving the design to the top of the list. */
export function patchDesign(id: string, patch: Partial<Pick<Design, 'buildStep' | 'madeAt' | 'name'>>) {
  const designs = state.designs.map((x) => (x.id === id ? ({ ...x, ...patch } as Design) : x));
  set({ designs });
  const d = designs.find((x) => x.id === id);
  if (d) {
    pendingDesigns.set(id, d);
    schedule();
  }
}

export function deleteDesign(id: string) {
  set({ designs: state.designs.filter((x) => x.id !== id) });
  pendingDesigns.delete(id);
  pendingDeletes.add(id);
  schedule();
}

export function toggleOwned(id: ColorId) {
  const owned = new Set(state.owned);
  if (owned.has(id)) owned.delete(id);
  else owned.add(id);
  set({ owned });
  kvDirty = true;
  schedule();
}

export function setOwned(ids: Iterable<ColorId>) {
  set({ owned: new Set(ids) });
  kvDirty = true;
  schedule();
}

export function setSettings(patch: Partial<Settings>) {
  set({ settings: { ...state.settings, ...patch } });
  kvDirty = true;
  schedule();
}

export async function applyBackup(b: ParsedBackup): Promise<{ added: number; updated: number }> {
  const { merged, added, updated } = mergeDesigns(state.designs, b.designs);
  const owned = new Set([...state.owned, ...b.owned]);
  set({ designs: merged.sort((a, x) => x.updatedAt - a.updatedAt), owned });
  for (const d of b.designs) {
    const kept = merged.find((m) => m.id === d.id);
    if (kept === d) pendingDesigns.set(d.id, d);
  }
  kvDirty = true;
  await flush();
  return { added, updated };
}
